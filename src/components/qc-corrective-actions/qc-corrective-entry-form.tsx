'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { saveQcCorrectiveAction } from '@/lib/clinical/qc-corrective-actions';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import {
  EXPLANATION_PROMPTS,
  QC_CORRECTIVE_ACTION_CODES,
  QC_CORRECTIVE_ACTION_LEGEND,
  QC_CORRECTIVE_RESULT_AFTER_LABELS,
} from '@/lib/qc-corrective-actions/constants';
import { requiresExplanation } from '@/lib/qc-corrective-actions/calculation';
import type { QcCorrectiveActionFormInput, QcCorrectiveWorklistItem } from '@/types/qc-corrective-action';
import { useAuth } from '@/components/providers/auth-provider';
import { formatDateTime } from '@/lib/utils';

interface QcCorrectiveEntryFormProps {
  item: QcCorrectiveWorklistItem;
  locale: string;
  onSaved: () => void;
  onCancel: () => void;
}

export function QcCorrectiveEntryForm({ item, locale, onSaved, onCancel }: QcCorrectiveEntryFormProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<QcCorrectiveActionFormInput>({
    correctedValue: item.correctedValue,
    correctiveActionCode: item.correctiveActionCode,
    explanation: item.explanation,
    remarks: item.remarks,
    resultAfterAction: item.resultAfterAction,
  });

  const explanationRequired = useMemo(
    () => requiresExplanation(form.correctiveActionCode),
    [form.correctiveActionCode],
  );

  async function handleSave() {
    if (!user) {
      toast.error('You must be signed in');
      return;
    }
    setSaving(true);
    const staff = await resolveStaffContext(user);

    const result = await saveQcCorrectiveAction(staff, item.qcRecordId, form, {
      instrumentId: item.instrumentId,
      instrumentName: item.instrumentName,
      analyte: item.analyte,
      qcLevel: item.qcLevel,
      failedValue: item.failedValue,
      operatorName: item.operatorName,
      operatorStaffId: item.operatorStaffId,
      recordedAt: item.recordedAt,
      lotNumber: item.lotNumber,
      expiryDate: item.expiryDate,
      originalQcStatus: item.originalQcStatus,
      existingNotes: item.existingQcCorrectiveNotes,
    });

    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Corrective action saved');
    onSaved();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <h3 className="font-semibold">Source QC Record (Read-only)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Date/Time:</span> {formatDateTime(item.recordedAt, locale)}</div>
          <div><span className="text-muted-foreground">Analyzer:</span> {item.instrumentName}</div>
          <div><span className="text-muted-foreground">QC Material:</span> {item.qcMaterial}</div>
          <div><span className="text-muted-foreground">Operator:</span> {item.operatorName ?? '—'}</div>
          <div><span className="text-muted-foreground">Analyte:</span> {item.analyte}</div>
          <div><span className="text-muted-foreground">QC Level:</span> {item.qcLevel}</div>
          <div><span className="text-muted-foreground">Failed Value:</span> {item.failedValue}</div>
          <div><span className="text-muted-foreground">Original QC Status:</span> {item.originalQcStatus}</div>
          {item.existingQcCorrectiveNotes && (
            <div className="sm:col-span-2">
              <span className="text-muted-foreground">Existing QC Notes:</span> {item.existingQcCorrectiveNotes}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold">Form-Hema-016 Corrective Action</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="correctedValue">Corrected Value</Label>
            <Input
              id="correctedValue"
              value={form.correctedValue ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, correctedValue: e.target.value }))}
              placeholder="Numeric laboratory value"
            />
          </div>
          <div className="space-y-2">
            <Label>Corrective Action</Label>
            <Select
              value={form.correctiveActionCode ?? ''}
              onValueChange={(value) => setForm((prev) => ({
                ...prev,
                correctiveActionCode: value as QcCorrectiveActionFormInput['correctiveActionCode'],
              }))}
            >
              <SelectTrigger><SelectValue placeholder="Select A–I" /></SelectTrigger>
              <SelectContent>
                {QC_CORRECTIVE_ACTION_CODES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code} — {QC_CORRECTIVE_ACTION_LEGEND[code]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Result After Corrective Action</Label>
            <Select
              value={form.resultAfterAction ?? ''}
              onValueChange={(value) => setForm((prev) => ({
                ...prev,
                resultAfterAction: value as QcCorrectiveActionFormInput['resultAfterAction'],
              }))}
            >
              <SelectTrigger><SelectValue placeholder="Select result" /></SelectTrigger>
              <SelectContent>
                {Object.entries(QC_CORRECTIVE_RESULT_AFTER_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {explanationRequired && (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="explanation">
                Explanation {form.correctiveActionCode ? `(${EXPLANATION_PROMPTS[form.correctiveActionCode]})` : ''}
              </Label>
              <Textarea
                id="explanation"
                value={form.explanation ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, explanation: e.target.value }))}
                required
              />
            </div>
          )}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea
              id="remarks"
              value={form.remarks ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
            />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Saving…' : 'Save Corrective Action'}
        </Button>
      </div>
    </div>
  );
}
