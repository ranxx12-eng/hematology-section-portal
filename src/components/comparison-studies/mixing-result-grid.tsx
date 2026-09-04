'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ComparisonResultStatusBadge } from '@/components/comparison-studies/comparison-status-badges';
import {
  calculateElapsedMinutes,
  calculateMixingResult,
  formatElapsedDuration,
  isTimingValid,
  roundForDisplay,
} from '@/lib/comparison-studies/mixing-calculation';
import { MIXING_TIMING_INVALID_LABEL } from '@/lib/comparison-studies/mixing-constants';
import type { ComparisonMixingResult, ComparisonMixingSample, MixingMode } from '@/types/comparison-study';

export interface MixingSampleFormValues {
  initialTestTime?: string;
  finalTestTime?: string;
}

export interface MixingResultFormValues {
  firstResult?: string;
  finalResult?: string;
}

interface MixingResultGridProps {
  mode: MixingMode;
  samples: ComparisonMixingSample[];
  results: ComparisonMixingResult[];
  editable: boolean;
  sampleValues: Record<string, MixingSampleFormValues>;
  resultValues: Record<string, MixingResultFormValues>;
  onSampleChange: (sampleId: string, patch: Partial<MixingSampleFormValues>) => void;
  onResultChange: (resultId: string, patch: Partial<MixingResultFormValues>) => void;
}

function toDatetimeLocalValue(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function displayNumber(value?: number): string {
  if (value == null || Number.isNaN(value)) return '—';
  return String(roundForDisplay(value, 4));
}

export function MixingResultGrid({
  mode,
  samples,
  results,
  editable,
  sampleValues,
  resultValues,
  onSampleChange,
  onResultChange,
}: MixingResultGridProps) {
  const modeSamples = [...samples]
    .filter((s) => s.mode === mode)
    .sort((a, b) => a.sampleNumber - b.sampleNumber);

  return (
    <div className="space-y-6">
      {modeSamples.map((sample) => {
        const sampleForm = sampleValues[sample.id] ?? {};
        const initialIso = fromDatetimeLocalValue(sampleForm.initialTestTime ?? toDatetimeLocalValue(sample.initialTestTime));
        const finalIso = fromDatetimeLocalValue(sampleForm.finalTestTime ?? toDatetimeLocalValue(sample.finalTestTime));
        const elapsed = initialIso && finalIso ? calculateElapsedMinutes(initialIso, finalIso) : null;
        const timingValid = isTimingValid(elapsed);
        const sampleResults = results
          .filter((r) => r.mixingSampleId === sample.id)
          .sort((a, b) => a.displayOrder - b.displayOrder);

        return (
          <div key={sample.id} className="rounded-2xl border overflow-hidden">
            <div className="border-b bg-muted/40 px-4 py-3 flex flex-wrap items-end gap-4">
              <p className="font-semibold w-full sm:w-auto">Sample {sample.sampleNumber}</p>
              <div className="space-y-1">
                <Label className="text-xs">Initial Test Time</Label>
                <Input
                  type="datetime-local"
                  disabled={!editable}
                  className="h-9 w-52"
                  value={sampleForm.initialTestTime ?? toDatetimeLocalValue(sample.initialTestTime)}
                  onChange={(e) => onSampleChange(sample.id, { initialTestTime: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Final Test Time</Label>
                <Input
                  type="datetime-local"
                  disabled={!editable}
                  className="h-9 w-52"
                  value={sampleForm.finalTestTime ?? toDatetimeLocalValue(sample.finalTestTime)}
                  onChange={(e) => onSampleChange(sample.id, { finalTestTime: e.target.value })}
                />
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Elapsed: </span>
                <span className="font-medium">{formatElapsedDuration(elapsed)}</span>
                {initialIso && finalIso && !timingValid && (
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">{MIXING_TIMING_INVALID_LABEL}</p>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="p-2 text-left">Parameter</th>
                    <th className="p-2 text-left">TAE %</th>
                    <th className="p-2 text-left">First Result</th>
                    <th className="p-2 text-left">TAE Value</th>
                    <th className="p-2 text-left">Lower Limit</th>
                    <th className="p-2 text-left">Upper Limit</th>
                    <th className="p-2 text-left">Final Result</th>
                    <th className="p-2 text-left">Interpretation</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleResults.map((result) => {
                    const row = resultValues[result.id] ?? {};
                    const first = row.firstResult === '' || row.firstResult == null
                      ? (result.firstResult ?? null)
                      : Number(row.firstResult);
                    const finalVal = row.finalResult === '' || row.finalResult == null
                      ? (result.finalResult ?? null)
                      : Number(row.finalResult);
                    const calc = calculateMixingResult({
                      firstResult: first,
                      finalResult: finalVal,
                      taePercent: result.taePercentSnapshot,
                      timingValid,
                    });

                    return (
                      <tr key={result.id} className="border-b">
                        <td className="p-2 font-medium">{result.testCode}</td>
                        <td className="p-2">{result.taePercentSnapshot}%</td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="any"
                            min={0}
                            disabled={!editable}
                            className="h-8 w-24"
                            value={row.firstResult ?? (result.firstResult != null ? String(result.firstResult) : '')}
                            onChange={(e) => onResultChange(result.id, { firstResult: e.target.value })}
                          />
                        </td>
                        <td className="p-2">{displayNumber(calc.taeValue)}</td>
                        <td className="p-2">{displayNumber(calc.lowerLimit)}</td>
                        <td className="p-2">{displayNumber(calc.upperLimit)}</td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="any"
                            min={0}
                            disabled={!editable}
                            className="h-8 w-24"
                            value={row.finalResult ?? (result.finalResult != null ? String(result.finalResult) : '')}
                            onChange={(e) => onResultChange(result.id, { finalResult: e.target.value })}
                          />
                        </td>
                        <td className="p-2">
                          <MixingInterpretationBadge status={calc.resultStatus} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MixingInterpretationBadge({ status }: { status: ComparisonMixingResult['resultStatus'] }) {
  if (status === 'manual_review') {
    return <ComparisonResultStatusBadge status="manual_review" label="TIMING REVIEW" />;
  }
  if (status === 'acceptable') {
    return <ComparisonResultStatusBadge status="acceptable" label="ACCEPTABLE" />;
  }
  if (status === 'not_acceptable') {
    return <ComparisonResultStatusBadge status="not_acceptable" label="NOT ACCEPTABLE" />;
  }
  return <ComparisonResultStatusBadge status={status} label="INCOMPLETE" />;
}

export function mixingFormToSavePayload(
  samples: ComparisonMixingSample[],
  sampleValues: Record<string, MixingSampleFormValues>,
  resultValues: Record<string, MixingResultFormValues>,
  allResults: ComparisonMixingResult[],
) {
  return {
    samples: samples.map((sample) => {
      const row = sampleValues[sample.id] ?? {};
      return {
        id: sample.id,
        initialTestTime: row.initialTestTime
          ? fromDatetimeLocalValue(row.initialTestTime)
          : sample.initialTestTime ?? null,
        finalTestTime: row.finalTestTime
          ? fromDatetimeLocalValue(row.finalTestTime)
          : sample.finalTestTime ?? null,
      };
    }),
    results: allResults.map((result) => {
      const row = resultValues[result.id] ?? {};
      return {
        id: result.id,
        firstResult: row.firstResult === '' || row.firstResult == null
          ? (result.firstResult ?? null)
          : Number(row.firstResult),
        finalResult: row.finalResult === '' || row.finalResult == null
          ? (result.finalResult ?? null)
          : Number(row.finalResult),
      };
    }),
  };
}
