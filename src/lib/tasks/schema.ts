import { z } from 'zod';
import type { Task } from '@/types';

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export const TASK_STATUSES = ['not_started', 'in_progress', 'pending_review', 'completed', 'overdue', 'cancelled'] as const;
export const TASK_TYPES = ['daily', 'weekly', 'monthly', 'personal', 'team'] as const;
export const TASK_RECURRENCES = ['daily', 'weekly', 'monthly', 'none'] as const;

export const taskFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priority: z.enum(TASK_PRIORITIES),
  assigneeIds: z.array(z.string().uuid()).min(1, 'Select at least one employee'),
  dueDate: z.string().min(1, 'Due date is required'),
  taskType: z.enum(TASK_TYPES).default('personal'),
  recurrence: z.enum(TASK_RECURRENCES).default('none'),
});

export type TaskFormData = z.infer<typeof taskFormSchema>;

export function emptyTaskForm(): TaskFormData {
  return {
    title: '',
    description: '',
    priority: 'medium',
    assigneeIds: [],
    dueDate: new Date().toISOString().slice(0, 10),
    taskType: 'personal',
    recurrence: 'none',
  };
}

export interface TaskSummaryStats {
  open: number;
  overdue: number;
  inProgress: number;
  completed: number;
}

export function computeTaskSummary(tasks: Pick<Task, 'status'>[]): TaskSummaryStats {
  return {
    open: tasks.filter((t) => !['completed', 'cancelled'].includes(t.status)).length,
    overdue: tasks.filter((t) => t.status === 'overdue').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
  };
}

export function taskToForm(task: Task): TaskFormData {
  return {
    title: task.title,
    description: task.description ?? '',
    priority: task.priority,
    assigneeIds: [...task.assigneeIds],
    dueDate: task.dueDate,
    taskType: task.taskType ?? 'personal',
    recurrence: task.recurrence ?? 'none',
  };
}
