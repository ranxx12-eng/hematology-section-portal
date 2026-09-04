import { describe, expect, it } from 'vitest';
import {
  MIXING_TAE_LIMITS,
  MIN_ELAPSED_MINUTES,
  MAX_ELAPSED_MINUTES,
} from '@/lib/comparison-studies/mixing-constants';
import {
  calculateElapsedMinutes,
  calculateMixingResult,
  deriveMixingOverallResult,
  isTimingValid,
} from '@/lib/comparison-studies/mixing-calculation';

describe('calculateMixingResult — WBC', () => {
  const tae = MIXING_TAE_LIMITS.WBC;

  it('First=100 TAE 15% → limits 85–115', () => {
    const calc = calculateMixingResult({
      firstResult: 100,
      finalResult: 115,
      taePercent: tae,
      timingValid: true,
    });
    expect(calc.taeValue).toBe(15);
    expect(calc.lowerLimit).toBe(85);
    expect(calc.upperLimit).toBe(115);
    expect(calc.resultStatus).toBe('acceptable');
  });

  it('Final=116 → Not Acceptable', () => {
    const calc = calculateMixingResult({
      firstResult: 100,
      finalResult: 116,
      taePercent: tae,
      timingValid: true,
    });
    expect(calc.resultStatus).toBe('not_acceptable');
  });
});

describe('calculateMixingResult — RBC', () => {
  it('First=5.00 TAE 6% → limits 4.70–5.30', () => {
    const calc = calculateMixingResult({
      firstResult: 5.0,
      finalResult: 5.3,
      taePercent: MIXING_TAE_LIMITS.RBC,
      timingValid: true,
    });
    expect(calc.taeValue).toBeCloseTo(0.3, 5);
    expect(calc.lowerLimit).toBeCloseTo(4.7, 5);
    expect(calc.upperLimit).toBeCloseTo(5.3, 5);
    expect(calc.resultStatus).toBe('acceptable');
  });
});

describe('calculateMixingResult — HGB', () => {
  it('First=14 TAE 7% → limits 13.02–14.98', () => {
    const calc = calculateMixingResult({
      firstResult: 14,
      finalResult: 14,
      taePercent: MIXING_TAE_LIMITS.HGB,
      timingValid: true,
    });
    expect(calc.taeValue).toBeCloseTo(0.98, 2);
    expect(calc.lowerLimit).toBeCloseTo(13.02, 2);
    expect(calc.upperLimit).toBeCloseTo(14.98, 2);
    expect(calc.resultStatus).toBe('acceptable');
  });
});

describe('calculateMixingResult — PLT', () => {
  it('First=200 TAE 25% → limits 150–250', () => {
    const calc = calculateMixingResult({
      firstResult: 200,
      finalResult: 200,
      taePercent: MIXING_TAE_LIMITS.PLT,
      timingValid: true,
    });
    expect(calc.taeValue).toBe(50);
    expect(calc.lowerLimit).toBe(150);
    expect(calc.upperLimit).toBe(250);
    expect(calc.resultStatus).toBe('acceptable');
  });
});

describe('boundary interpretation', () => {
  const base = { firstResult: 200, taePercent: MIXING_TAE_LIMITS.PLT, timingValid: true };

  it('exact lower boundary → Acceptable', () => {
    expect(calculateMixingResult({ ...base, finalResult: 150 }).resultStatus).toBe('acceptable');
  });

  it('exact upper boundary → Acceptable', () => {
    expect(calculateMixingResult({ ...base, finalResult: 250 }).resultStatus).toBe('acceptable');
  });

  it('below lower → Not Acceptable', () => {
    expect(calculateMixingResult({ ...base, finalResult: 149.99 }).resultStatus).toBe('not_acceptable');
  });

  it('above upper → Not Acceptable', () => {
    expect(calculateMixingResult({ ...base, finalResult: 250.01 }).resultStatus).toBe('not_acceptable');
  });
});

describe('timing validation', () => {
  it('exactly 2 hours → valid', () => {
    expect(isTimingValid(MIN_ELAPSED_MINUTES)).toBe(true);
  });

  it('exactly 4 hours → valid', () => {
    expect(isTimingValid(MAX_ELAPSED_MINUTES)).toBe(true);
  });

  it('1h59m → invalid', () => {
    expect(isTimingValid(MIN_ELAPSED_MINUTES - 1)).toBe(false);
  });

  it('4h01m → invalid', () => {
    expect(isTimingValid(MAX_ELAPSED_MINUTES + 1)).toBe(false);
  });

  it('invalid timing forces manual_review even when TAE passes', () => {
    const calc = calculateMixingResult({
      firstResult: 200,
      finalResult: 200,
      taePercent: MIXING_TAE_LIMITS.PLT,
      timingValid: false,
    });
    expect(calc.resultStatus).toBe('manual_review');
  });
});

describe('calculateElapsedMinutes', () => {
  it('computes elapsed minutes between timestamps', () => {
    const initial = '2026-09-01T08:00:00.000Z';
    const final = '2026-09-01T10:00:00.000Z';
    expect(calculateElapsedMinutes(initial, final)).toBe(120);
  });
});

describe('deriveMixingOverallResult', () => {
  const ok = [{ resultStatus: 'acceptable' as const }];
  const bad = [{ resultStatus: 'not_acceptable' as const }];

  it('both modes acceptable → study acceptable', () => {
    expect(deriveMixingOverallResult(ok, ok, true, true)).toBe('acceptable');
  });

  it('one mode not acceptable → study not acceptable', () => {
    expect(deriveMixingOverallResult(ok, bad, true, true)).toBe('not_acceptable');
  });
});
