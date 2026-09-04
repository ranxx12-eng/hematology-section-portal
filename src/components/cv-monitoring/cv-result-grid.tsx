'use client';

import { Fragment, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CvResultStatusBadge } from '@/components/cv-monitoring/cv-status-badges';
import {
  calculateCvStatistics,
  deriveTrendStatus,
  roundForDisplay,
} from '@/lib/cv-monitoring/calculation';
import {
  CV_PREVIOUS_SOURCE_LABELS,
  CV_QUALITY_DISPOSITION_LABELS,
  CV_TREND_LABELS,
  analytePrintCode,
  monthName,
} from '@/lib/cv-monitoring/constants';
import type { CvMonitoringRecord, CvPreviousSourceType, CvQualityDisposition } from '@/types/cv-monitoring';

export interface CvResultFormValues {
  previousMean?: string;
  previousSd?: string;
  previousSourceType?: CvPreviousSourceType;
  previousManualReason?: string;
  currentMean?: string;
  currentSd?: string;
  comment?: string;
  observation?: string;
  investigation?: string;
  possibleCause?: string;
  correctiveAction?: string;
  followUpRequired?: boolean;
  followUpComment?: string;
  qualityDisposition?: CvQualityDisposition;
}

interface CvResultGridProps {
  record: CvMonitoringRecord;
  editable: boolean;
  values: Record<string, CvResultFormValues>;
  onChange: (resultId: string, patch: Partial<CvResultFormValues>) => void;
}

function trendLabel(previousCv?: number | null, currentCv?: number | null): string {
  const trend = deriveTrendStatus(previousCv, currentCv);
  if (!trend) return '—';
  return CV_TREND_LABELS[trend] ?? trend;
}

function LevelComparisonTable({
  record,
  level,
  rows,
  editable,
  values,
  onChange,
}: {
  record: CvMonitoringRecord;
  level: CvMonitoringRecord['levels'][number];
  rows: CvMonitoringRecord['results'];
  editable: boolean;
  values: Record<string, CvResultFormValues>;
  onChange: CvResultGridProps['onChange'];
}) {
  return (
    <div className="rounded-2xl border overflow-x-auto">
      <div className="border-b bg-muted/40 px-4 py-3">
        <p className="font-semibold">Level {level.qcLevel}</p>
        {level.lotNumber && (
          <p className="text-xs text-muted-foreground mt-0.5">Lot: {level.lotNumber}</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Previous: {monthName(record.previousMonth)} {record.previousYear}
          {' · '}
          Current: {monthName(record.currentMonth)} {record.currentYear}
        </p>
      </div>
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/20">
            <th className="p-2 text-left">Test</th>
            <th className="p-2 text-left">CV Limit</th>
            <th className="p-2 text-left bg-muted/30">Prev Mean</th>
            <th className="p-2 text-left bg-muted/30">Prev SD</th>
            <th className="p-2 text-left bg-muted/30">Prev CV %</th>
            <th className="p-2 text-left bg-primary/5">Curr Mean</th>
            <th className="p-2 text-left bg-primary/5">Curr SD</th>
            <th className="p-2 text-left bg-primary/5">Curr CV %</th>
            <th className="p-2 text-left">Change</th>
            <th className="p-2 text-left">Limit Status</th>
            <th className="p-2 text-left">Month Trend</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((result) => {
            const row = values[result.id] ?? {};
            const prevCalc = calculateCvStatistics({
              mean: row.previousMean === '' || row.previousMean == null ? null : Number(row.previousMean),
              sd: row.previousSd === '' || row.previousSd == null ? null : Number(row.previousSd),
              cvLimit: result.cvLimitSnapshot,
            });
            const currCalc = calculateCvStatistics({
              mean: row.currentMean === '' || row.currentMean == null ? null : Number(row.currentMean),
              sd: row.currentSd === '' || row.currentSd == null ? null : Number(row.currentSd),
              cvLimit: result.cvLimitSnapshot,
            });
            const cvChange = prevCalc.cvPercent != null && currCalc.cvPercent != null
              ? currCalc.cvPercent - prevCalc.cvPercent
              : null;
            const isHighCv = currCalc.status === 'high_cv';
            const canEditPrevious = editable && !result.previousSourceRecordId;

            return (
              <Fragment key={result.id}>
                <tr className={`border-b ${isHighCv ? 'bg-destructive/5' : ''}`}>
                  <td className="p-2 font-medium">{analytePrintCode(result.analyteCode)}</td>
                  <td className="p-2">{result.cvLimitSnapshot}%</td>
                  <td className="p-2 bg-muted/10">
                    <Input type="number" step="any" disabled={!canEditPrevious} className="h-8 w-24" value={row.previousMean ?? ''} onChange={(e) => onChange(result.id, { previousMean: e.target.value })} />
                  </td>
                  <td className="p-2 bg-muted/10">
                    <Input type="number" step="any" disabled={!canEditPrevious} className="h-8 w-24" value={row.previousSd ?? ''} onChange={(e) => onChange(result.id, { previousSd: e.target.value })} />
                  </td>
                  <td className="p-2 bg-muted/10">{prevCalc.cvPercent != null ? `${roundForDisplay(prevCalc.cvPercent, 2)}%` : 'N/A'}</td>
                  <td className="p-2 bg-primary/5">
                    <Input type="number" step="any" disabled={!editable} className="h-8 w-24" value={row.currentMean ?? ''} onChange={(e) => onChange(result.id, { currentMean: e.target.value })} />
                  </td>
                  <td className="p-2 bg-primary/5">
                    <Input type="number" step="any" disabled={!editable} className="h-8 w-24" value={row.currentSd ?? ''} onChange={(e) => onChange(result.id, { currentSd: e.target.value })} />
                  </td>
                  <td className="p-2 bg-primary/5">{currCalc.cvPercent != null ? `${roundForDisplay(currCalc.cvPercent, 2)}%` : 'N/A'}</td>
                  <td className="p-2">
                    {cvChange != null ? `${cvChange >= 0 ? '+' : ''}${roundForDisplay(cvChange, 2)} pp` : '—'}
                  </td>
                  <td className="p-2"><CvResultStatusBadge status={currCalc.status} /></td>
                  <td className="p-2 text-xs text-muted-foreground">
                    {trendLabel(prevCalc.cvPercent, currCalc.cvPercent)}
                  </td>
                </tr>
                {result.previousSourceMonitoringNumber && (
                  <tr className="border-b bg-muted/10">
                    <td colSpan={11} className="p-2 text-xs text-muted-foreground">
                      Previous month sourced from approved CV record {result.previousSourceMonitoringNumber}
                      {' '}({monthName(record.previousMonth)} {record.previousYear})
                    </td>
                  </tr>
                )}
                {!result.previousSourceMonitoringNumber && result.previousMean == null && !row.previousMean && (
                  <tr className="border-b bg-amber-50/50 dark:bg-amber-950/20">
                    <td colSpan={11} className="p-2 text-xs text-amber-800 dark:text-amber-200">
                      No approved previous-month record found. Use Manual Historical Entry below with a required reason.
                    </td>
                  </tr>
                )}
                {canEditPrevious && editable && (
                  <tr className="border-b">
                    <td colSpan={4} className="p-2">
                      <Label className="text-xs">Manual Historical Entry — Source</Label>
                      <Select value={row.previousSourceType ?? ''} onValueChange={(v) => onChange(result.id, { previousSourceType: v as CvPreviousSourceType })}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Source" /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(CV_PREVIOUS_SOURCE_LABELS).filter(([k]) => k !== 'auto_from_approved_record').map(([k, label]) => (
                            <SelectItem key={k} value={k}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td colSpan={7} className="p-2">
                      <Input disabled={!row.previousSourceType} placeholder="Reason required for manual previous-month entry" value={row.previousManualReason ?? ''} onChange={(e) => onChange(result.id, { previousManualReason: e.target.value })} />
                    </td>
                  </tr>
                )}
                {isHighCv && editable && (
                  <tr className="border-b bg-destructive/5">
                    <td colSpan={11} className="p-3 space-y-2">
                      <div className="font-medium text-destructive">HIGH CV — Investigation Required</div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <Textarea placeholder="Observation" value={row.observation ?? ''} onChange={(e) => onChange(result.id, { observation: e.target.value })} rows={2} />
                        <Textarea placeholder="Investigation" value={row.investigation ?? ''} onChange={(e) => onChange(result.id, { investigation: e.target.value })} rows={2} />
                        <Textarea placeholder="Possible Cause" value={row.possibleCause ?? ''} onChange={(e) => onChange(result.id, { possibleCause: e.target.value })} />
                        <Textarea placeholder="Corrective Action" value={row.correctiveAction ?? ''} onChange={(e) => onChange(result.id, { correctiveAction: e.target.value })} rows={2} />
                      </div>
                      <Select value={row.qualityDisposition ?? ''} onValueChange={(v) => onChange(result.id, { qualityDisposition: v as CvQualityDisposition })}>
                        <SelectTrigger><SelectValue placeholder="Quality Disposition" /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(CV_QUALITY_DISPOSITION_LABELS).map(([k, label]) => (
                            <SelectItem key={k} value={k}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function CvResultGrid({ record, editable, values, onChange }: CvResultGridProps) {
  const levels = useMemo(
    () => [...record.levels].sort((a, b) => a.displayOrder - b.displayOrder),
    [record.levels],
  );
  const [activeLevel, setActiveLevel] = useState<'N' | 'P'>(levels[0]?.qcLevel ?? 'N');

  return (
    <div className="space-y-4">
      <Tabs value={activeLevel} onValueChange={(v) => setActiveLevel(v as 'N' | 'P')}>
        <TabsList>
          {levels.map((level) => (
            <TabsTrigger key={level.id} value={level.qcLevel}>
              Level {level.qcLevel}
            </TabsTrigger>
          ))}
        </TabsList>
        {levels.map((level) => {
          const rows = record.results.filter((r) => r.levelId === level.id).sort((a, b) => a.displayOrder - b.displayOrder);
          return (
            <TabsContent key={level.id} value={level.qcLevel} className="mt-4">
              <LevelComparisonTable
                record={record}
                level={level}
                rows={rows}
                editable={editable}
                values={values}
                onChange={onChange}
              />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
