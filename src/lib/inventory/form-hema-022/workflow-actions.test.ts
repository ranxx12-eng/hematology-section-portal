import { describe, expect, it } from 'vitest';
import { canShowFormHema022WorkflowAction } from '@/lib/inventory/form-hema-022/workflow-actions';

const preparerId = 'preparer-uuid';
const reviewerId = 'reviewer-uuid';
const approverId = 'approver-uuid';

describe('canShowFormHema022WorkflowAction', () => {
  it('hides review actions from the preparer on pending_review', () => {
    const study = {
      status: 'pending_review' as const,
      preparedBy: preparerId,
      reviewedBy: undefined,
      activatedAt: undefined,
    };
    expect(canShowFormHema022WorkflowAction(study, preparerId, 'review', true)).toBe(false);
    expect(canShowFormHema022WorkflowAction(study, preparerId, 'return_from_review', true)).toBe(false);
    expect(canShowFormHema022WorkflowAction(study, reviewerId, 'review', true)).toBe(true);
  });

  it('hides approve from preparer and reviewer on pending_approval', () => {
    const study = {
      status: 'pending_approval' as const,
      preparedBy: preparerId,
      reviewedBy: reviewerId,
      activatedAt: undefined,
    };
    expect(canShowFormHema022WorkflowAction(study, preparerId, 'approve', true)).toBe(false);
    expect(canShowFormHema022WorkflowAction(study, reviewerId, 'approve', true)).toBe(false);
    expect(canShowFormHema022WorkflowAction(study, approverId, 'approve', true)).toBe(true);
  });

  it('shows draft actions only in draft or returned', () => {
    const draft = {
      status: 'draft' as const,
      preparedBy: preparerId,
      reviewedBy: undefined,
      activatedAt: undefined,
    };
    expect(canShowFormHema022WorkflowAction(draft, preparerId, 'submit', true)).toBe(true);
    expect(canShowFormHema022WorkflowAction(draft, preparerId, 'review', true)).toBe(false);
  });
});
