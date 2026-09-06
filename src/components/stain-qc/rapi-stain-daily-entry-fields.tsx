'use client';

import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StainQcResultLegend } from '@/components/stain-qc/stain-qc-result-legend';
import { fetchStainQcCriteria } from '@/lib/clinical/stain-qc';
import { FORM_HEMA_021_CODE, STAIN_QC_CONTROLLED_CORRECTIVE_ACTION } from '@/lib/stain-qc/constants';
import { monthName } from '@/lib/shared/month-names';
import type { StainQcCellStatus, StainQcCriterion } from '@/types/stain-qc';
import type { QCRecordFormData } from '@/lib/qc-records/schema';

interface RapiStainDailyEntryFieldsProps {
  form: QCRecordFormData;
  setForm: (form: QCRecordFormData) => void;
}

const STATUS_OPTIONS: { value: StainQcCellStatus; label: string }[] = [
  { value: 'acceptable', label: '✓ Acceptable' },
  { value: 'not_acceptable', label: '✕ Not Acceptable' },
  { value: 'na', label: 'N/A' },
];

export function RapiStainDailyEntryFields({ form, setForm }: RapiStainDailyEntryFieldsProps) {
  const [criteria, setCriteria] = useState<StainQcCriterion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchStainQcCriteria(FORM_HEMA_021_CODE).then((res) => {
      setCriteria(res.data ?? []);
      setLoading(false);
    });
  }, []);

  const entryDate = useMemo(() => new Date(form.recordedAt), [form.recordedAt]);
  const periodLabel = Number.isNaN(entryDate.getTime())
    ? '—'
    : `${monthName(entryDate.getMonth() + 1)} ${entryDate.getFullYear()} · Day ${entryDate.getDate()}`;

  function setResult(criterionKey: string, resultStatus: StainQcCellStatus) {
    const nextResults = { ...(form.rapiStainResults ?? {}), [criterionKey]: resultStatus };
    const nextComments = { ...(form.rapiStainChangeStainComments ?? {}) };
    if (resultStatus !== 'not_acceptable') {
      delete nextComments[criterionKey];
    }
    setForm({
      ...form,
      rapiStainResults: nextResults,
      rapiStainChangeStainComments: nextComments,
    });
  }

  function setChangeStainComment(criterionKey: string, comment: string) {
    setForm({
      ...form,
      rapiStainChangeStainComments: {
        ...(form.rapiStainChangeStainComments ?? {}),
        [criterionKey]: comment,
      },
    });
  }

  return (
    <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
      <div>
        <p className="font-medium">Form-Hema-021 · RAPI Stain QC Daily Checklist</p>
        <p className="text-sm text-muted-foreground">{periodLabel}</p>
      </div>
      <StainQcResultLegend className="text-xs" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="rapi-lot-number">RAPI Stain Lot Number *</Label>
          <Input
            id="rapi-lot-number"
            value={form.rapiStainLotNumber ?? ''}
            onChange={(e) => setForm({ ...form, rapiStainLotNumber: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rapi-expiry-date">Expiry Date *</Label>
          <Input
            id="rapi-expiry-date"
            type="date"
            value={form.rapiStainExpiryDate ?? ''}
            onChange={(e) => setForm({ ...form, rapiStainExpiryDate: e.target.value })}
          />
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading Form-Hema-021 criteria…</p>
      ) : (
        <div className="space-y-3 max-h-[40vh] overflow-y-auto pe-1">
          {criteria.map((criterion) => {
            const status = form.rapiStainResults?.[criterion.criterionKey];
            return (
              <div key={criterion.criterionKey} className="grid gap-2 sm:grid-cols-[1fr_180px] items-start border-b pb-3">
                <div>
                  <p className="text-sm font-medium">{criterion.rowLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {[criterion.componentLabel, criterion.idealColor].filter(Boolean).join(' · ') || criterion.sectionLabel}
                  </p>
                </div>
                <div className="space-y-2">
                  <Select
                    value={status ?? 'unset'}
                    onValueChange={(value) => setResult(criterion.criterionKey, value as StainQcCellStatus)}
                  >
                    <SelectTrigger><SelectValue placeholder="Select result" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset" disabled>Select result</SelectItem>
                      {STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {status === 'not_acceptable' && (
                    <div className="space-y-1">
                      <Label className="text-xs">{STAIN_QC_CONTROLLED_CORRECTIVE_ACTION} required</Label>
                      <Input
                        placeholder="Optional comment"
                        value={form.rapiStainChangeStainComments?.[criterion.criterionKey] ?? ''}
                        onChange={(e) => setChangeStainComment(criterion.criterionKey, e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Results save to Form-Hema-021 stain QC tables. Not Acceptable entries confirm {STAIN_QC_CONTROLLED_CORRECTIVE_ACTION} automatically.
      </p>
    </div>
  );
}

export function isRapiStainDailyEntryComplete(
  form: QCRecordFormData,
  criteria: StainQcCriterion[],
): boolean {
  if (!form.rapiStainLotNumber?.trim() || !form.rapiStainExpiryDate) return false;
  if (criteria.length === 0) return false;
  return criteria.every((criterion) => Boolean(form.rapiStainResults?.[criterion.criterionKey]));
}
