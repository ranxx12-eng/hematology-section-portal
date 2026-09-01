import type {
  CvMonitoringResult,
  CvMonitoringSummary,
  CvOverallStatus,
  CvResultStatus,
  CvTrendStatus,
} from '@/types/cv-monitoring';

export interface CvCalculationInput {
  mean?: number | null;
  sd?: number | null;
  cvLimit?: number | null;
}

export interface CvCalculationOutput {
  cvPercent?: number | null;
  status: CvResultStatus;
}

export function roundForDisplay(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function calculateCvStatistics(input: CvCalculationInput): CvCalculationOutput {
  const mean = input.mean;
  const sd = input.sd;

  if (mean == null || sd == null || Number.isNaN(mean) || Number.isNaN(sd)) {
    return { status: 'incomplete' };
  }

  if (mean === 0) {
    return { cvPercent: null, status: 'manual_review' };
  }

  const cvPercent = (sd / Math.abs(mean)) * 100;
  const limit = input.cvLimit;

  if (limit == null) {
    return { cvPercent, status: 'manual_review' };
  }

  const status: CvResultStatus = cvPercent <= limit ? 'ok' : 'high_cv';
  return { cvPercent, status };
}

export function deriveTrendStatus(previousCv?: number | null, currentCv?: number | null): CvTrendStatus | undefined {
  if (previousCv == null || currentCv == null) return undefined;
  if (currentCv < previousCv) return 'improved';
  if (currentCv > previousCv) return 'increased';
  return 'no_change';
}

export function deriveOverallStatus(results: CvMonitoringResult[]): CvOverallStatus {
  if (results.length === 0) return 'incomplete';

  let hasIncomplete = false;
  let hasManualReview = false;
  let hasHighCv = false;

  for (const result of results) {
    if (result.currentStatus === 'incomplete') hasIncomplete = true;
    if (result.currentStatus === 'manual_review') hasManualReview = true;
    if (result.currentStatus === 'high_cv') hasHighCv = true;
  }

  if (hasIncomplete) return 'incomplete';
  if (hasManualReview) return 'manual_review_required';
  if (hasHighCv) return 'high_cv_detected';
  return 'all_within_limit';
}

export function buildCvMonitoringSummary(
  results: CvMonitoringResult[],
  levels: Array<{ id: string; qcLevel: 'N' | 'P' }>,
): CvMonitoringSummary {
  const currentOk = results.filter((r) => r.currentStatus === 'ok').length;
  const currentHighCv = results.filter((r) => r.currentStatus === 'high_cv').length;
  const currentManualReview = results.filter((r) => r.currentStatus === 'manual_review').length;
  const currentIncomplete = results.filter((r) => r.currentStatus === 'incomplete').length;
  const previousOk = results.filter((r) => r.previousStatus === 'ok').length;
  const previousHighCv = results.filter((r) => r.previousStatus === 'high_cv').length;

  const levelSummaries = levels.map((level) => ({
    qcLevel: level.qcLevel,
    analytes: results
      .filter((r) => r.levelId === level.id)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((r) => ({
        analyteCode: r.analyteCode,
        analyteName: r.analyteName,
        currentStatus: r.currentStatus,
      })),
  }));

  return {
    totalAnalytes: results.length,
    currentOk,
    currentHighCv,
    currentManualReview,
    currentIncomplete,
    previousOk,
    previousHighCv,
    overallStatus: deriveOverallStatus(results),
    levelSummaries,
  };
}

export function canApproveCvRecord(results: CvMonitoringResult[]): boolean {
  for (const result of results) {
    if (result.currentStatus === 'manual_review') return false;
    if (result.currentStatus === 'incomplete') return false;
    if (result.currentStatus === 'high_cv') {
      const hasInvestigation = Boolean(
        result.investigation?.trim()
        || result.observation?.trim()
        || result.comment?.trim(),
      );
      if (!hasInvestigation) return false;
    }
  }
  return true;
}

export function recalculateResultRow(
  row: Pick<CvMonitoringResult, 'previousMean' | 'previousSd' | 'currentMean' | 'currentSd' | 'cvLimitSnapshot'>,
): Pick<CvMonitoringResult, 'previousCvPercent' | 'previousStatus' | 'currentCvPercent' | 'currentStatus' | 'cvChange' | 'trendStatus'> {
  const previous = calculateCvStatistics({
    mean: row.previousMean,
    sd: row.previousSd,
    cvLimit: row.cvLimitSnapshot,
  });
  const current = calculateCvStatistics({
    mean: row.currentMean,
    sd: row.currentSd,
    cvLimit: row.cvLimitSnapshot,
  });
  const cvChange = previous.cvPercent != null && current.cvPercent != null
    ? current.cvPercent - previous.cvPercent
    : undefined;

  return {
    previousCvPercent: previous.cvPercent ?? undefined,
    previousStatus: previous.status,
    currentCvPercent: current.cvPercent ?? undefined,
    currentStatus: current.status,
    cvChange,
    trendStatus: deriveTrendStatus(previous.cvPercent, current.cvPercent),
  };
}
