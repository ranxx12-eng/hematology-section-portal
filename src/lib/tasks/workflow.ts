import type { Task } from '@/types';
import type { Permission, Role } from '@/lib/permissions/roles';
import { hasPermission, resolveRole } from '@/lib/permissions/roles';

export type TaskWorkflowAction =
  | 'start'
  | 'submit_review'
  | 'forward_approval'
  | 'request_changes_review'
  | 'approve'
  | 'request_changes_approval'
  | 'reject';

export const TASK_WORKFLOW_ACTION_LABELS: Record<TaskWorkflowAction, string> = {
  start: 'Start',
  submit_review: 'Submit for Review',
  forward_approval: 'Forward to Approval',
  request_changes_review: 'Request Changes',
  approve: 'Approve & Complete',
  request_changes_approval: 'Request Changes',
  reject: 'Reject',
};

export const TASK_STATUS_LABELS: Record<Task['status'], string> = {
  not_started: 'Open',
  in_progress: 'In Progress',
  pending_review: 'Pending Review',
  pending_approval: 'Pending Approval',
  completed: 'Approved / Completed',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};

export interface TaskWorkflowHistoryEntry {
  id: string;
  taskId: string;
  previousStatus?: Task['status'];
  newStatus: Task['status'];
  action: string;
  performedBy: string;
  performerRole?: string;
  performerName?: string;
  comment?: string;
  createdAt: string;
}

const REVIEWER_ROLES: Role[] = [
  'senior_lab_technologist',
  'quality_officer',
  'quality_link',
  'system_admin',
];

const APPROVER_ROLES: Role[] = [
  'section_supervisor',
  'system_admin',
];

export function canReviewTasks(role: Role, can: (p: Permission) => boolean): boolean {
  const resolved = resolveRole(role);
  if (resolved === 'system_admin') return true;
  return REVIEWER_ROLES.includes(resolved) && can('tasks.review');
}

export function canApproveTasks(role: Role, can: (p: Permission) => boolean): boolean {
  const resolved = resolveRole(role);
  if (resolved === 'system_admin') return true;
  return APPROVER_ROLES.includes(resolved) && can('tasks.approve');
}

export function isSelfSubmittedTask(task: Task, employeeId?: string): boolean {
  if (!employeeId) return false;
  return task.assigneeIds.includes(employeeId);
}

export function getAllowedWorkflowActions(
  task: Task,
  options: {
    employeeId?: string;
    canManage: boolean;
    canReview: boolean;
    canApprove: boolean;
  },
): TaskWorkflowAction[] {
  const { employeeId, canManage, canReview, canApprove } = options;
  const isAssignee = employeeId ? task.assigneeIds.includes(employeeId) : false;
  const selfReview = isSelfSubmittedTask(task, employeeId);
  const actions: TaskWorkflowAction[] = [];

  switch (task.status) {
    case 'not_started':
      if (isAssignee || canManage) actions.push('start');
      break;
    case 'in_progress':
      if (isAssignee || canManage) actions.push('submit_review');
      break;
    case 'pending_review':
      if ((canReview || canManage) && !selfReview) {
        actions.push('forward_approval', 'request_changes_review');
      }
      break;
    case 'pending_approval':
      if (canApprove) {
        actions.push('approve', 'request_changes_approval', 'reject');
      }
      break;
    default:
      break;
  }

  return actions;
}

export function workflowActionRequiresComment(action: TaskWorkflowAction): boolean {
  return action === 'request_changes_review'
    || action === 'request_changes_approval'
    || action === 'reject';
}

export function validateWorkflowTransition(
  currentStatus: Task['status'],
  action: TaskWorkflowAction,
): { valid: boolean; nextStatus?: Task['status']; error?: string } {
  const transitions: Record<TaskWorkflowAction, { from: Task['status'][]; to: Task['status'] }> = {
    start: { from: ['not_started'], to: 'in_progress' },
    submit_review: { from: ['in_progress'], to: 'pending_review' },
    forward_approval: { from: ['pending_review'], to: 'pending_approval' },
    request_changes_review: { from: ['pending_review'], to: 'in_progress' },
    approve: { from: ['pending_approval'], to: 'completed' },
    request_changes_approval: { from: ['pending_approval'], to: 'in_progress' },
    reject: { from: ['pending_approval'], to: 'in_progress' },
  };

  const rule = transitions[action];
  if (!rule.from.includes(currentStatus)) {
    return { valid: false, error: `Cannot ${action} from status ${currentStatus}` };
  }
  return { valid: true, nextStatus: rule.to };
}

export function isTaskOverdue(task: Pick<Task, 'dueDate' | 'status'>): boolean {
  if (['completed', 'cancelled'].includes(task.status)) return false;
  const due = new Date(task.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

export interface ReviewQueueItem {
  id: string;
  moduleType: 'task';
  title: string;
  referenceNumber: string;
  submittedBy?: string;
  assigneeNames: string;
  submittedAt: string;
  dueDate: string;
  priority: Task['priority'];
  status: Task['status'];
  href: string;
  overdue: boolean;
}

export function taskToReviewQueueItem(
  task: Task,
  nameMap: Record<string, string>,
  locale: string,
): ReviewQueueItem {
  return {
    id: task.id,
    moduleType: 'task',
    title: task.title,
    referenceNumber: task.id.slice(0, 8).toUpperCase(),
    assigneeNames: task.assigneeIds.map((id) => nameMap[id] ?? id).join(', '),
    submittedAt: task.updatedAt,
    dueDate: task.dueDate,
    priority: task.priority,
    status: task.status,
    href: `/${locale}/tasks?task=${task.id}`,
    overdue: isTaskOverdue(task),
  };
}

export function filterTasksForReviewCenter(
  tasks: Task[],
  employeeId?: string,
): Task[] {
  return tasks
    .filter((t) => t.status === 'pending_review')
    .filter((t) => !employeeId || !t.assigneeIds.includes(employeeId))
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
}

export function filterTasksForApprovalCenter(tasks: Task[]): Task[] {
  return tasks
    .filter((t) => t.status === 'pending_approval')
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
}

export function hasPermissionForWorkflowAction(
  role: Role,
  action: TaskWorkflowAction,
  can: (p: Permission) => boolean,
): boolean {
  switch (action) {
    case 'start':
    case 'submit_review':
      return can('tasks.manage') || can('tasks.view');
    case 'forward_approval':
    case 'request_changes_review':
      return canReviewTasks(role, can);
    case 'approve':
    case 'request_changes_approval':
    case 'reject':
      return canApproveTasks(role, can);
    default:
      return false;
  }
}
