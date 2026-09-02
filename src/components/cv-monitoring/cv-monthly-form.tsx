'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { CvAnalyteComparisonCards, CvMonitoringSummaryPanel } from '@/components/cv-monitoring/cv-monitoring-summary-panel';
import { CvMonitoringWorkflow } from '@/components/cv-monitoring/cv-monitoring-workflow';
import { CvResultGrid, type CvResultFormValues } from '@/components/cv-monitoring/cv-result-grid';
import { CvOverallStatusBadge } from '@/components/cv-monitoring/cv-status-badges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  fetchCvMonitoringAuditEvents,
  logCvExport,
  refreshPreviousMonthAutoFill,
  saveCvMonitoringResults,
  saveCvMonitoringSetup,
  submitCvMonitoringRecord,
  reviewCvMonitoringRecord,
  approveCvMonitoringRecord,
} from '@/lib/clinical/cv-monitoring';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import { CV_STATUS_LABELS, FORM_HEMA_015_FOOTER, FORM_HEMA_015_QID, monthName } from '@/lib/cv-monitoring/constants';
import { canExportCvMonitoring, isCvRecordEditable } from '@/lib/cv-monitoring/permissions';
import { downloadCvMonitoringExcel } from '@/lib/cv-monitoring/excel-export';
import { createCvForm015Pdf } from '@/lib/print/cv-form-015-pdf';
import {
  CONTROLLED_FORM_EXPORT_EXCEL_LABEL,
  CONTROLLED_FORM_PRINT_LABEL,
} from '@/lib/print/controlled-form';
import type { Permission } from '@/lib/permissions/roles';
import type { Profile } from '@/types';
import type { CvMonitoringAuditEvent, CvMonitoringRecord } from '@/types/cv-monitoring';

function recordToFormValues(record: CvMonitoringRecord): Record<string, CvResultFormValues> {
  const values: Record<string, CvResultFormValues> = {};
  for (const result of record.results) {
    values[result.id] = {
      previousMean: result.previousMean != null ? String(result.previousMean) : '',
      previousSd: result.previousSd != null ? String(result.previousSd) : '',
      previousSourceType: result.previousSourceType,
      previousManualReason: result.previousManualReason ?? '',
      currentMean: result.currentMean != null ? String(result.currentMean) : '',
      currentSd: result.currentSd != null ? String(result.currentSd) : '',
      comment: result.comment ?? '',
      observation: result.observation ?? '',
      investigation: result.investigation ?? '',
      possibleCause: result.possibleCause ?? '',
      correctiveAction: result.correctiveAction ?? '',
      followUpRequired: result.followUpRequired,
      followUpComment: result.followUpComment ?? '',
      qualityDisposition: result.qualityDisposition,
    };
  }
  return values;
}

interface CvMonthlyFormProps {
  record: CvMonitoringRecord;
  user: Profile;
  can: (permission: Permission) => boolean;
  onRefresh: (record: CvMonitoringRecord) => void;
}

export function CvMonthlyForm({ record, user, can, onRefresh }: CvMonthlyFormProps) {
  const editable = isCvRecordEditable(record);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState(() => recordToFormValues(record));
  const [generalComments, setGeneralComments] = useState(record.generalComments ?? '');
  const [notes, setNotes] = useState(record.notes ?? '');
  const [levelLots, setLevelLots] = useState<Record<'N' | 'P', string>>({
    N: record.levels.find((l) => l.qcLevel === 'N')?.lotNumber ?? '',
    P: record.levels.find((l) => l.qcLevel === 'P')?.lotNumber ?? '',
  });

  useEffect(() => {
    setValues(recordToFormValues(record));
    setGeneralComments(record.generalComments ?? '');
    setNotes(record.notes ?? '');
    setLevelLots({
      N: record.levels.find((l) => l.qcLevel === 'N')?.lotNumber ?? '',
      P: record.levels.find((l) => l.qcLevel === 'P')?.lotNumber ?? '',
    });
  }, [record]);

  const persistResults = async () => {
    setSaving(true);
    const staff = await resolveStaffContext(user);
    const inputs = Object.entries(values).map(([id, row]) => ({
      id,
      previousMean: row.previousMean === '' ? null : Number(row.previousMean),
      previousSd: row.previousSd === '' ? null : Number(row.previousSd),
      previousSourceType: row.previousSourceType,
      previousManualReason: row.previousManualReason,
      currentMean: row.currentMean === '' ? null : Number(row.currentMean),
      currentSd: row.currentSd === '' ? null : Number(row.currentSd),
      comment: row.comment,
      observation: row.observation,
      investigation: row.investigation,
      possibleCause: row.possibleCause,
      correctiveAction: row.correctiveAction,
      followUpRequired: row.followUpRequired,
      followUpComment: row.followUpComment,
      qualityDisposition: row.qualityDisposition,
    }));
    const result = await saveCvMonitoringResults(record.id, staff, inputs, levelLots);
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to save');
      return false;
    }
    onRefresh(result.data);
    toast.success('Statistics saved');
    return true;
  };

  const handleAutoFill = async () => {
    setSaving(true);
    const staff = await resolveStaffContext(user);
    const result = await refreshPreviousMonthAutoFill(record.id, staff);
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Previous approved CV record not found.');
      return;
    }
    onRefresh(result.data);
    toast.success('Previous month auto-populated');
  };

  const exportPdf = async () => {
    const blob = await createCvForm015Pdf(record);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${record.monitoringNumber}-Form-Hema-015.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
    const staff = await resolveStaffContext(user);
    await logCvExport(record.id, staff, 'PDF');
  };

  const exportExcel = async () => {
    const audit = await fetchCvMonitoringAuditEvents(record.id);
    const auditEvents: CvMonitoringAuditEvent[] = audit.data.map((e) => ({
      id: e.id,
      recordId: e.recordId,
      userId: e.userId,
      userName: e.userName,
      staffId: e.staffId,
      action: e.action,
      oldStatus: e.oldStatus,
      newStatus: e.newStatus,
      comment: e.comment,
      metadata: e.metadata,
      createdAt: e.createdAt,
    }));
    downloadCvMonitoringExcel(record, auditEvents);
    const staff = await resolveStaffContext(user);
    await logCvExport(record.id, staff, 'EXCEL');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">MONTHLY CV COMPARISON</h2>
          <Badge variant="secondary">{CV_STATUS_LABELS[record.status] ?? record.status}</Badge>
          <CvOverallStatusBadge status={record.overallStatus} />
        </div>
        <p className="text-sm text-muted-foreground">
          {FORM_HEMA_015_FOOTER} · {FORM_HEMA_015_QID} · {record.monitoringNumber}
        </p>
        <p className="text-sm">
          {monthName(record.currentMonth)} {record.currentYear} · {record.instrumentNameSnapshot}
        </p>
        {canExportCvMonitoring(can) && (
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => void exportPdf()}>{CONTROLLED_FORM_PRINT_LABEL}</Button>
            <Button variant="outline" size="sm" onClick={() => void exportExcel()}>{CONTROLLED_FORM_EXPORT_EXCEL_LABEL}</Button>
          </div>
        )}
      </div>

      <CvMonitoringSummaryPanel record={record} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Level N — Lot Number</Label>
          <Input disabled={!editable} value={levelLots.N} onChange={(e) => setLevelLots((p) => ({ ...p, N: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Level P — Lot Number</Label>
          <Input disabled={!editable} value={levelLots.P} onChange={(e) => setLevelLots((p) => ({ ...p, P: e.target.value }))} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>General Comments</Label>
          <Textarea disabled={!editable} value={generalComments} onChange={(e) => setGeneralComments(e.target.value)} rows={2} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Notes</Label>
          <Textarea disabled={!editable} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
      </div>

      {editable && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={saving} onClick={() => void handleAutoFill()}>Auto-fill Previous Month</Button>
          <Button disabled={saving} onClick={() => void persistResults()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Statistics'}
          </Button>
        </div>
      )}

      <CvResultGrid
        record={record}
        editable={editable}
        values={values}
        onChange={(id, patch) => setValues((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))}
      />

      <CvAnalyteComparisonCards record={record} />

      <CvMonitoringWorkflow
        record={record}
        can={can}
        saving={saving}
        onSubmit={async () => {
          await saveCvMonitoringSetup(record.id, await resolveStaffContext(user), { generalComments, notes });
          const saved = await persistResults();
          if (!saved) return;
          setSaving(true);
          const staff = await resolveStaffContext(user);
          const result = await submitCvMonitoringRecord(record.id, staff);
          setSaving(false);
          if (result.error || !result.data) toast.error(result.error ?? 'Submit failed');
          else { onRefresh(result.data); toast.success('Submitted'); }
        }}
        onReview={async (action, comment) => {
          setSaving(true);
          const staff = await resolveStaffContext(user);
          const result = await reviewCvMonitoringRecord(record.id, staff, { action, comment });
          setSaving(false);
          if (result.error || !result.data) toast.error(result.error ?? 'Review failed');
          else { onRefresh(result.data); toast.success('Review recorded'); }
        }}
        onApprove={async (action, comment) => {
          setSaving(true);
          const staff = await resolveStaffContext(user);
          const result = await approveCvMonitoringRecord(record.id, staff, { action, comment });
          setSaving(false);
          if (result.error || !result.data) toast.error(result.error ?? 'Approval failed');
          else { onRefresh(result.data); toast.success(action === 'approve' ? 'Approved' : 'Action recorded'); }
        }}
      />
    </div>
  );
}
