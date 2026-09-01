import { describe, expect, it } from 'vitest';
import {
  calculateOverallResult,
  calculatePltSampleResult,
  CENTRIFUGE_PPP_SAMPLE_COUNT,
} from '@/lib/ppm-calibration/centrifuge-ppp-logic';

describe('calculatePltSampleResult', () => {
  it('passes at or below 10.0', () => {
    expect(calculatePltSampleResult(6.4)).toBe('pass');
    expect(calculatePltSampleResult(9.9)).toBe('pass');
    expect(calculatePltSampleResult(10.0)).toBe('pass');
  });

  it('fails above 10.0', () => {
    expect(calculatePltSampleResult(10.1)).toBe('fail');
    expect(calculatePltSampleResult(12.0)).toBe('fail');
  });
});

describe('calculateOverallResult', () => {
  it('fails when any sample fails', () => {
    const samples = [
      { calculatedResult: 'pass' as const },
      { calculatedResult: 'pass' as const },
      { calculatedResult: 'pass' as const },
      { calculatedResult: 'fail' as const },
      { calculatedResult: 'pass' as const },
    ];
    expect(samples).toHaveLength(CENTRIFUGE_PPP_SAMPLE_COUNT);
    expect(calculateOverallResult(samples)).toBe('fail');
  });

  it('passes when all five samples pass', () => {
    const samples = Array.from({ length: CENTRIFUGE_PPP_SAMPLE_COUNT }, () => ({ calculatedResult: 'pass' as const }));
    expect(calculateOverallResult(samples)).toBe('pass');
  });
});
