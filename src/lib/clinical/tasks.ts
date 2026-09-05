import { createClient } from '@/lib/supabase/client';
import { fetchProfileLinkRows } from '@/lib/clinical/employee-portal-link';
import {
  buildStaffIdIndex,
  resolveEmployeePortalLink,
  unknownPortalLinkStatus,
  type PortalAccountLinkState,
} from '@/lib/employees/portal-link';
import type { TaskFormData } from '@/lib/tasks/schema';
import type { Task } from '@/types';
import { notifyTaskAssignees } from '@/lib/clinical/notifications';
import { recordTaskLifecycleEvent } from '@/lib/clinical/task-workflow';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string;
  assigned_by: string;
  priority: Task['priority'];
  status: Task['status'];
  start_date: string;
  due_date: string;
  recurrence: NonNullable<Task['recurrence']>;
  task_type: Task['taskType'];
  approval_status: Task['approvalStatus'] | null;
  completion_evidence: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

async function fetchAssigneeMap(taskIds: string[]): Promise<Record<string, string[]>> {
  if (taskIds.length === 0) return {};
  const supabase = createClient();
  const { data } = await supabase
    .from('task_assignees')
    .select('task_id, employee_id')
    .in('task_id', taskIds);
  const map: Record<string, string[]> = {};
  for (const row of data ?? []) {
    const taskId = row.task_id as string;
    if (!map[taskId]) map[taskId] = [];
    map[taskId].push(row.employee_id as string);
  }
  return map;
}

function mapTask(row: TaskRow, assigneeIds: string[]): Task {
  const primary = assigneeIds[0] ?? row.assigned_to;
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    assignedTo: primary,
    assigneeIds: assigneeIds.length > 0 ? assigneeIds : [row.assigned_to],
    assignedBy: row.assigned_by,
    priority: row.priority,
    status: row.status,
    startDate: row.start_date,
    dueDate: row.due_date,
    recurrence: row.recurrence,
    taskType: row.task_type,
    approvalStatus: row.approval_status ?? undefined,
    completionEvidence: row.completion_evidence ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formToInsertRow(form: TaskFormData, userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const primaryAssignee = form.assigneeIds[0];
  return {
    title: form.title.trim(),
    description: form.description?.trim() || null,
    assigned_to: primaryAssignee,
    assigned_by: userId,
    priority: form.priority,
    status: 'not_started' as const,
    start_date: today,
    due_date: form.dueDate,
    recurrence: form.recurrence,
    task_type: form.taskType,
    created_by: userId,
  };
}

function formToUpdateRow(form: TaskFormData) {
  const primaryAssignee = form.assigneeIds[0];
  return {
    title: form.title.trim(),
    description: form.description?.trim() || null,
    assigned_to: primaryAssignee,
    priority: form.priority,
    due_date: form.dueDate,
    recurrence: form.recurrence,
    task_type: form.taskType,
  };
}

async function syncTaskAssignees(
  taskId: string,
  userId: string,
  nextAssigneeIds: string[],
  previousAssigneeIds: string[],
): Promise<{ addedIds: string[]; error: string | null }> {
  const nextSet = new Set(nextAssigneeIds);
  const previousSet = new Set(previousAssigneeIds);
  const toAdd = nextAssigneeIds.filter((id) => !previousSet.has(id));
  const toRemove = previousAssigneeIds.filter((id) => !nextSet.has(id));

  const supabase = createClient();

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('task_assignees')
      .delete()
      .eq('task_id', taskId)
      .in('employee_id', toRemove);
    if (error) return { addedIds: [], error: error.message };
  }

  if (toAdd.length > 0) {
    const { error } = await supabase.from('task_assignees').insert(
      toAdd.map((employeeId) => ({
        task_id: taskId,
        employee_id: employeeId,
        assigned_by: userId,
      })),
    );
    if (error) return { addedIds: [], error: error.message };
  }

  return { addedIds: toAdd, error: null };
}

const TASK_SELECT = '*';

async function mapTasksFromRows(rows: TaskRow[]): Promise<Task[]> {
  const assigneeMap = await fetchAssigneeMap(rows.map((r) => r.id));
  return rows.map((row) => mapTask(row, assigneeMap[row.id] ?? [row.assigned_to]));
}

export async function fetchTasks(): Promise<ClinicalListResult<Task>> {
  const listResult = await runClinicalListQuery('Failed to load tasks', async () => {
    const supabase = createClient();
    return supabase
      .from('tasks')
      .select(TASK_SELECT)
      .is('deleted_at', null)
      .order('due_date', { ascending: true });
  });

  const rows = listResult.data as unknown as TaskRow[];
  return {
    data: await mapTasksFromRows(rows),
    error: listResult.error,
  };
}

export async function fetchTaskById(id: string): Promise<ClinicalResult<Task>> {
  const result = await runClinicalListQuery('Failed to load task', async () => {
    const supabase = createClient();
    return supabase
      .from('tasks')
      .select(TASK_SELECT)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
  });

  if (result.error || !result.data) {
    return { data: null, error: result.error ?? 'Task not found' };
  }

  const row = result.data as unknown as TaskRow;
  const assigneeMap = await fetchAssigneeMap([row.id]);
  return {
    data: mapTask(row, assigneeMap[row.id] ?? [row.assigned_to]),
    error: null,
  };
}

export async function fetchTasksForEmployee(employeeId: string): Promise<ClinicalListResult<Task>> {
  const result = await fetchTasks();
  return {
    data: result.data.filter((task) => task.assigneeIds.includes(employeeId)),
    error: result.error,
  };
}

export async function createTask(
  userId: string,
  form: TaskFormData,
): Promise<ClinicalResult<Task>> {
  const insertResult = await runClinicalMutation('Failed to create task', async () => {
    const supabase = createClient();
    return supabase
      .from('tasks')
      .insert(formToInsertRow(form, userId))
      .select(TASK_SELECT)
      .single();
  });

  if (!insertResult.data) {
    return { data: null, error: insertResult.error };
  }

  const taskRow = insertResult.data as unknown as TaskRow;
  const sync = await syncTaskAssignees(taskRow.id, userId, form.assigneeIds, []);
  if (sync.error) {
    return { data: null, error: sync.error };
  }

  if (sync.addedIds.length > 0) {
    const notify = await notifyTaskAssignees(taskRow.id, form.title.trim(), sync.addedIds);
    if (notify.error) {
      return { data: null, error: notify.error };
    }
  }

  await recordTaskLifecycleEvent(taskRow.id, 'created');
  if (form.assigneeIds.length > 0) {
    await recordTaskLifecycleEvent(taskRow.id, 'assigned');
  }

  return {
    data: mapTask(taskRow, form.assigneeIds),
    error: null,
  };
}

export async function updateTask(
  userId: string,
  taskId: string,
  form: TaskFormData,
  previousAssigneeIds: string[],
): Promise<ClinicalResult<Task>> {
  const updateResult = await runClinicalMutation('Failed to update task', async () => {
    const supabase = createClient();
    return supabase
      .from('tasks')
      .update(formToUpdateRow(form))
      .eq('id', taskId)
      .is('deleted_at', null)
      .select(TASK_SELECT)
      .single();
  });

  if (!updateResult.data) {
    return { data: null, error: updateResult.error };
  }

  const sync = await syncTaskAssignees(taskId, userId, form.assigneeIds, previousAssigneeIds);
  if (sync.error) {
    return { data: null, error: sync.error };
  }

  if (sync.addedIds.length > 0) {
    const notify = await notifyTaskAssignees(taskId, form.title.trim(), sync.addedIds);
    if (notify.error) {
      return { data: null, error: notify.error };
    }
    await recordTaskLifecycleEvent(taskId, 'reassigned', `Added ${sync.addedIds.length} assignee(s)`);
  }
  if (sync.addedIds.length === 0 && previousAssigneeIds.length !== form.assigneeIds.length) {
    await recordTaskLifecycleEvent(taskId, 'reassigned');
  }

  const row = updateResult.data as unknown as TaskRow;
  return {
    data: mapTask(row, form.assigneeIds),
    error: null,
  };
}

export async function updateTaskStatus(
  id: string,
  status: Task['status'],
): Promise<ClinicalResult<Task>> {
  // Direct status updates are blocked by DB trigger — use performTaskWorkflowAction instead.
  void status;
  return { data: null, error: 'Use workflow actions to change task status' };
}

export async function softDeleteTask(id: string): Promise<{ error: string | null }> {
  const result = await runClinicalMutation('Failed to delete task', async () => {
    const supabase = createClient();
    return supabase
      .from('tasks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .single();
  });
  return { error: result.error };
}

export interface EmployeeOptionResult {
  id: string;
  fullName: string;
  employeeCode: string;
  portalLinkState: PortalAccountLinkState;
  portalLoginActive: boolean;
}

export async function fetchEmployeeOptions(): Promise<{
  data: EmployeeOptionResult[];
  error: string | null;
  portalLinkError: string | null;
}> {
  const result = await runClinicalListQuery('Failed to load employees', async () => {
    const supabase = createClient();
    return supabase
      .from('employees')
      .select('id, full_name, employee_code, employment_status, is_active')
      .is('deleted_at', null)
      .eq('is_active', true)
      .eq('employment_status', 'active')
      .order('full_name');
  });

  if (result.error) {
    return { data: [], error: result.error, portalLinkError: null };
  }

  const rows = (result.data ?? []) as Array<{ id: string; full_name: string; employee_code: string }>;
  const profileResult = await fetchProfileLinkRows();

  if (profileResult.error) {
    return {
      data: rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        employeeCode: row.employee_code,
        portalLinkState: unknownPortalLinkStatus().linkState,
        portalLoginActive: false,
      })),
      error: null,
      portalLinkError: profileResult.error,
    };
  }

  const staffIdIndex = buildStaffIdIndex(profileResult.data);
  const linkedByEmployeeId = new Map(
    profileResult.data
      .filter((profile) => profile.employeeId)
      .map((profile) => [profile.employeeId!, profile]),
  );

  return {
    data: rows.map((row) => {
      const linkedProfile = linkedByEmployeeId.get(row.id) ?? null;
      const portalLink = resolveEmployeePortalLink(row.employee_code, linkedProfile, staffIdIndex);
      return {
        id: row.id,
        fullName: row.full_name,
        employeeCode: row.employee_code,
        portalLinkState: portalLink.linkState,
        portalLoginActive: portalLink.portalLoginActive,
      };
    }),
    error: null,
    portalLinkError: null,
  };
}

export async function fetchEmployeeNameMap(): Promise<Record<string, string>> {
  const { data } = await fetchEmployeeOptions();
  return Object.fromEntries(data.map((e) => [e.id, e.fullName]));
}

export function formatAssigneeNames(
  assigneeIds: string[],
  nameMap: Record<string, string>,
): string {
  if (assigneeIds.length === 0) return '—';
  return assigneeIds.map((id) => nameMap[id] ?? id).join(', ');
}

export function exportTasksCsv(
  tasks: Task[],
  nameMap: Record<string, string>,
): string {
  const header = ['Title', 'Status', 'Priority', 'Assignees', 'Due Date', 'Task Type'];
  const rows = tasks.map((task) => [
    task.title,
    task.status,
    task.priority,
    formatAssigneeNames(task.assigneeIds, nameMap),
    task.dueDate,
    task.taskType ?? '',
  ]);
  return [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export function isTaskAssignee(task: Task, employeeId?: string): boolean {
  if (!employeeId) return false;
  return task.assigneeIds.includes(employeeId);
}

export function computeAssigneeDiff(
  previousAssigneeIds: string[],
  nextAssigneeIds: string[],
): { toAdd: string[]; toRemove: string[] } {
  const previous = new Set(previousAssigneeIds);
  const next = new Set(nextAssigneeIds);
  return {
    toAdd: nextAssigneeIds.filter((id) => !previous.has(id)),
    toRemove: previousAssigneeIds.filter((id) => !next.has(id)),
  };
}
