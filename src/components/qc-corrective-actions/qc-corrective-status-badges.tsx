'use client';

import { Badge } from '@/components/ui/badge';
import type { QcCorrectiveActionStatus, QcCorrectiveMonthlyStatus } from '@/types/qc-corrective-action';
import { QC_CORRECTIVE_ACTION_STATUS_LABELS, QC_CORRECTIVE_MONTHLY_STATUS_LABELS } from '@/lib/qc-corrective-actions/constants';

export function QcCorrectiveActionStatusBadge({ status }: { status: QcCorrectiveActionStatus }) {
  const variant =
    status === 'required' ? 'destructive'
      : status === 'in_progress' ? 'warning'
        : 'success';
  return <Badge variant={variant}>{QC_CORRECTIVE_ACTION_STATUS_LABELS[status]}</Badge>;
}

export function QcCorrectiveMonthlyStatusBadge({ status }: { status?: QcCorrectiveMonthlyStatus }) {
  if (!status) return <Badge variant="secondary">Open</Badge>;
  const variant =
    status === 'approved' ? 'success'
      : status === 'reviewed' ? 'default'
        : status === 'ready_for_review' ? 'default'
          : status === 'returned' ? 'destructive'
            : 'secondary';
  return <Badge variant={variant}>{QC_CORRECTIVE_MONTHLY_STATUS_LABELS[status]}</Badge>;
}

export function RepeatedFailureBadge({ count }: { count: number }) {
  if (count <= 1) return null;
  return <Badge variant="warning">Repeated Failure ×{count}</Badge>;
}
