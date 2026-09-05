import { describe, it, expect } from 'vitest';
import type { Task } from '@/types';
import { hasPermission } from '@/lib/permissions/roles';
import {
  canApproveTasks,
  canReviewTasks,
  filterTasksForApprovalCenter,
  filterTasksForReviewCenter,
  getAllowedWorkflowActions,
  isSelfSubmittedTask,
  validateWorkflowTransition,
  workflowActionRequiresComment,
} from '@/lib/tasks/workflow';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Bench review',
    assignedTo: UUID_A,
    assigneeIds: [UUID_A],
    assignedBy: 'user-1',
    priority: 'medium',
    status: 'not_started',
    startDate: '2026-09-01',
    dueDate: '2026-09-15',
    taskType: 'team',
    createdAt: '2026-09-01T08:00:00Z',
    updatedAt: '2026-09-01T08:00:00Z',
    ...overrides,
  };
}

describe('Employee assignment permissions', () => {
  it('quality_officer can view employees for assignment picker', () => {
    expect(hasPermission('quality_officer', 'employees.view')).toBe(true);
    expect(hasPermission('quality_officer', 'tasks.manage')).toBe(true);
  });

  it('senior_lab_technologist can view employees after role update', () => {
    expect(hasPermission('senior_lab_technologist', 'employees.view')).toBe(true);
    expect(hasPermission('senior_lab_technologist', 'tasks.review')).toBe(true);
  });

  it('lab_technologist cannot review or approve tasks', () => {
    expect(hasPermission('lab_technologist', 'tasks.review')).toBe(false);
    expect(hasPermission('lab_technologist', 'tasks.approve')).toBe(false);
  });
});

describe('Task workflow transitions', () => {
  it('allows assignee to start and submit for review', () => {
    const open = makeTask({ status: 'not_started' });
    const inProgress = makeTask({ status: 'in_progress' });
    expect(getAllowedWorkflowActions(open, {
      employeeId: UUID_A,
      canManage: false,
      canReview: false,
      canApprove: false,
    })).toEqual(['start']);
    expect(getAllowedWorkflowActions(inProgress, {
      employeeId: UUID_A,
      canManage: false,
      canReview: false,
      canApprove: false,
    })).toEqual(['submit_review']);
  });

  it('allows reviewer to forward or request changes but not self-review', () => {
    const pending = makeTask({ status: 'pending_review', assigneeIds: [UUID_B] });
    expect(getAllowedWorkflowActions(pending, {
      employeeId: UUID_A,
      canManage: false,
      canReview: true,
      canApprove: false,
    })).toEqual(['forward_approval', 'request_changes_review']);

    const selfTask = makeTask({ status: 'pending_review', assigneeIds: [UUID_A] });
    expect(getAllowedWorkflowActions(selfTask, {
      employeeId: UUID_A,
      canManage: false,
      canReview: true,
      canApprove: false,
    })).toEqual([]);
  });

  it('allows supervisor approval actions only in pending approval', () => {
    const pendingApproval = makeTask({ status: 'pending_approval' });
    expect(getAllowedWorkflowActions(pendingApproval, {
      employeeId: UUID_A,
      canManage: false,
      canReview: true,
      canApprove: true,
    })).toEqual(['approve', 'request_changes_approval', 'reject']);

    expect(getAllowedWorkflowActions(makeTask({ status: 'pending_review', assigneeIds: [UUID_B] }), {
      employeeId: UUID_A,
      canManage: false,
      canReview: true,
      canApprove: true,
    })).toEqual(['forward_approval', 'request_changes_review']);
  });

  it('blocks skipping workflow stages', () => {
    expect(validateWorkflowTransition('pending_review', 'approve').valid).toBe(false);
    expect(validateWorkflowTransition('in_progress', 'approve').valid).toBe(false);
    expect(validateWorkflowTransition('pending_review', 'forward_approval').valid).toBe(true);
  });

  it('requires comments for changes and reject actions', () => {
    expect(workflowActionRequiresComment('request_changes_review')).toBe(true);
    expect(workflowActionRequiresComment('reject')).toBe(true);
    expect(workflowActionRequiresComment('submit_review')).toBe(false);
  });
});

describe('Review and approval centers', () => {
  const tasks = [
    makeTask({ id: 'r1', status: 'pending_review', assigneeIds: [UUID_B], updatedAt: '2026-09-02T10:00:00Z' }),
    makeTask({ id: 'r2', status: 'pending_review', assigneeIds: [UUID_A], updatedAt: '2026-09-01T10:00:00Z' }),
    makeTask({ id: 'a1', status: 'pending_approval', updatedAt: '2026-09-03T10:00:00Z' }),
    makeTask({ id: 'o1', status: 'in_progress' }),
  ];

  it('returns pending review tasks oldest first excluding self submissions', () => {
    const reviewQueue = filterTasksForReviewCenter(tasks, UUID_A);
    expect(reviewQueue.map((t) => t.id)).toEqual(['r1']);
  });

  it('returns pending approval tasks oldest first', () => {
    const approvalQueue = filterTasksForApprovalCenter(tasks);
    expect(approvalQueue.map((t) => t.id)).toEqual(['a1']);
  });

  it('detects self-submitted tasks', () => {
    expect(isSelfSubmittedTask(makeTask({ assigneeIds: [UUID_A] }), UUID_A)).toBe(true);
    expect(isSelfSubmittedTask(makeTask({ assigneeIds: [UUID_B] }), UUID_A)).toBe(false);
  });
});

describe('Role separation for approval', () => {
  it('senior_lab_technologist cannot approve', () => {
    expect(hasPermission('senior_lab_technologist', 'tasks.approve')).toBe(false);
    expect(canApproveTasks('senior_lab_technologist', (p) => hasPermission('senior_lab_technologist', p))).toBe(false);
  });

  it('quality_officer cannot approve', () => {
    expect(hasPermission('quality_officer', 'tasks.approve')).toBe(false);
    expect(canApproveTasks('quality_officer', (p) => hasPermission('quality_officer', p))).toBe(false);
  });

  it('section_supervisor can approve', () => {
    expect(hasPermission('section_supervisor', 'tasks.approve')).toBe(true);
    expect(canApproveTasks('section_supervisor', (p) => hasPermission('section_supervisor', p))).toBe(true);
  });

  it('system_admin can approve and review', () => {
    expect(canApproveTasks('system_admin', (p) => hasPermission('system_admin', p))).toBe(true);
    expect(canReviewTasks('system_admin', (p) => hasPermission('system_admin', p))).toBe(true);
  });

  it('head_of_section cannot approve tasks', () => {
    expect(hasPermission('head_of_section', 'tasks.approve')).toBe(false);
    expect(canApproveTasks('head_of_section', (p) => hasPermission('head_of_section', p))).toBe(false);
  });

  it('team_leader cannot approve tasks', () => {
    expect(hasPermission('team_leader', 'tasks.approve')).toBe(false);
    expect(canApproveTasks('team_leader', (p) => hasPermission('team_leader', p))).toBe(false);
  });

  it('lab_manager cannot access review or approval centers', () => {
    expect(hasPermission('lab_manager', 'tasks.review')).toBe(false);
    expect(canReviewTasks('lab_manager', (p) => hasPermission('lab_manager', p))).toBe(false);
    expect(canApproveTasks('lab_manager', (p) => hasPermission('lab_manager', p))).toBe(false);
  });
});
