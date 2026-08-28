'use client';

import { useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { ClipboardCheck, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { QCDecisionField } from '@/components/qc-records/qc-decision-field';
import { QCRecordDetailSections } from '@/components/qc-records/qc-record-detail';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/providers/auth-provider';
import { reviewQCRecord } from '@/lib/clinical/qc-records';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import { statusBadgeVariant } from '@/lib/page-utils';
import {
  canReviewQCRecord,
  formatQCApprovalStatusLabel,
  formatQCDecisionLabel,
  formatQCFrequencyLabel,
  formatQCReviewStatusLabel,
  qcDecisionBadgeVariant,
} from '@/lib/qc-records/permissions';
import {
  emptyQCReviewForm,
  qcReviewFormSchema,
  type QCReviewFormData,
} from '@/lib/qc-records/review-schema';
import {
  QC_REVIEW_QUEUE_FILTER_LABELS,
  type QCReviewQueueFilter,
} from '@/lib/qc-records/review-queue';
import { deriveResolutionDisplay } from '@/lib/qc-records/schema';
import { formatDateTime } from '@/lib/utils';
import type { QCFrequency } from '@/lib/qc-records/constants';
import type { QCRecord } from '@/types';

interface QCReviewQueueProps {
  records: QCRecord[];
  frequency: QCFrequency;
  workflowFilter: QCReviewQueueFilter;
  instrumentNames: Record<string, string>;
  locale: string;
  onReviewComplete: () => Promise<void>;
  canReviewThisFrequency: boolean;
}

export function QCReviewQueue({
  records,
  frequency,
  workflowFilter,
  instrumentNames,
  locale,
  onReviewComplete,
  canReviewThisFrequency,
}: QCReviewQueueProps) {
  const { can, user } = useAuth();
  const [viewRecord, setViewRecord] = useState<QCRecord | null>(null);
  const [reviewRecord, setReviewRecord] = useState<QCRecord | null>(null);
  const [reviewForm, setReviewForm] = useState<QCReviewFormData>(() => emptyQCReviewForm());
  const [saving, setSaving] = useState(false);

  const getInstrumentName = (id: string) => instrumentNames[id] ?? id;

  const openReviewDialog = (record: QCRecord) => {
    setReviewRecord(record);
    setReviewForm(emptyQCReviewForm());
  };

  const saveReview = async () => {
    if (!reviewRecord || !user) return;
    const parsed = qcReviewFormSchema.safeParse(reviewForm);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Please complete review fields');
      return;
    }
    setSaving(true);
    const staff = await resolveStaffContext(user);
    const result = await reviewQCRecord(reviewRecord.id, staff, parsed.data);
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('QC record reviewed');
    setReviewRecord(null);
    await onReviewComplete();
  };

  const columns: ColumnDef<QCRecord>[] = useMemo(() => [
    {
      accessorKey: 'recordedAt',
      header: 'Date / Time',
      cell: ({ row }) => formatDateTime(row.original.recordedAt, locale),
    },
    {
      accessorKey: 'instrumentId',
      header: 'Instrument',
      cell: ({ row }) => getInstrumentName(row.original.instrumentId),
    },
    { accessorKey: 'parameter', header: 'Parameter' },
    { accessorKey: 'level', header: 'Level' },
    {
      accessorKey: 'qcStatus',
      header: 'QC Status',
      cell: ({ row }) => (
        <Badge variant={statusBadgeVariant(row.original.qcStatus)}>{row.original.qcStatus}</Badge>
      ),
    },
    {
      id: 'outIndicator',
      header: 'OUT Details',
      cell: ({ row }) => {
        const record = row.original;
        if (record.qcStatus !== 'OUT') return '—';
        const resolution = deriveResolutionDisplay(record.qcStatus, record.resolutionStatus);
        return (
          <div className="space-y-1">
            <Badge variant="destructive" className="text-xs">Corrective Action</Badge>
            <p className="text-xs text-muted-foreground">
              Resolution: {resolution === 'N/A' ? '—' : resolution}
            </p>
          </div>
        );
      },
    },
    {
      accessorKey: 'qcFrequency',
      header: 'Frequency',
      cell: ({ row }) => formatQCFrequencyLabel(row.original.qcFrequency),
    },
    {
      id: 'performedBy',
      header: 'Performed By',
      cell: ({ row }) => row.original.performedByName ?? '—',
    },
    {
      id: 'reviewStatus',
      header: 'Review Status',
      cell: ({ row }) => {
        const record = row.original;
        return (
          <div className="space-y-1">
            <Badge variant={record.reviewStatus === 'Reviewed' ? 'success' : 'warning'}>
              {formatQCReviewStatusLabel(record.reviewStatus)}
            </Badge>
            {record.reviewStatus === 'Reviewed' && (
              <Badge variant={qcDecisionBadgeVariant(record.reviewDecision)} className="text-xs">
                {formatQCDecisionLabel(record.reviewDecision)}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      id: 'approvalStatus',
      header: 'Approval Status',
      cell: ({ row }) => (
        <Badge variant={row.original.approvalStatus === 'Approved' ? 'success' : 'secondary'}>
          {formatQCApprovalStatusLabel(row.original.approvalStatus)}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setViewRecord(row.original)} title="View">
            <Eye className="h-4 w-4" />
          </Button>
          {canReviewThisFrequency && canReviewQCRecord(can, row.original, user?.id) && (
            <Button size="sm" variant="ghost" onClick={() => openReviewDialog(row.original)} title="Review">
              <ClipboardCheck className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ], [can, canReviewThisFrequency, instrumentNames, locale, user?.id]);

  const emptyTitle = workflowFilter === 'pending_review'
    ? frequency === 'monthly'
      ? 'No Monthly QC records are pending review.'
      : 'No Daily QC records are pending review.'
    : `No ${formatQCFrequencyLabel(frequency)} QC records match ${QC_REVIEW_QUEUE_FILTER_LABELS[workflowFilter]}.`;

  if (records.length === 0) {
    return <EmptyState title={emptyTitle} />;
  }

  return (
    <>
      <DataTable columns={columns} data={records} />

      <Dialog open={Boolean(viewRecord)} onOpenChange={(open) => { if (!open) setViewRecord(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>QC Record Details</DialogTitle>
          </DialogHeader>
          {viewRecord && (
            <QCRecordDetailSections
              record={viewRecord}
              instrumentName={getInstrumentName(viewRecord.instrumentId)}
              locale={locale}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reviewRecord)} onOpenChange={(open) => { if (!open) setReviewRecord(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review QC Record</DialogTitle>
          </DialogHeader>
          {reviewRecord && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {formatQCFrequencyLabel(reviewRecord.qcFrequency)} QC · {getInstrumentName(reviewRecord.instrumentId)} · {reviewRecord.parameter}
              </p>
              <QCDecisionField
                idPrefix="qc-review-decision"
                label="Review Decision"
                value={reviewForm.reviewDecision}
                onChange={(reviewDecision) => setReviewForm((prev) => ({ ...prev, reviewDecision }))}
              />
              <div>
                <Label htmlFor="qc-review-comment">Additional Comment</Label>
                <Textarea
                  id="qc-review-comment"
                  value={reviewForm.reviewComment ?? ''}
                  onChange={(e) => setReviewForm((prev) => ({ ...prev, reviewComment: e.target.value }))}
                  rows={3}
                />
              </div>
              <Button onClick={() => void saveReview()} className="w-full" disabled={saving}>
                {saving ? 'Submitting…' : 'Submit Review'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
