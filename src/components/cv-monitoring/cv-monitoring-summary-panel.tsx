'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CvOverallStatusBadge, CvResultStatusBadge } from '@/components/cv-monitoring/cv-status-badges';
import { summarizeCvRecord } from '@/lib/clinical/cv-monitoring';
import { CV_TREND_LABELS, monthAbbreviation, monthName } from '@/lib/cv-monitoring/constants';
import { roundForDisplay } from '@/lib/cv-monitoring/calculation';
import type { CvMonitoringRecord } from '@/types/cv-monitoring';

export function CvMonitoringSummaryPanel({ record }: { record: CvMonitoringRecord }) {
  const summary = summarizeCvRecord(record);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Monthly Summary</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div><span className="text-muted-foreground">Instrument:</span> {record.instrumentNameSnapshot}</div>
          <div><span className="text-muted-foreground">Current:</span> {monthName(record.currentMonth)} {record.currentYear}</div>
          <div><span className="text-muted-foreground">Previous:</span> {monthName(record.previousMonth)} {record.previousYear}</div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Overall:</span>
            <CvOverallStatusBadge status={summary.overallStatus} />
          </div>
          <div><span className="text-muted-foreground">Current OK:</span> {summary.currentOk}</div>
          <div><span className="text-muted-foreground">Current HIGH CV:</span> {summary.currentHighCv}</div>
          <div><span className="text-muted-foreground">Manual Review:</span> {summary.currentManualReview}</div>
          <div><span className="text-muted-foreground">Incomplete:</span> {summary.currentIncomplete}</div>
        </CardContent>
      </Card>

      {summary.levelSummaries.map((levelSummary) => (
        <Card key={levelSummary.qcLevel}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Level {levelSummary.qcLevel}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 text-sm">
            {levelSummary.analytes.map((a) => (
              <div key={a.analyteCode} className="flex items-center gap-2">
                <span className="font-medium">{a.analyteName}</span>
                <CvResultStatusBadge status={a.currentStatus} />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function CvAnalyteComparisonCards({ record }: { record: CvMonitoringRecord }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {record.results.map((result) => {
        const level = record.levels.find((l) => l.id === result.levelId);
        return (
          <Card key={result.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{result.analyteName} — Level {level?.qcLevel}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div>Previous CV ({monthAbbreviation(record.previousMonth)}): {result.previousCvPercent != null ? `${roundForDisplay(result.previousCvPercent, 2)}%` : 'N/A'} — <CvResultStatusBadge status={result.previousStatus} /></div>
              <div>Current CV ({monthAbbreviation(record.currentMonth)}): {result.currentCvPercent != null ? `${roundForDisplay(result.currentCvPercent, 2)}%` : 'N/A'} — <CvResultStatusBadge status={result.currentStatus} /></div>
              <div>Limit: {result.cvLimitSnapshot}%</div>
              {result.trendStatus && <div>Trend: {CV_TREND_LABELS[result.trendStatus]}</div>}
              {result.previousSourceMonitoringNumber && (
                <div className="text-xs text-muted-foreground">Previous sourced from {result.previousSourceMonitoringNumber}</div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
