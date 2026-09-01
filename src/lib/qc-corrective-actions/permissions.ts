import type { Permission } from '@/lib/permissions/roles';
import type {
  QcCorrectiveMonthlyReview,
  QcCorrectiveWorklistItem,
} from '@/types/qc-corrective-action';
import { canApproveMonth, canMarkMonthReadyForReview } from './calculation';

export function canViewQcCorrectiveActions(can: (permission: Permission) => boolean): boolean {
  return can('qc_corrective.view') || can('qc.view');
}

export function canEditQcCorrectiveActions(can: (permission: Permission) => boolean): boolean {
  return can('qc_corrective.edit') || can('qc.manage');
}

export function canReviewQcCorrectiveMonth(can: (permission: Permission) => boolean): boolean {
  return can('qc_corrective.review') || can('qc.review_daily') || can('qc.review_monthly');
}

export function canApproveQcCorrectiveMonth(can: (permission: Permission) => boolean): boolean {
  return can('qc_corrective.approve') || can('qc.approve');
}

export function canExportQcCorrectiveForm(can: (permission: Permission) => boolean): boolean {
  return can('qc_corrective.export') || canReviewQcCorrectiveMonth(can) || canApproveQcCorrectiveMonth(can);
}

export function canReviewMonthlyCorrectiveAction(
  can: (permission: Permission) => boolean,
  review: QcCorrectiveMonthlyReview | undefined,
  items: QcCorrectiveWorklistItem[],
  userId?: string,
): boolean {
  if (!canReviewQcCorrectiveMonth(can)) return false;
  if (!review) return canMarkMonthReadyForReview(items);
  if (review.status !== 'ready_for_review' && review.status !== 'returned') return false;
  if (userId && review.preparedByUserId === userId) return false;
  return canMarkMonthReadyForReview(items);
}

export function canApproveMonthlyCorrectiveAction(
  can: (permission: Permission) => boolean,
  review: QcCorrectiveMonthlyReview | undefined,
  items: QcCorrectiveWorklistItem[],
  userId?: string,
): boolean {
  if (!canApproveQcCorrectiveMonth(can) || !review) return false;
  if (userId && review.reviewedByUserId === userId) return false;
  return canApproveMonth(items, review.status);
}

export function canPrepareMonthlyCorrectiveAction(
  can: (permission: Permission) => boolean,
  review: QcCorrectiveMonthlyReview | undefined,
  items: QcCorrectiveWorklistItem[],
): boolean {
  if (!canEditQcCorrectiveActions(can)) return false;
  if (review?.status === 'approved') return false;
  return canMarkMonthReadyForReview(items);
}
