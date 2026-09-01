'use client';

import { useMemo, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  calculateOverallResult,
  calculatePltSampleResult,
  canEditCentrifugePppCalibration,
  formatPltResult,
  formatSampleLabel,
  getFailedSamples,
  PLT_ACCEPTANCE_THRESHOLD,
  PLT_UNIT,
} from '@/lib/ppm-calibration/centrifuge-ppp-logic';
import { centrifugePppDraftSchema, type CentrifugePppDraftFormData } from '@/lib/ppm-calibration/centrifuge-ppp-schema';
import type { CentrifugePppCalibration } from '@/types/centrifuge-ppp-calibration';

interface CentrifugePppFormProps {
  calibration: CentrifugePppCalibration;
  editable: boolean;
  saving?: boolean;
  onSave: (form: CentrifugePppDraftFormData) => Promise<void>;
  onUploadEvidence: (sampleNumber: number, file: File, replacementReason?: string) => Promise<void>;
  onViewEvidence: (sampleNumber: number) => Promise<void>;
}

export function CentrifugePppForm({
  calibration,
  editable,
  saving,
  onSave,
  onUploadEvidence,
  onViewEvidence,
}: CentrifugePppFormProps) {
  const [form, setForm] = useState<CentrifugePppDraftFormData>(() => ({
    calibrationDate: calibration.calibrationDate,
    nextDueDate: calibration.nextDueDate,
    comment: calibration.comment,
    problem: calibration.problem,
    correctiveAction: calibration.correctiveAction,
    samples: calibration.samples.map((sample) => ({
      sampleNumber: sample.sampleNumber,
      pltResult: sample.pltResult ?? 0,
      centrifugeSpeedRpm: sample.centrifugeSpeedRpm ?? 0,
      centrifugeTimeMinutes: sample.centrifugeTimeMinutes ?? 0,
    })),
  }));
  const [uploadingSample, setUploadingSample] = useState<number | null>(null);

  const computedSamples = useMemo(
    () => form.samples.map((sample) => ({
      ...sample,
      calculatedResult: sample.pltResult > 0 ? calculatePltSampleResult(sample.pltResult) : undefined,
    })),
    [form.samples],
  );

  const overallResult = useMemo(
    () => calculateOverallResult(computedSamples.map((s) => ({ calculatedResult: s.calculatedResult }))),
    [computedSamples],
  );

  const failedSamples = useMemo(() => {
    return computedSamples.filter((s) => s.calculatedResult === 'fail');
  }, [computedSamples]);

  const save = async () => {
    const parsed = centrifugePppDraftSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid form');
      return;
    }
    await onSave(parsed.data);
  };

  const handleEvidenceUpload = async (sampleNumber: number, file: File | undefined) => {
    if (!file) return;
    const existing = calibration.samples.find((s) => s.sampleNumber === sampleNumber);
    let replacementReason: string | undefined;
    if (existing?.evidencePath) {
      replacementReason = window.prompt('Reason for replacing evidence:') ?? undefined;
      if (!replacementReason?.trim()) {
        toast.error('Replacement reason is required.');
        return;
      }
    }
    setUploadingSample(sampleNumber);
    await onUploadEvidence(sampleNumber, file, replacementReason);
    setUploadingSample(null);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4 space-y-2">
        <h2 className="text-lg font-semibold">Centrifuge Calibration Verification for Platelet Poor Plasma</h2>
        <p className="text-sm text-muted-foreground">Form-Hema-009</p>
        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          <p><span className="font-medium">Calibration Date:</span>{' '}
            {editable ? (
              <Input
                type="date"
                className="mt-1"
                value={form.calibrationDate}
                onChange={(e) => setForm((prev) => ({ ...prev, calibrationDate: e.target.value }))}
              />
            ) : calibration.calibrationDate}
          </p>
          <p><span className="font-medium">Next Due Date:</span>{' '}
            {editable ? (
              <Input
                type="date"
                className="mt-1"
                value={form.nextDueDate ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, nextDueDate: e.target.value || undefined }))}
              />
            ) : (calibration.nextDueDate ?? '—')}
          </p>
          <p className="sm:col-span-2">
            <span className="font-medium">Acceptance Criteria:</span> PLT ≤ {PLT_ACCEPTANCE_THRESHOLD} {PLT_UNIT}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left">Sample</th>
              <th className="p-3 text-left">PLT Result {PLT_UNIT}</th>
              <th className="p-3 text-left">Speed RPM</th>
              <th className="p-3 text-left">Time min</th>
              <th className="p-3 text-left">Result</th>
              <th className="p-3 text-left">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {computedSamples.map((sample) => {
              const evidence = calibration.samples.find((s) => s.sampleNumber === sample.sampleNumber);
              return (
                <tr key={sample.sampleNumber} className="border-t">
                  <td className="p-3 font-medium">{formatSampleLabel(sample.sampleNumber)}</td>
                  <td className="p-3">
                    {editable ? (
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        value={sample.pltResult || ''}
                        onChange={(e) => setForm((prev) => ({
                          ...prev,
                          samples: prev.samples.map((row) => row.sampleNumber === sample.sampleNumber
                            ? { ...row, pltResult: Number(e.target.value) }
                            : row),
                        }))}
                      />
                    ) : formatPltResult(sample.pltResult)}
                  </td>
                  <td className="p-3">
                    {editable ? (
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        value={sample.centrifugeSpeedRpm || ''}
                        onChange={(e) => setForm((prev) => ({
                          ...prev,
                          samples: prev.samples.map((row) => row.sampleNumber === sample.sampleNumber
                            ? { ...row, centrifugeSpeedRpm: Number(e.target.value) }
                            : row),
                        }))}
                      />
                    ) : (sample.centrifugeSpeedRpm ?? '—')}
                  </td>
                  <td className="p-3">
                    {editable ? (
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        value={sample.centrifugeTimeMinutes || ''}
                        onChange={(e) => setForm((prev) => ({
                          ...prev,
                          samples: prev.samples.map((row) => row.sampleNumber === sample.sampleNumber
                            ? { ...row, centrifugeTimeMinutes: Number(e.target.value) }
                            : row),
                        }))}
                      />
                    ) : (sample.centrifugeTimeMinutes ?? '—')}
                  </td>
                  <td className="p-3">
                    {sample.calculatedResult ? (
                      <Badge variant={sample.calculatedResult === 'pass' ? 'default' : 'destructive'}>
                        {sample.calculatedResult.toUpperCase()}
                      </Badge>
                    ) : '—'}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col gap-2">
                      <span>{evidence?.evidencePath ? '✓ Attached' : 'Missing'}</span>
                      {evidence?.evidencePath && (
                        <Button type="button" size="sm" variant="outline" onClick={() => void onViewEvidence(sample.sampleNumber)}>
                          View Evidence
                        </Button>
                      )}
                      {editable && canEditCentrifugePppCalibration(calibration.status) && (
                        <Label className="cursor-pointer">
                          <Input
                            type="file"
                            accept=".pdf,image/jpeg,image/png,image/jpg"
                            className="hidden"
                            onChange={(e) => void handleEvidenceUpload(sample.sampleNumber, e.target.files?.[0])}
                          />
                          <span className="inline-flex items-center gap-1 text-xs text-primary">
                            {uploadingSample === sample.sampleNumber ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                            Upload
                          </span>
                        </Label>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border p-4">
        <p className="font-semibold">
          Overall Result:{' '}
          {overallResult ? (
            <Badge variant={overallResult === 'pass' ? 'default' : 'destructive'}>{overallResult.toUpperCase()}</Badge>
          ) : '—'}
        </p>
      </div>

      {(overallResult === 'fail' || getFailedSamples(calibration.samples).length > 0) && (
        <div className="rounded-lg border border-destructive/30 p-4 space-y-3">
          <h3 className="font-semibold text-destructive">Failed Samples</h3>
          <ul className="text-sm space-y-1">
            {(failedSamples.length > 0 ? failedSamples : getFailedSamples(calibration.samples)).map((sample) => (
              <li key={sample.sampleNumber}>
                {formatSampleLabel(sample.sampleNumber)} — PLT {sample.pltResult ?? calibration.samples.find((s) => s.sampleNumber === sample.sampleNumber)?.pltResult} {PLT_UNIT}
              </li>
            ))}
          </ul>
          <div>
            <Label>Problem</Label>
            {editable ? (
              <Textarea
                value={form.problem ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, problem: e.target.value }))}
                rows={2}
              />
            ) : (calibration.problem ?? '—')}
          </div>
          <div>
            <Label>Corrective Action</Label>
            {editable ? (
              <Textarea
                value={form.correctiveAction ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, correctiveAction: e.target.value }))}
                rows={2}
              />
            ) : (calibration.correctiveAction ?? '—')}
          </div>
          <div>
            <Label>Comment</Label>
            {editable ? (
              <Textarea
                value={form.comment ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, comment: e.target.value }))}
                rows={2}
              />
            ) : (calibration.comment ?? '—')}
          </div>
        </div>
      )}

      {editable && (
        <Button className="w-full" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save Draft'}
        </Button>
      )}
    </div>
  );
}
