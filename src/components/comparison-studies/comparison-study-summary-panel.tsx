'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  buildStudySummary,
  effectiveResultStatus,
  matrixSymbol,
} from '@/lib/comparison-studies/calculation';
import { ComparisonOverallResultBadge } from '@/components/comparison-studies/comparison-status-badges';
import type { ComparisonSectionCode, ComparisonStudy } from '@/types/comparison-study';

interface ComparisonStudySummaryPanelProps {
  study: ComparisonStudy;
  activeSection?: ComparisonSectionCode;
}

export function ComparisonStudySummaryPanel({ study, activeSection }: ComparisonStudySummaryPanelProps) {
  const sectionSamples = activeSection
    ? study.samples.filter((s) => s.section === activeSection)
    : study.samples;
  const sectionSampleIds = new Set(sectionSamples.map((s) => s.id));
  const sectionResults = activeSection
    ? study.results.filter((r) => sectionSampleIds.has(r.sampleId))
    : study.results;

  const summary = buildStudySummary(sectionResults, sectionSamples.length);
  const tests = [...new Set(sectionResults.map((r) => r.testCode))];
  const samples = sectionSamples.sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Study Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div><span className="text-muted-foreground">Total Samples:</span> {summary.totalSamples}</div>
          <div><span className="text-muted-foreground">Total Tests:</span> {summary.totalTests}</div>
          <div><span className="text-muted-foreground">Acceptable:</span> {summary.acceptable}</div>
          <div><span className="text-muted-foreground">Not Acceptable:</span> {summary.notAcceptable}</div>
          <div><span className="text-muted-foreground">Manual Review:</span> {summary.manualReview}</div>
          <div><span className="text-muted-foreground">Incomplete:</span> {summary.incomplete}</div>
          <div><span className="text-muted-foreground">Completion:</span> {summary.completionPercent.toFixed(1)}%</div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Overall:</span>
            <ComparisonOverallResultBadge result={summary.overallResult} />
          </div>
        </CardContent>
      </Card>

      {summary.analyteSummaries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Analyte Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {summary.analyteSummaries.map((analyte) => (
              <div key={analyte.testCode} className="flex flex-wrap gap-x-3">
                <span className="font-medium">{analyte.testName}:</span>
                <span>{analyte.acceptable} / {analyte.total} Acceptable</span>
                {analyte.notAcceptable > 0 && <span className="text-destructive">{analyte.notAcceptable} Not Acceptable</span>}
                {analyte.manualReview > 0 && <span className="text-amber-600">{analyte.manualReview} Manual Review</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {tests.length > 0 && samples.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sample Matrix</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left p-2">Test</th>
                  {samples.map((sample) => (
                    <th key={sample.id} className="p-2 text-center">{sample.sampleId}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tests.map((testCode) => (
                  <tr key={testCode} className="border-t">
                    <td className="p-2 font-medium">{testCode}</td>
                    {samples.map((sample) => {
                      const result = sectionResults.find((r) => r.sampleId === sample.id && r.testCode === testCode);
                      const status = result ? effectiveResultStatus(result) : 'incomplete';
                      return (
                        <td key={sample.id} className="p-2 text-center" title={status}>
                          {matrixSymbol(status)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">
              ✓ Acceptable · ✕ Not Acceptable · ! Manual Review · ○ Incomplete
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
