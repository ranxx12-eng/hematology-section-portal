'use client';

import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';
import { deriveResolutionDisplay, formatCorrectiveActionsSummary } from '@/lib/qc-records/schema';
import {
  formatQCApprovalStatusLabel,
  formatQCDecisionLabel,
  formatQCFrequencyLabel,
  formatQCReviewStatusLabel,
  qcDecisionBadgeVariant,
} from '@/lib/qc-records/permissions';
import type { QCRecord } from '@/types';

interface QCRecordDetailSectionsProps {
  record: QCRecord;
  instrumentName: string;
  locale: string;
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

export function QCRecordDetailSections({ record, instrumentName, locale }: QCRecordDetailSectionsProps) {
  const resolution = deriveResolutionDisplay(record.qcStatus, record.resolutionStatus);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="font-semibold">QC Result</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DetailField label="Date/Time" value={formatDateTime(record.recordedAt, locale)} />
          <DetailField label="Instrument" value={instrumentName} />
          <DetailField label="Parameter" value={record.parameter} />
          <DetailField label="Level" value={record.level || '—'} />
          <DetailField label="QC Frequency" value={formatQCFrequencyLabel(record.qcFrequency)} />
          <DetailField label="QC Status" value={record.qcStatus} />
          <DetailField label="Performed By" value={record.performedByName ?? '—'} />
          <DetailField label="Staff ID" value={record.performedByStaffId ?? '—'} />
          <DetailField label="Comment" value={record.comment ?? '—'} />
        </div>
      </section>

      {record.qcStatus === 'OUT' && (
        <section className="space-y-3">
          <h3 className="font-semibold">Corrective Action & Resolution</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DetailField
              label="Corrective Actions"
              value={formatCorrectiveActionsSummary(record.correctiveActions, record.correctiveActionOther) || '—'}
            />
            <DetailField label="Corrective Action Comment" value={record.correctiveActionComment ?? '—'} />
            <DetailField label="Resolution Status" value={resolution === 'N/A' ? '—' : resolution} />
            <DetailField label="Action By" value={record.actionByName ?? '—'} />
            <DetailField label="Action At" value={record.actionAt ? formatDateTime(record.actionAt, locale) : '—'} />
            <DetailField label="Resolved By" value={record.resolvedByName ?? '—'} />
            <DetailField label="Resolved At" value={record.resolvedAt ? formatDateTime(record.resolvedAt, locale) : '—'} />
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h3 className="font-semibold">Quality Review</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DetailField label="Review Status" value={formatQCReviewStatusLabel(record.reviewStatus)} />
          <DetailField label="Review Decision" value={formatQCDecisionLabel(record.reviewDecision)} />
          <DetailField label="Reviewed By" value={record.reviewedByName ?? '—'} />
          <DetailField label="Staff ID" value={record.reviewedByStaffId ?? '—'} />
          <DetailField label="Reviewed At" value={record.reviewedAt ? formatDateTime(record.reviewedAt, locale) : '—'} />
          <div className="sm:col-span-2">
            <DetailField label="Additional Comment" value={record.reviewComment ?? '—'} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">Supervisor Approval</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DetailField label="Approval Status" value={formatQCApprovalStatusLabel(record.approvalStatus)} />
          <DetailField label="Approval Decision" value={formatQCDecisionLabel(record.approvalDecision)} />
          <DetailField label="Approved By" value={record.approvedByName ?? '—'} />
          <DetailField label="Staff ID" value={record.approvedByStaffId ?? '—'} />
          <DetailField label="Approved At" value={record.approvedAt ? formatDateTime(record.approvedAt, locale) : '—'} />
          <div className="sm:col-span-2">
            <DetailField label="Additional Comment" value={record.approvalComment ?? '—'} />
          </div>
        </div>
      </section>
    </div>
  );
}

export function QCWorkflowBadges({ record }: { record: QCRecord }) {
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant="outline">{formatQCFrequencyLabel(record.qcFrequency)}</Badge>
      <Badge variant={record.reviewStatus === 'Reviewed' ? 'success' : 'warning'}>
        {formatQCReviewStatusLabel(record.reviewStatus)}
      </Badge>
      {record.reviewStatus === 'Reviewed' && (
        <Badge variant={qcDecisionBadgeVariant(record.reviewDecision)}>
          Review: {formatQCDecisionLabel(record.reviewDecision)}
        </Badge>
      )}
      <Badge variant={record.approvalStatus === 'Approved' ? 'success' : 'secondary'}>
        {formatQCApprovalStatusLabel(record.approvalStatus)}
      </Badge>
      {record.approvalStatus === 'Approved' && (
        <Badge variant={qcDecisionBadgeVariant(record.approvalDecision)}>
          Approval: {formatQCDecisionLabel(record.approvalDecision)}
        </Badge>
      )}
    </div>
  );
}
