import type { LotStudyStatus, ReagentLotComparison } from '@/types/inventory-module';

type StudyWorkflowFields = Pick<
  ReagentLotComparison,
  'status' | 'preparedBy' | 'reviewedBy' | 'activatedAt'
>;

export type FormHema022WorkflowUiAction =
  | 'save_draft'
  | 'submit'
  | 'review'
  | 'return_from_review'
  | 'approve'
  | 'return_from_approval'
  | 'activate';

/** Mirrors DB rules in perform_reagent_lot_workflow_action (074/075). */
export function canShowFormHema022WorkflowAction(
  study: StudyWorkflowFields,
  actorUserId: string,
  action: FormHema022WorkflowUiAction,
  canManage: boolean,
): boolean {
  if (!canManage) return false;

  const status = study.status as LotStudyStatus;

  switch (action) {
    case 'save_draft':
    case 'submit':
      return status === 'draft' || status === 'returned';
    case 'review':
    case 'return_from_review':
      return status === 'pending_review' && study.preparedBy !== actorUserId;
    case 'approve':
      return (
        status === 'pending_approval'
        && study.preparedBy !== actorUserId
        && study.reviewedBy !== actorUserId
      );
    case 'return_from_approval':
      return status === 'pending_approval';
    case 'activate':
      return status === 'approved' && !study.activatedAt;
    default:
      return false;
  }
}
