import type { Permission } from '@/lib/permissions/roles';
import type { QCRecord } from '@/types';
import type { QCFrequency } from './constants';

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

export function formatQCWorkflowSummary(record: QCRecord): string {
  return `${formatQCFrequencyLabel(record.qcFrequency)} | ${formatQCReviewStatusLabel(record.reviewStatus)} | ${formatQCApprovalStatusLabel(record.approvalStatus)}`;
}
