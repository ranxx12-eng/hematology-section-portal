'use client';

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { MonthlyStainQcGrid } from '@/components/stain-qc/monthly-stain-qc-grid';
import { StainQcResultLegend } from '@/components/stain-qc/stain-qc-result-legend';
import { StainQcWorkflowPanel } from '@/components/stain-qc/stain-qc-workflow-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { computeCompletionSummary } from '@/lib/stain-qc/calendar';
import {
  FORM_HEMA_021_CODE,
  FORM_HEMA_021_TITLE,
  STAIN_QC_OVERALL_EVALUATION_LABELS,
  STAIN_QC_STATUS_LABELS,
} from '@/lib/stain-qc/constants';
import {
  canExportStainQc,
  canRecordOnStainQcSheet,
  isStainQcSheetEditable,
} from '@/lib/stain-qc/permissions';
import {
  fetchStainQcSheetDetail,
  saveStainQcCorrectiveAction,
  transitionStainQcWorkflow,
  updateStainQcSheetHeader,
  upsertStainQcDailyResult,
  recordStainQcResponsibility,
} from '@/lib/clinical/stain-qc';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import { renderStainQcFormPdf } from '@/lib/print/stain-qc-form-pdf';
import type { Permission } from '@/lib/permissions/roles';
import type { Profile } from '@/types';
import type { StainQcMonthlySheetDetail, StainQcOverallEvaluation } from '@/types/stain-qc';
import { monthName } from '@/lib/cv-monitoring/constants';

interface StainQcMonthlyFormProps {
  sheet: StainQcMonthlySheetDetail;
  user: Profile;
  can: (permission: Permission) => boolean;
  onRefresh: (sheet: StainQcMonthlySheetDetail) => void;
}

export function StainQcMonthlyForm({ sheet, user, can, onRefresh }: StainQcMonthlyFormProps) {
  const [saving, setSaving] = useState(false);
  const [lotNumber, setLotNumber] = useState(sheet.lotNumber);
  const [expiryDate, setExpiryDate] = useState(sheet.expiryDate);
  const [overallEvaluation, setOverallEvaluation] = useState<StainQcOverallEvaluation | ''>(sheet.overallEvaluation ?? '');

  const readOnly = !isStainQcSheetEditable(sheet.status);
  const canRecord = canRecordOnStainQcSheet(sheet, can);

  const summary = useMemo(() => computeCompletionSummary({
    criteria: sheet.criteria,
    month: sheet.sheetMonth,
    year: sheet.sheetYear,
    results: sheet.dailyResults,
    correctiveActionResultIds: new Set(sheet.correctiveActions.map((item) => item.dailyResultId)),
  }), [sheet]);

  async function reload() {
    const result = await fetchStainQcSheetDetail(sheet.id);
    if (result.data) onRefresh(result.data);
    if (result.error) toast.error(result.error);
  }

  async function withStaff<T>(fn: (staff: Awaited<ReturnType<typeof resolveStaffContext>>) => Promise<T>) {
    const staff = await resolveStaffContext(user);
    return fn(staff);
  }

  async function saveHeader() {
    setSaving(true);
    const result = await withStaff((staff) => updateStainQcSheetHeader({
      sheetId: sheet.id,
      lotNumber,
      expiryDate,
      overallEvaluation: overallEvaluation || null,
      staff,
    }));
    setSaving(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success('Sheet header saved');
      await reload();
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{FORM_HEMA_021_CODE} · {FORM_HEMA_021_TITLE}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 text-sm">
            <div><span className="text-muted-foreground">Stain:</span> {sheet.stainName}</div>
            <div><span className="text-muted-foreground">Lot Number:</span> {lotNumber || '—'}</div>
            <div><span className="text-muted-foreground">Expiry Date:</span> {expiryDate || '—'}</div>
            <div><span className="text-muted-foreground">Period:</span> {monthName(sheet.sheetMonth)} {sheet.sheetYear}</div>
            <div><Badge variant="secondary">{STAIN_QC_STATUS_LABELS[sheet.status]}</Badge></div>
            <div><span className="text-muted-foreground">Completion:</span> {summary.completionPercent}%</div>
          </div>
          <StainQcResultLegend className="rounded-md border bg-muted/20 p-3" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Monthly Header</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="lot-number">Lot Number *</Label>
            <Input id="lot-number" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} disabled={readOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expiry-date">Expiry Date *</Label>
            <Input id="expiry-date" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} disabled={readOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="overall-evaluation">Overall Evaluation</Label>
            <Select
              value={overallEvaluation || 'unset'}
              onValueChange={(value) => setOverallEvaluation(value === 'unset' ? '' : value as StainQcOverallEvaluation)}
              disabled={readOnly}
            >
              <SelectTrigger id="overall-evaluation"><SelectValue placeholder="Select evaluation" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">Not set</SelectItem>
                {Object.entries(STAIN_QC_OVERALL_EVALUATION_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!readOnly && (
            <div className="flex items-end">
              <Button disabled={saving} onClick={() => void saveHeader()}>Save Header</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Daily QC Grid</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span>Missing entries: {summary.missingCells}</span>
            <span>Not Acceptable: {summary.notAcceptableCells}</span>
            <span>Pending corrective actions: {summary.pendingCorrectiveCount}</span>
          </div>
          <MonthlyStainQcGrid
            criteria={sheet.criteria}
            month={sheet.sheetMonth}
            year={sheet.sheetYear}
            dailyResults={sheet.dailyResults}
            responsibilityEntries={sheet.responsibilityEntries}
            correctiveActions={sheet.correctiveActions}
            readOnly={readOnly}
            canRecord={canRecord}
            onCellChange={async (input) => {
              setSaving(true);
              const result = await withStaff((staff) => upsertStainQcDailyResult({
                sheet: { ...sheet, lotNumber, expiryDate },
                criterionKey: input.criterionKey,
                dayOfMonth: input.dayOfMonth,
                resultStatus: input.resultStatus,
                amendmentReason: input.amendmentReason,
                staff,
                employeeId: user.employeeId,
              }));
              setSaving(false);
              if (result.error) toast.error(result.error);
              else await reload();
            }}
            onCorrectiveSave={async (input) => {
              setSaving(true);
              const result = await withStaff((staff) => saveStainQcCorrectiveAction({
                sheet: { ...sheet, lotNumber, expiryDate },
                dailyResultId: input.dailyResultId,
                criterionKey: input.criterionKey,
                dayOfMonth: input.dayOfMonth,
                comment: input.comment,
                staff,
                employeeId: user.employeeId,
              }));
              setSaving(false);
              if (result.error) toast.error(result.error);
              else await reload();
            }}
            onResponsibilityRecord={async (input) => {
              setSaving(true);
              const result = await withStaff((staff) => recordStainQcResponsibility({
                sheet: { ...sheet, lotNumber, expiryDate },
                responsibilityType: input.responsibilityType,
                dayOfMonth: input.dayOfMonth,
                staff,
                employeeId: user.employeeId,
              }));
              setSaving(false);
              if (result.error) toast.error(result.error);
              else await reload();
            }}
          />
        </CardContent>
      </Card>

      <StainQcWorkflowPanel
        sheet={sheet}
        userId={user.id}
        can={can}
        saving={saving}
        onSubmit={async () => {
          setSaving(true);
          const result = await transitionStainQcWorkflow({ sheetId: sheet.id, action: 'submit' });
          setSaving(false);
          if (result.error) toast.error(result.error);
          else {
            toast.success('Submitted for review');
            await reload();
          }
        }}
        onReview={async () => {
          setSaving(true);
          const result = await transitionStainQcWorkflow({ sheetId: sheet.id, action: 'review' });
          setSaving(false);
          if (result.error) toast.error(result.error);
          else {
            toast.success('Marked reviewed');
            await reload();
          }
        }}
        onApprove={async () => {
          setSaving(true);
          const result = await transitionStainQcWorkflow({ sheetId: sheet.id, action: 'approve' });
          setSaving(false);
          if (result.error) toast.error(result.error);
          else {
            toast.success('Approved');
            await reload();
          }
        }}
      />

      {canExportStainQc(can) && (
        <Button
          variant="outline"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              const blob = await renderStainQcFormPdf(sheet);
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = `${sheet.sheetNumber}-${FORM_HEMA_021_CODE}.pdf`;
              anchor.click();
              URL.revokeObjectURL(url);
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'PDF export failed');
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Export PDF'}
        </Button>
      )}
    </div>
  );
}
