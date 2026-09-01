'use client';

import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ComparisonResultStatusBadge } from '@/components/comparison-studies/comparison-status-badges';
import {
  calculateComparisonResult,
  effectiveResultStatus,
  roundForDisplay,
} from '@/lib/comparison-studies/calculation';
import type { ComparisonStudy, ComparisonStudyResult } from '@/types/comparison-study';

interface ComparisonResultGridProps {
  study: ComparisonStudy;
  section: ComparisonStudy['sections'][number]['section'];
  editable: boolean;
  values: Record<string, { previous?: string; new?: string; issueObservation?: string; correctiveAction?: string; repeatPerformed?: boolean; repeatPrevious?: string; repeatNew?: string; repeatReason?: string }>;
  onChange: (resultId: string, patch: Partial<ComparisonResultGridProps['values'][string]>) => void;
}

export function ComparisonResultGrid({
  study,
  section,
  editable,
  values,
  onChange,
}: ComparisonResultGridProps) {
  const samples = useMemo(
    () => study.samples.filter((s) => s.section === section).sort((a, b) => a.displayOrder - b.displayOrder),
    [study.samples, section],
  );
  const tests = useMemo(() => {
    const sampleIds = new Set(samples.map((s) => s.id));
    const codes = [...new Set(study.results.filter((r) => sampleIds.has(r.sampleId)).map((r) => r.testCode))];
    return codes.map((code) => study.results.find((r) => r.testCode === code)).filter(Boolean) as ComparisonStudyResult[];
  }, [study.results, samples]);

  const preview = (result: ComparisonStudyResult, previous?: string, next?: string) => {
    const prevNum = previous === '' || previous == null ? null : Number(previous);
    const newNum = next === '' || next == null ? null : Number(next);
    return calculateComparisonResult({
      previousResult: prevNum,
      newResult: newNum,
      taeLimit: result.taeLimitSnapshot,
    });
  };

  return (
    <div className="space-y-6 overflow-x-auto">
      {samples.map((sample) => (
        <div key={sample.id} className="rounded-lg border">
          <div className="border-b bg-muted/40 px-4 py-2 font-medium">Sample: {sample.sampleId}</div>
          <div className="divide-y">
            {tests.map((testTemplate) => {
              const result = study.results.find((r) => r.sampleId === sample.id && r.testCode === testTemplate.testCode);
              if (!result) return null;
              const row = values[result.id] ?? {};
              const calc = preview(result, row.previous, row.new);
              const displayStatus = calc.resultStatus;

              return (
                <div key={result.id} className="grid gap-3 p-4 lg:grid-cols-12 lg:items-end">
                  <div className="lg:col-span-2">
                    <div className="font-medium">{result.testName}</div>
                    <div className="text-xs text-muted-foreground">{result.unit}</div>
                  </div>
                  <div className="lg:col-span-2 space-y-1">
                    <Label className="text-xs">Previous / Reference</Label>
                    <Input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      disabled={!editable}
                      value={row.previous ?? ''}
                      onChange={(e) => onChange(result.id, { previous: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <div className="lg:col-span-2 space-y-1">
                    <Label className="text-xs">New / Comparison</Label>
                    <Input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      disabled={!editable}
                      value={row.new ?? ''}
                      onChange={(e) => onChange(result.id, { new: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <div className="lg:col-span-2 text-sm">
                    <div>Diff: {calc.differenceUnits != null ? `${calc.differenceUnits >= 0 ? '+' : ''}${roundForDisplay(calc.differenceUnits, 3)} ${result.unit}` : '—'}</div>
                    <div>Diff %: {calc.differencePercent != null ? `${roundForDisplay(calc.differencePercent, 2)}%` : 'N/A'}</div>
                    <div>TAE: {result.taeLimitSnapshot != null ? `${result.taeLimitSnapshot}%` : '—'}</div>
                  </div>
                  <div className="lg:col-span-2">
                    <ComparisonResultStatusBadge status={displayStatus} />
                  </div>
                  {displayStatus === 'not_acceptable' && editable && (
                    <div className="lg:col-span-12 grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Issue / Observation</Label>
                        <Textarea
                          value={row.issueObservation ?? ''}
                          onChange={(e) => onChange(result.id, { issueObservation: e.target.value })}
                          rows={2}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Corrective Action</Label>
                        <Textarea
                          value={row.correctiveAction ?? ''}
                          onChange={(e) => onChange(result.id, { correctiveAction: e.target.value })}
                          rows={2}
                        />
                      </div>
                    </div>
                  )}
                  {result.resultStatus === 'manual_review' && result.manualReviewDecision && (
                    <div className="lg:col-span-12 text-xs text-muted-foreground">
                      Review decision: {result.manualReviewDecision} — {result.manualReviewComment}
                    </div>
                  )}
                  {!editable && effectiveResultStatus(result) !== displayStatus && (
                    <div className="lg:col-span-12 text-xs text-muted-foreground">
                      Stored status: {effectiveResultStatus(result)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
