import {
  CBC_TOTAL_RUNS,
  SDI_ACCEPTANCE_THRESHOLD,
} from '@/lib/qc-lot-verification/constants';
import type {
  QcLotVerificationParameter,
  QcLotVerificationProgress,
  QcLotVerificationRun,
  QcLotVerificationSummary,
  QcVerificationParameterResult,
} from '@/types/qc-lot-verification';

export interface CbcParameterInput {
  manufacturerMean?: number | null;
  manufacturerSd?: number | null;
  establishedMean?: number | null;
  establishedSd?: number | null;
}

export interface CbcParameterCalculation {
  manufacturerLower?: number;
  manufacturerUpper?: number;
  establishedLower?: number;
  establishedUpper?: number;
  difference?: number;
  sdi?: number;
  result: QcVerificationParameterResult;
  manualReviewNote?: string;
}

export function evaluateSdiAcceptance(sdi: number): 'pass' | 'fail' {
  return Math.abs(sdi) < SDI_ACCEPTANCE_THRESHOLD ? 'pass' : 'fail';
}

export function calculateCbcParameter(input: CbcParameterInput): CbcParameterCalculation {
  const {
    manufacturerMean,
    manufacturerSd,
    establishedMean,
    establishedSd,
  } = input;

  const allPresent =
    manufacturerMean != null &&
    manufacturerSd != null &&
    establishedMean != null &&
    establishedSd != null &&
    !Number.isNaN(manufacturerMean) &&
    !Number.isNaN(manufacturerSd) &&
    !Number.isNaN(establishedMean) &&
    !Number.isNaN(establishedSd);

  if (!allPresent) {
    return { result: 'incomplete' };
  }

  const manufacturerLower = manufacturerMean - manufacturerSd;
  const manufacturerUpper = manufacturerMean + manufacturerSd;
  const establishedLower = establishedMean - 2 * establishedSd;
  const establishedUpper = establishedMean + 2 * establishedSd;
  const difference = establishedMean - manufacturerMean;

  if (manufacturerSd === 0) {
    return {
      manufacturerLower,
      manufacturerUpper,
      establishedLower,
      establishedUpper,
      difference,
      result: 'manual_review',
      manualReviewNote: 'Manufacturer SD is zero; SDI cannot be calculated.',
    };
  }

  const sdi = difference / manufacturerSd;
  const result = evaluateSdiAcceptance(sdi);

  return {
    manufacturerLower,
    manufacturerUpper,
    establishedLower,
    establishedUpper,
    difference,
    sdi,
    result,
  };
}

export function buildRunProgress(runs: QcLotVerificationRun[]): QcLotVerificationProgress {
  const completedRuns = runs.filter((r) => r.completed).length;
  const percent = CBC_TOTAL_RUNS === 0 ? 0 : Math.round((completedRuns / CBC_TOTAL_RUNS) * 100);
  const dayProgress = Array.from({ length: 5 }, (_, i) => {
    const dayNumber = i + 1;
    const dayRuns = runs.filter((r) => r.dayNumber === dayNumber);
    const completed = dayRuns.filter((r) => r.completed).length;
    return { dayNumber, completed, total: 4 };
  });
  return {
    completedRuns,
    totalRuns: CBC_TOTAL_RUNS,
    percent,
    runsComplete: completedRuns >= CBC_TOTAL_RUNS,
    dayProgress,
  };
}

export function buildParameterSummary(parameters: QcLotVerificationParameter[]): QcLotVerificationSummary {
  return {
    totalParameters: parameters.length,
    passed: parameters.filter((p) => p.result === 'pass').length,
    failed: parameters.filter((p) => p.result === 'fail').length,
    manualReview: parameters.filter((p) => p.result === 'manual_review').length,
    incomplete: parameters.filter((p) => p.result === 'incomplete').length,
  };
}

export function canSubmitCbcVerification(
  runs: QcLotVerificationRun[],
  parameters: QcLotVerificationParameter[],
): { ok: boolean; reason?: string } {
  const progress = buildRunProgress(runs);
  if (!progress.runsComplete) {
    return { ok: false, reason: 'All 20 runs must be completed before submit.' };
  }
  const summary = buildParameterSummary(parameters);
  if (summary.incomplete > 0) {
    return { ok: false, reason: 'All CBC parameter values must be entered before submit.' };
  }
  return { ok: true };
}

export function isStudyVerifiedForUse(input: {
  status: string;
  verificationType: string;
  finalDecision?: string | null;
}): boolean {
  if (input.status !== 'approved') return false;
  if (!input.finalDecision) return false;
  return [
    'verification_acceptable',
    'established_data_acceptable',
    'reestablished_data_acceptable',
  ].includes(input.finalDecision);
}
