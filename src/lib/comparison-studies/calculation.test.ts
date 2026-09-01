import { describe, expect, it } from 'vitest';
import {
  buildStudySummary,
  calculateComparisonResult,
  deriveOverallResult,
} from '@/lib/comparison-studies/calculation';
import type { ComparisonStudyResult } from '@/types/comparison-study';

describe('calculateComparisonResult', () => {
  it('WBC 10 vs 11 is acceptable at 15% TAE', () => {
    const result = calculateComparisonResult({ previousResult: 10, newResult: 11, taeLimit: 15 });
    expect(result.differenceUnits).toBe(1);
    expect(result.differencePercent).toBeCloseTo(10, 2);
    expect(result.resultStatus).toBe('acceptable');
  });

  it('RBC 5 vs 5.5 is not acceptable at 6% TAE', () => {
    const result = calculateComparisonResult({ previousResult: 5, newResult: 5.5, taeLimit: 6 });
    expect(result.differencePercent).toBeCloseTo(10, 2);
    expect(result.resultStatus).toBe('not_acceptable');
  });

  it('previous zero yields manual review', () => {
    const result = calculateComparisonResult({ previousResult: 0, newResult: 2, taeLimit: 15 });
    expect(result.differencePercent).toBeNull();
    expect(result.resultStatus).toBe('manual_review');
  });

  it('ESR 20 vs 25 is acceptable at 30% TAE', () => {
    const result = calculateComparisonResult({ previousResult: 20, newResult: 25, taeLimit: 30 });
    expect(result.differenceUnits).toBe(5);
    expect(result.differencePercent).toBeCloseTo(25, 2);
    expect(result.resultStatus).toBe('acceptable');
  });

  it('ESR 20 vs 28 is not acceptable at 30% TAE', () => {
    const result = calculateComparisonResult({ previousResult: 20, newResult: 28, taeLimit: 30 });
    expect(result.differencePercent).toBeCloseTo(40, 2);
    expect(result.resultStatus).toBe('not_acceptable');
  });
});

describe('deriveOverallResult', () => {
  it('returns acceptable when all acceptable', () => {
    const results = [{ resultStatus: 'acceptable' }] as ComparisonStudyResult[];
    expect(deriveOverallResult(results)).toBe('acceptable');
  });

  it('returns not acceptable when any not acceptable', () => {
    const results = [
      { resultStatus: 'acceptable' },
      { resultStatus: 'not_acceptable' },
    ] as ComparisonStudyResult[];
    expect(deriveOverallResult(results)).toBe('not_acceptable');
  });
});

describe('buildStudySummary', () => {
  it('counts analyte summaries', () => {
    const results = [
      { testCode: 'WBC', testName: 'WBC', resultStatus: 'acceptable' },
      { testCode: 'WBC', testName: 'WBC', resultStatus: 'not_acceptable' },
    ] as ComparisonStudyResult[];
    const summary = buildStudySummary(results, 2);
    expect(summary.analyteSummaries[0]?.acceptable).toBe(1);
    expect(summary.analyteSummaries[0]?.notAcceptable).toBe(1);
  });
});
