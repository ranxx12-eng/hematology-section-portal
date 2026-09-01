import { describe, expect, it } from 'vitest';
import {
  deriveBodyFluidCounts,
  evaluateAgreement,
  percentDifference,
  validateBodyFluidSubmit,
  WBC_FORMULA_DIVISOR,
  RBC_FORMULA_DIVISOR,
} from '@/lib/medical-reports/body-fluid-logic';
import type { BodyFluidCountEntry } from '@/types/body-fluid-worksheet';

function buildCounts(
  techNumber: 1 | 2,
  wbc: number[],
  rbc: number[],
): BodyFluidCountEntry[] {
  const entries: BodyFluidCountEntry[] = [];
  wbc.forEach((countValue, index) => {
    entries.push({ techNumber, cellType: 'wbc', squareNumber: index + 1, countValue });
  });
  rbc.forEach((countValue, index) => {
    entries.push({ techNumber, cellType: 'rbc', squareNumber: index + 1, countValue });
  });
  return entries;
}

describe('percentDifference', () => {
  it('returns 0 for identical averages', () => {
    expect(percentDifference(10, 10)).toBe(0);
  });

  it('calculates relative to mean', () => {
    expect(percentDifference(10, 13)).toBeCloseTo(26.09, 1);
  });
});

describe('evaluateAgreement', () => {
  it('is not performed without second tech', () => {
    expect(evaluateAgreement(10, 12, false)).toBe('not_performed');
  });

  it('accepts within 30%', () => {
    expect(evaluateAgreement(10, 12, true)).toBe('acceptable');
  });

  it('flags discrepancy above 30%', () => {
    expect(evaluateAgreement(10, 20, true)).toBe('discrepancy');
  });
});

describe('deriveBodyFluidCounts', () => {
  it('uses tech #1 only for final counts', () => {
    const counts = buildCounts(1, [10, 10, 10, 10], [20, 20, 20, 20, 20]);
    const derived = deriveBodyFluidCounts({
      counts,
      secondTechEnabled: false,
      dilutionUsed: false,
    });
    expect(derived.finalWbc).toBe((10 * 1) / WBC_FORMULA_DIVISOR);
    expect(derived.finalRbc).toBe((20 * 1) / RBC_FORMULA_DIVISOR);
    expect(derived.wbcAgreement).toBe('not_performed');
  });

  it('uses mean of tech averages when agreement acceptable', () => {
    const counts = [
      ...buildCounts(1, [10, 10, 10, 10], [20, 20, 20, 20, 20]),
      ...buildCounts(2, [12, 12, 12, 12], [22, 22, 22, 22, 22]),
    ];
    const derived = deriveBodyFluidCounts({
      counts,
      secondTechEnabled: true,
      dilutionUsed: false,
    });
    expect(derived.wbcAgreement).toBe('acceptable');
    expect(derived.finalAverageWbc).toBe(11);
    expect(derived.finalWbc).toBe((11 * 1) / WBC_FORMULA_DIVISOR);
  });

  it('blocks finalization on discrepancy', () => {
    const counts = [
      ...buildCounts(1, [10, 10, 10, 10], [20, 20, 20, 20, 20]),
      ...buildCounts(2, [20, 20, 20, 20], [40, 40, 40, 40, 40]),
    ];
    const derived = deriveBodyFluidCounts({
      counts,
      secondTechEnabled: true,
      dilutionUsed: false,
    });
    expect(derived.hasDiscrepancy).toBe(true);
    expect(derived.finalWbc).toBeUndefined();
  });

  it('applies dilution factor when enabled', () => {
    const counts = buildCounts(1, [10, 10, 10, 10], [20, 20, 20, 20, 20]);
    const derived = deriveBodyFluidCounts({
      counts,
      secondTechEnabled: false,
      dilutionUsed: true,
      dilutionFactor: 2,
    });
    expect(derived.finalWbc).toBe((10 * 2) / WBC_FORMULA_DIVISOR);
  });
});

describe('validateBodyFluidSubmit', () => {
  it('allows tech #1 only completion', () => {
    const counts = buildCounts(1, [10, 10, 10, 10], [20, 20, 20, 20, 20]);
    const derived = deriveBodyFluidCounts({ counts, secondTechEnabled: false, dilutionUsed: false });
    const result = validateBodyFluidSubmit({
      specimenType: 'csf',
      timeReceived: '2026-09-01T10:00:00.000Z',
      counts,
      secondTechEnabled: false,
      dilutionUsed: false,
      derived,
    });
    expect(result.ok).toBe(true);
  });

  it('requires dilution factor when dilution yes', () => {
    const counts = buildCounts(1, [10, 10, 10, 10], [20, 20, 20, 20, 20]);
    const derived = deriveBodyFluidCounts({ counts, secondTechEnabled: false, dilutionUsed: true });
    const result = validateBodyFluidSubmit({
      specimenType: 'csf',
      timeReceived: '2026-09-01T10:00:00.000Z',
      counts,
      secondTechEnabled: false,
      dilutionUsed: true,
      derived,
    });
    expect(result.ok).toBe(false);
  });

  it('requires comment on discrepancy', () => {
    const counts = [
      ...buildCounts(1, [10, 10, 10, 10], [20, 20, 20, 20, 20]),
      ...buildCounts(2, [20, 20, 20, 20], [40, 40, 40, 40, 40]),
    ];
    const derived = deriveBodyFluidCounts({ counts, secondTechEnabled: true, dilutionUsed: false });
    const result = validateBodyFluidSubmit({
      specimenType: 'csf',
      timeReceived: '2026-09-01T10:00:00.000Z',
      counts,
      secondTechEnabled: true,
      dilutionUsed: false,
      derived,
    });
    expect(result.ok).toBe(false);
  });
});
