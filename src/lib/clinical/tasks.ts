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

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    assignedTo: row.assigned_to,
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
  return {
    title: form.title.trim(),
    description: form.description?.trim() || null,
    assigned_to: form.assignedTo,
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
  return runClinicalListQuery('Failed to load tasks', async () => {
    const supabase = createClient();
    return supabase
      .from('tasks')
      .select(TASK_SELECT)
      .is('deleted_at', null)
      .order('due_date', { ascending: true });
  }).then((result) => ({
    data: (result.data as unknown as TaskRow[]).map(mapTask),
    error: result.error,
  }));
}

export async function createTask(
  userId: string,
  form: TaskFormData,
): Promise<ClinicalResult<Task>> {
  return runClinicalMutation('Failed to create task', async () => {
    const supabase = createClient();
    return supabase
      .from('tasks')
      .insert(formToInsertRow(form, userId))
      .select(TASK_SELECT)
      .single();
  }).then((result) => ({
    data: result.data ? mapTask(result.data as unknown as TaskRow) : null,
    error: result.error,
  }));
}

export async function updateTaskStatus(
  id: string,
  status: Task['status'],
): Promise<ClinicalResult<Task>> {
  return runClinicalMutation('Failed to update task', async () => {
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
  }).then((result) => ({
    data: result.data ? mapTask(result.data as unknown as TaskRow) : null,
    error: result.error,
  }));
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
    data: result.data.filter((task) => task.assignedTo === employeeId),
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
