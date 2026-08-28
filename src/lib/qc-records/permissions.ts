import type { Permission } from '@/lib/permissions/roles';
import type { QCRecord } from '@/types';
import { QC_DECISION_LABELS, type QCDecision, type QCFrequency } from './constants';

export function canReviewDailyQC(can: (permission: Permission) => boolean): boolean {
  return can('qc.review_daily');
}

export function canReviewMonthlyQC(can: (permission: Permission) => boolean): boolean {
  return can('qc.review_monthly');
}

export function canReviewQCRecord(
  can: (permission: Permission) => boolean,
  record: QCRecord,
  userId?: string,
): boolean {
  if (record.reviewStatus !== 'Pending Review') return false;
  if (userId && record.performedByUserId === userId) return false;

  if (record.qcFrequency === 'daily') {
    return canReviewDailyQC(can);
  }

  return canReviewMonthlyQC(can);
}

export function canApproveQCRecord(
  can: (permission: Permission) => boolean,
  record: QCRecord,
): boolean {
  if (!can('qc.approve')) return false;
  return record.reviewStatus === 'Reviewed' && record.approvalStatus === 'Pending Approval';
}

export function formatQCFrequencyLabel(frequency: QCFrequency): string {
  return frequency === 'daily' ? 'Daily' : 'Monthly';
}

export function formatQCReviewStatusLabel(status: QCRecord['reviewStatus']): string {
  return status === 'Reviewed' ? 'Reviewed' : 'Pending Review';
}

export function formatQCApprovalStatusLabel(status: QCRecord['approvalStatus']): string {
  return status === 'Approved' ? 'Approved' : 'Pending Approval';
}

export function formatQCDecisionLabel(decision?: QCDecision | null): string {
  if (!decision) return '—';
  return QC_DECISION_LABELS[decision];
}

export function qcDecisionBadgeVariant(
  decision?: QCDecision | null,
): 'success' | 'destructive' | 'warning' | 'secondary' {
  if (decision === 'accept') return 'success';
  if (decision === 'not_accept') return 'destructive';
  if (decision === 'need_follow_up') return 'warning';
  return 'secondary';
}

export function formatQCWorkflowSummary(record: QCRecord): string {
  return `${formatQCFrequencyLabel(record.qcFrequency)} | ${formatQCReviewStatusLabel(record.reviewStatus)} | ${formatQCApprovalStatusLabel(record.approvalStatus)}`;
}
