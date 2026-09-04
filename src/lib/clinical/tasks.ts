import { createClient } from '@/lib/supabase/client';
import type { TaskFormData } from '@/lib/tasks/schema';
import type { Task } from '@/types';
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

const TASK_SELECT = '*';

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
  const assigneeMap = await fetchAssigneeMap(rows.map((r) => r.id));

  return {
    data: rows.map((row) => mapTask(row, assigneeMap[row.id] ?? [row.assigned_to])),
    error: listResult.error,
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
  const supabase = createClient();
  const assigneeRows = form.assigneeIds.map((employeeId) => ({
    task_id: taskRow.id,
    employee_id: employeeId,
    assigned_by: userId,
  }));
  const { error: assigneeError } = await supabase.from('task_assignees').insert(assigneeRows);
  if (assigneeError) {
    return { data: null, error: assigneeError.message };
  }

  return {
    data: mapTask(taskRow, form.assigneeIds),
    error: null,
  };
}

export async function updateTaskStatus(
  id: string,
  status: Task['status'],
): Promise<ClinicalResult<Task>> {
  const result = await runClinicalMutation('Failed to update task', async () => {
    const supabase = createClient();
    const updates: Record<string, unknown> = { status };
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }
    return supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .is('deleted_at', null)
      .select(TASK_SELECT)
      .single();
  });

  if (!result.data) return { data: null, error: result.error };

  const row = result.data as unknown as TaskRow;
  const assigneeMap = await fetchAssigneeMap([row.id]);
  return {
    data: mapTask(row, assigneeMap[row.id] ?? [row.assigned_to]),
    error: null,
  };
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

export async function fetchTasksForEmployee(employeeId: string): Promise<ClinicalListResult<Task>> {
  const result = await fetchTasks();
  return {
    data: result.data.filter((task) => task.assigneeIds.includes(employeeId)),
    error: result.error,
  };
}

export async function fetchEmployeeOptions(): Promise<{ id: string; fullName: string }[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('employees')
      .select('id, full_name')
      .is('deleted_at', null)
      .eq('employment_status', 'active')
      .order('full_name');

    if (error || !data) return [];
    return data.map((row) => ({ id: row.id, fullName: row.full_name }));
  } catch {
    return [];
  }
}

export async function fetchEmployeeNameMap(): Promise<Record<string, string>> {
  const employees = await fetchEmployeeOptions();
  return Object.fromEntries(employees.map((e) => [e.id, e.fullName]));
}

export function formatAssigneeNames(
  assigneeIds: string[],
  nameMap: Record<string, string>,
): string {
  if (assigneeIds.length === 0) return '—';
  return assigneeIds.map((id) => nameMap[id] ?? id).join(', ');
}
