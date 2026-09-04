import type { ComparisonOverallResult, ComparisonResultStatus } from '@/types/comparison-study';
import type { MixingMode } from '@/lib/comparison-studies/mixing-constants';
import {
  MAX_ELAPSED_MINUTES,
  MIN_ELAPSED_MINUTES,
  type MixingModeStatus,
} from '@/lib/comparison-studies/mixing-constants';

export interface MixingCalculationInput {
  firstResult?: number | null;
  finalResult?: number | null;
  taePercent: number;
  timingValid: boolean;
}

export interface MixingCalculationOutput {
  taeValue?: number;
  lowerLimit?: number;
  upperLimit?: number;
  resultStatus: ComparisonResultStatus;
}

export function roundForDisplay(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function calculateElapsedMinutes(initialIso: string, finalIso: string): number | null {
  const initial = new Date(initialIso);
  const final = new Date(finalIso);
  if (Number.isNaN(initial.getTime()) || Number.isNaN(final.getTime())) return null;
  if (final.getTime() < initial.getTime()) return null;
  return Math.round((final.getTime() - initial.getTime()) / 60000);
}

export function isTimingValid(elapsedMinutes: number | null | undefined): boolean {
  if (elapsedMinutes == null) return false;
  return elapsedMinutes >= MIN_ELAPSED_MINUTES && elapsedMinutes <= MAX_ELAPSED_MINUTES;
}

export function formatElapsedDuration(minutes: number | null | undefined): string {
  if (minutes == null) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

export function calculateMixingResult(input: MixingCalculationInput): MixingCalculationOutput {
  const { firstResult, finalResult, taePercent, timingValid } = input;

  if (
    firstResult == null
    || finalResult == null
    || Number.isNaN(firstResult)
    || Number.isNaN(finalResult)
    || firstResult < 0
    || finalResult < 0
  ) {
    return { resultStatus: 'incomplete' };
  }

  const taeValue = firstResult * (taePercent / 100);
  const lowerLimit = firstResult - taeValue;
  const upperLimit = firstResult + taeValue;

  if (!timingValid) {
    return { taeValue, lowerLimit, upperLimit, resultStatus: 'manual_review' };
  }

  const acceptable = finalResult >= lowerLimit && finalResult <= upperLimit;
  return {
    taeValue,
    lowerLimit,
    upperLimit,
    resultStatus: acceptable ? 'acceptable' : 'not_acceptable',
  };
}

export interface MixingResultRow {
  mode: MixingMode;
  resultStatus: ComparisonResultStatus;
}

export function deriveMixingModeStatus(
  results: Array<Pick<MixingResultRow, 'resultStatus'>>,
  samplesHaveTiming: boolean,
): MixingModeStatus {
  if (results.length === 0) return 'incomplete';
  if (results.some((r) => r.resultStatus === 'incomplete')) return 'incomplete';
  if (!samplesHaveTiming || results.some((r) => r.resultStatus === 'manual_review')) {
    return 'timing_review';
  }
  if (results.some((r) => r.resultStatus === 'not_acceptable')) return 'not_acceptable';
  return 'acceptable';
}

export function deriveMixingOverallResult(
  closeResults: Array<Pick<MixingResultRow, 'resultStatus'>>,
  openResults: Array<Pick<MixingResultRow, 'resultStatus'>>,
  closeTimingComplete: boolean,
  openTimingComplete: boolean,
): ComparisonOverallResult {
  const closeStatus = deriveMixingModeStatus(closeResults, closeTimingComplete);
  const openStatus = deriveMixingModeStatus(openResults, openTimingComplete);

  if (closeStatus === 'incomplete' || openStatus === 'incomplete') return 'incomplete';
  if (closeStatus === 'timing_review' || openStatus === 'timing_review') {
    return 'manual_review_required';
  }
  if (closeStatus === 'not_acceptable' || openStatus === 'not_acceptable') {
    return 'not_acceptable';
  }
  return 'acceptable';
}

export function canSubmitMixingStudy(overall: ComparisonOverallResult): boolean {
  return overall === 'acceptable' || overall === 'not_acceptable';
}
