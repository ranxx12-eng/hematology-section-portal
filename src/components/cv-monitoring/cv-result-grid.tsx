'use client';

import { Fragment } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CvResultStatusBadge } from '@/components/cv-monitoring/cv-status-badges';
import { calculateCvStatistics, roundForDisplay } from '@/lib/cv-monitoring/calculation';
import {
  CV_PREVIOUS_SOURCE_LABELS,
  CV_QUALITY_DISPOSITION_LABELS,
  analytePrintCode,
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

export function CvResultGrid({ record, editable, values, onChange }: CvResultGridProps) {
  const levels = [...record.levels].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="space-y-8">
      {levels.map((level) => {
        const rows = record.results.filter((r) => r.levelId === level.id).sort((a, b) => a.displayOrder - b.displayOrder);
        return (
          <div key={level.id} className="rounded-lg border overflow-x-auto">
            <div className="border-b bg-muted/40 px-4 py-2 font-semibold">
              Level {level.qcLevel}{level.lotNumber ? ` · LOT ${level.lotNumber}` : ''}
            </div>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="p-2 text-left">Analyte</th>
                  <th className="p-2 text-left">CV Limit</th>
                  <th className="p-2 text-left">Prev Mean</th>
                  <th className="p-2 text-left">Prev SD</th>
                  <th className="p-2 text-left">Prev CV</th>
                  <th className="p-2 text-left">Prev Status</th>
                  <th className="p-2 text-left">Curr Mean</th>
                  <th className="p-2 text-left">Curr SD</th>
                  <th className="p-2 text-left">Curr CV</th>
                  <th className="p-2 text-left">Curr Status</th>
                  <th className="p-2 text-left">Comment</th>
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
                  const isHighCv = currCalc.status === 'high_cv';
                  const canEditPrevious = editable && !result.previousSourceRecordId;

                  return (
                    <Fragment key={result.id}>
                      <tr className={`border-b ${isHighCv ? 'bg-destructive/5' : ''}`}>
                        <td className="p-2 font-medium">{analytePrintCode(result.analyteCode)}</td>
                        <td className="p-2">{result.cvLimitSnapshot}%</td>
                        <td className="p-2">
                          <Input type="number" step="any" disabled={!canEditPrevious} className="h-8 w-24" value={row.previousMean ?? ''} onChange={(e) => onChange(result.id, { previousMean: e.target.value })} />
                        </td>
                        <td className="p-2">
                          <Input type="number" step="any" disabled={!canEditPrevious} className="h-8 w-24" value={row.previousSd ?? ''} onChange={(e) => onChange(result.id, { previousSd: e.target.value })} />
                        </td>
                        <td className="p-2">{prevCalc.cvPercent != null ? `${roundForDisplay(prevCalc.cvPercent, 2)}%` : 'N/A'}</td>
                        <td className="p-2"><CvResultStatusBadge status={prevCalc.status} /></td>
                        <td className="p-2">
                          <Input type="number" step="any" disabled={!editable} className="h-8 w-24" value={row.currentMean ?? ''} onChange={(e) => onChange(result.id, { currentMean: e.target.value })} />
                        </td>
                        <td className="p-2">
                          <Input type="number" step="any" disabled={!editable} className="h-8 w-24" value={row.currentSd ?? ''} onChange={(e) => onChange(result.id, { currentSd: e.target.value })} />
                        </td>
                        <td className="p-2">{currCalc.cvPercent != null ? `${roundForDisplay(currCalc.cvPercent, 2)}%` : 'N/A'}</td>
                        <td className="p-2"><CvResultStatusBadge status={currCalc.status} /></td>
                        <td className="p-2">
                          <Input disabled={!editable} className="h-8 min-w-[120px]" value={row.comment ?? ''} onChange={(e) => onChange(result.id, { comment: e.target.value })} />
                        </td>
                      </tr>
                      {result.previousSourceMonitoringNumber && (
                        <tr className="border-b bg-muted/10">
                          <td colSpan={11} className="p-2 text-xs text-muted-foreground">
                            Previous month data sourced from {result.previousSourceMonitoringNumber}
                          </td>
                        </tr>
                      )}
                      {!result.previousSourceMonitoringNumber && result.previousMean == null && !row.previousMean && (
                        <tr className="border-b bg-muted/10">
                          <td colSpan={11} className="p-2 text-xs text-amber-700">
                            Previous approved CV record not found. Enter Previous Month Mean/SD manually with source.
                          </td>
                        </tr>
                      )}
                      {canEditPrevious && editable && (
                        <tr className="border-b">
                          <td colSpan={4} className="p-2">
                            <Label className="text-xs">Manual Previous Source</Label>
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
                            <Input disabled={!row.previousSourceType} placeholder="Reason / source comment (required for manual entry)" value={row.previousManualReason ?? ''} onChange={(e) => onChange(result.id, { previousManualReason: e.target.value })} />
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
      })}
    </div>
  );
}
