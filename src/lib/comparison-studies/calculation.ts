import type {
  ComparisonManualReviewDecision,
  ComparisonOverallResult,
  ComparisonResultStatus,
  ComparisonStudyResult,
  ComparisonStudySummary,
} from '@/types/comparison-study';

export interface ComparisonCalculationInput {
  previousResult?: number | null;
  newResult?: number | null;
  taeLimit?: number | null;
}

export interface ComparisonCalculationOutput {
  differenceUnits?: number;
  differencePercent?: number | null;
  resultStatus: ComparisonResultStatus;
}

export function roundForDisplay(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function calculateComparisonResult(
  input: ComparisonCalculationInput,
): ComparisonCalculationOutput {
  const previous = input.previousResult;
  const next = input.newResult;
  const tae = input.taeLimit;

  if (previous == null || next == null || Number.isNaN(previous) || Number.isNaN(next)) {
    return { resultStatus: 'incomplete' };
  }

  const differenceUnits = next - previous;

  if (previous === 0) {
    return {
      differenceUnits,
      differencePercent: null,
      resultStatus: 'manual_review',
    };
  }

  const differencePercent = (Math.abs(differenceUnits) / Math.abs(previous)) * 100;

  if (tae == null) {
    return {
      differenceUnits,
      differencePercent,
      resultStatus: 'manual_review',
    };
  }

  const resultStatus: ComparisonResultStatus = differencePercent <= tae
    ? 'acceptable'
    : 'not_acceptable';

  return {
    differenceUnits,
    differencePercent,
    resultStatus,
  };
}

export function effectiveResultStatus(result: ComparisonStudyResult): ComparisonResultStatus {
  if (result.resultStatus === 'manual_review' && result.manualReviewDecision) {
    if (result.manualReviewDecision === 'accept') return 'acceptable';
    if (result.manualReviewDecision === 'not_accept') return 'not_acceptable';
    if (result.manualReviewDecision === 'exclude_result') return 'incomplete';
  }
  return result.resultStatus;
}

export function deriveOverallResult(
  results: ComparisonStudyResult[],
): ComparisonOverallResult {
  if (results.length === 0) return 'incomplete';

  let hasIncomplete = false;
  let hasNotAcceptable = false;
  let hasManualReview = false;

  for (const result of results) {
    const status = effectiveResultStatus(result);
    if (status === 'incomplete') hasIncomplete = true;
    if (status === 'not_acceptable') hasNotAcceptable = true;
    if (status === 'manual_review' || (result.resultStatus === 'manual_review' && !result.manualReviewDecision)) {
      hasManualReview = true;
    }
  }

  if (hasIncomplete) return 'incomplete';
  if (hasManualReview) return 'manual_review_required';
  if (hasNotAcceptable) return 'not_acceptable';
  return 'acceptable';
}

export function buildStudySummary(
  results: ComparisonStudyResult[],
  sampleCount: number,
): ComparisonStudySummary {
  const counts = {
    acceptable: 0,
    notAcceptable: 0,
    manualReview: 0,
    incomplete: 0,
  };

  const analyteMap = new Map<string, ComparisonStudySummary['analyteSummaries'][number]>();

  for (const result of results) {
    const status = effectiveResultStatus(result);
    if (status === 'acceptable') counts.acceptable += 1;
    else if (status === 'not_acceptable') counts.notAcceptable += 1;
    else if (status === 'manual_review') counts.manualReview += 1;
    else counts.incomplete += 1;

    const key = result.testCode;
    const existing = analyteMap.get(key) ?? {
      testCode: result.testCode,
      testName: result.testName,
      section: inferSectionFromTestCode(result.testCode),
      acceptable: 0,
      notAcceptable: 0,
      manualReview: 0,
      incomplete: 0,
      total: 0,
    };
    existing.total += 1;
    if (status === 'acceptable') existing.acceptable += 1;
    else if (status === 'not_acceptable') existing.notAcceptable += 1;
    else if (status === 'manual_review') existing.manualReview += 1;
    else existing.incomplete += 1;
    analyteMap.set(key, existing);
  }

  const totalTests = results.length;
  const completed = counts.acceptable + counts.notAcceptable + counts.manualReview;
  const completionPercent = totalTests > 0 ? (completed / totalTests) * 100 : 0;

  return {
    totalSamples: sampleCount,
    totalTests,
    acceptable: counts.acceptable,
    notAcceptable: counts.notAcceptable,
    manualReview: counts.manualReview,
    incomplete: counts.incomplete,
    completionPercent,
    overallResult: deriveOverallResult(results),
    analyteSummaries: [...analyteMap.values()].sort((a, b) => a.testCode.localeCompare(b.testCode)),
  };
}

function inferSectionFromTestCode(testCode: string): ComparisonStudySummary['analyteSummaries'][number]['section'] {
  if (['WBC', 'RBC', 'HGB', 'PLT'].includes(testCode)) return 'CBC';
  if (testCode === 'ESR') return 'ESR';
  return 'COAGULATION';
}

export function matrixSymbol(status: ComparisonResultStatus): string {
  switch (status) {
    case 'acceptable':
      return '✓';
    case 'not_acceptable':
      return '✕';
    case 'manual_review':
      return '!';
    default:
      return '○';
  }
}

export function canApproveStudy(results: ComparisonStudyResult[]): boolean {
  return !results.some(
    (result) => result.resultStatus === 'manual_review' && !result.manualReviewDecision,
  );
}

export function manualReviewDecisionIsValid(
  decision?: ComparisonManualReviewDecision | null,
  comment?: string | null,
): boolean {
  if (!decision) return false;
  return Boolean(comment?.trim());
}
