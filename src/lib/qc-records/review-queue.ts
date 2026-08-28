import type { QCRecord } from '@/types';
import type { QCFrequency } from './constants';

export const QC_REVIEW_QUEUE_FILTERS = [
  'pending_review',
  'reviewed',
  'pending_approval',
  'approved',
  'all',
] as const;

export type QCReviewQueueFilter = (typeof QC_REVIEW_QUEUE_FILTERS)[number];

export const QC_REVIEW_QUEUE_FILTER_LABELS: Record<QCReviewQueueFilter, string> = {
  pending_review: 'Pending Review',
  reviewed: 'Reviewed',
  pending_approval: 'Pending Supervisor Approval',
  approved: 'Approved',
  all: 'All',
};

export function matchesQCReviewQueueFilter(
  record: QCRecord,
  filter: QCReviewQueueFilter,
): boolean {
  switch (filter) {
    case 'pending_review':
      return record.reviewStatus === 'Pending Review';
    case 'reviewed':
      return record.reviewStatus === 'Reviewed';
    case 'pending_approval':
      return record.reviewStatus === 'Reviewed' && record.approvalStatus === 'Pending Approval';
    case 'approved':
      return record.approvalStatus === 'Approved';
    case 'all':
      return true;
    default:
      return true;
  }
}

export function filterQCReviewQueueRecords(
  records: QCRecord[],
  frequency: QCFrequency,
  workflowFilter: QCReviewQueueFilter,
): QCRecord[] {
  return records
    .filter((record) => record.qcFrequency === frequency)
    .filter((record) => matchesQCReviewQueueFilter(record, workflowFilter))
    .sort((a, b) => {
      if (workflowFilter === 'all') {
        const aPending = a.reviewStatus === 'Pending Review' ? 0 : 1;
        const bPending = b.reviewStatus === 'Pending Review' ? 0 : 1;
        if (aPending !== bPending) return aPending - bPending;
      }
      return b.recordedAt.localeCompare(a.recordedAt);
    });
}

export function countQCPendingReviewByFrequency(
  records: QCRecord[],
  frequency: QCFrequency,
): number {
  return records.filter(
    (record) => record.qcFrequency === frequency && record.reviewStatus === 'Pending Review',
  ).length;
}

export function buildQCReviewCenterHref(
  locale: string,
  options?: {
    frequency?: QCFrequency;
    status?: QCReviewQueueFilter;
  },
): string {
  const params = new URLSearchParams();
  if (options?.frequency) params.set('frequency', options.frequency);
  if (options?.status) params.set('status', options.status);
  const query = params.toString();
  return `/${locale}/quality-control/review${query ? `?${query}` : ''}`;
}
