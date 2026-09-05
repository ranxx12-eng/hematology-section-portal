import { createClient } from '@/lib/supabase/client';
import type { Task } from '@/types';
import type { TaskWorkflowAction, TaskWorkflowHistoryEntry } from '@/lib/tasks/workflow';
import { runClinicalListQuery, runClinicalMutation, type ClinicalResult } from './result';

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

interface HistoryRow {
  id: string;
  task_id: string;
  previous_status: Task['status'] | null;
  new_status: Task['status'];
  action: string;
  performed_by: string;
  performer_role: string | null;
  comment: string | null;
  created_at: string;
}

function mapTaskFromRow(row: TaskRow, assigneeIds: string[]): Task {
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

async function fetchAssigneeIds(taskId: string): Promise<string[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('task_assignees')
    .select('employee_id')
    .eq('task_id', taskId);
  return (data ?? []).map((row) => row.employee_id as string);
}

function mapHistory(row: HistoryRow, performerName?: string): TaskWorkflowHistoryEntry {
  return {
    id: row.id,
    taskId: row.task_id,
    previousStatus: row.previous_status ?? undefined,
    newStatus: row.new_status,
    action: row.action,
    performedBy: row.performed_by,
    performerRole: row.performer_role ?? undefined,
    performerName,
    comment: row.comment ?? undefined,
    createdAt: row.created_at,
  };
}

export async function performTaskWorkflowAction(
  taskId: string,
  action: TaskWorkflowAction,
  comment?: string,
): Promise<ClinicalResult<Task>> {
  const result = await runClinicalMutation('Failed to update task workflow', async () => {
    const supabase = createClient();
    return supabase.rpc('perform_task_workflow_action', {
      p_task_id: taskId,
      p_action: action,
      p_comment: comment?.trim() || null,
    });
  });

  if (result.error || !result.data) {
    return { data: null, error: result.error ?? 'Workflow action failed' };
  }

  const row = result.data as unknown as TaskRow;
  const assigneeIds = await fetchAssigneeIds(taskId);
  return { data: mapTaskFromRow(row, assigneeIds), error: null };
}

export async function fetchTaskWorkflowHistory(
  taskId: string,
  nameMap: Record<string, string> = {},
): Promise<{ data: TaskWorkflowHistoryEntry[]; error: string | null }> {
  const result = await runClinicalListQuery('Failed to load task history', async () => {
    const supabase = createClient();
    return supabase
      .from('task_workflow_history')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });
  });

  if (result.error) {
    return { data: [], error: result.error };
  }

  return {
    data: (result.data as unknown as HistoryRow[]).map((row) =>
      mapHistory(row, nameMap[row.performed_by]),
    ),
    error: null,
  };
}

export async function fetchTasksByStatus(
  statuses: Task['status'][],
): Promise<{ data: Task[]; error: string | null }> {
  const result = await runClinicalListQuery('Failed to load tasks', async () => {
    const supabase = createClient();
    return supabase
      .from('tasks')
      .select('*')
      .is('deleted_at', null)
      .in('status', statuses)
      .order('updated_at', { ascending: true });
  });

  if (result.error) {
    return { data: [], error: result.error };
  }

  const rows = result.data as unknown as TaskRow[];
  const tasks: Task[] = [];
  for (const row of rows) {
    const assigneeIds = await fetchAssigneeIds(row.id);
    tasks.push(mapTaskFromRow(row, assigneeIds.length ? assigneeIds : [row.assigned_to]));
  }

  return { data: tasks, error: null };
}

export async function countTasksByStatus(
  statuses: Task['status'][],
): Promise<number> {
  try {
    const supabase = createClient();
    const { count, error } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .in('status', statuses);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function recordTaskLifecycleEvent(
  taskId: string,
  action: 'created' | 'assigned' | 'reassigned',
  comment?: string,
): Promise<{ error: string | null }> {
  const result = await runClinicalMutation('Failed to record task event', async () => {
    const supabase = createClient();
    return supabase.rpc('record_task_lifecycle_event', {
      p_task_id: taskId,
      p_action: action,
      p_comment: comment?.trim() || null,
    });
  });
  return { error: result.error };
}
