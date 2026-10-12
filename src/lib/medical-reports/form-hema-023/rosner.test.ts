import { describe, expect, it } from 'vitest';
import {
  ROSNER_CANNOT_CALCULATE_TEXT,
  ROSNER_INCOMPLETE_TEXT,
  ROSNER_INHIBITOR_TEXT,
  ROSNER_NEUTRAL_TEXT,
} from '@/lib/medical-reports/form-hema-023/constants';
import {
  calculateRosnerIndex,
  compareRosnerToThreshold,
  formatRosnerIndexDisplay,
} from '@/lib/medical-reports/form-hema-023/rosner';

describe('Form-Hema-023 Rosner index', () => {
  it('calculates the controlled ratio for the immediate mix', () => {
    const result = calculateRosnerIndex('100', '20', '36');
    expect(result.status).toBe('calculated');
    expect(result.index).toBe('16');
    expect(result.interpretation).toBe(ROSNER_INHIBITOR_TEXT);
  });

  it('calculates the incubated mix independently of the immediate mix', () => {
    const immediate = calculateRosnerIndex('100', '20', '30');
    const incubated = calculateRosnerIndex('100', '20', '36');
    expect(immediate.index).toBe('10');
    expect(incubated.index).toBe('16');
    expect(immediate.interpretation).toBe(ROSNER_NEUTRAL_TEXT);
    expect(incubated.interpretation).toBe(ROSNER_INHIBITOR_TEXT);
  });

  it('keeps PT and APTT calculations independent', () => {
    const aptt = calculateRosnerIndex('80', '30', '40');
    const pt = calculateRosnerIndex('20', '12', '18');
    expect(aptt.index).toBe('12.5');
    expect(pt.index).toBe('30');
  });

  it('does not treat an index of exactly 15 as greater than 15', () => {
    const result = calculateRosnerIndex('100', '20', '35');
    expect(result.index).toBe('15');
    expect(compareRosnerToThreshold(result.index ?? '')).toBe(0);
    expect(result.interpretation).toBe(ROSNER_NEUTRAL_TEXT);
    expect(calculateRosnerIndex('10', '2', '3.5').interpretation).toBe(ROSNER_NEUTRAL_TEXT);
  });

  it('classifies an index above 15 as an inhibitor suggestion', () => {
    expect(calculateRosnerIndex('100', '20', '35.01').interpretation).toBe(ROSNER_INHIBITOR_TEXT);
    expect(calculateRosnerIndex('10000', '1000', '2500.01').interpretation).toBe(ROSNER_INHIBITOR_TEXT);
  });

  it('returns Incomplete when a required input is missing', () => {
    expect(calculateRosnerIndex('', '20', '35')).toMatchObject({
      status: 'incomplete',
      index: null,
      interpretation: ROSNER_INCOMPLETE_TEXT,
    });
  });

  it('returns Cannot Calculate when the patient clotting time is zero', () => {
    expect(calculateRosnerIndex('0', '20', '35')).toMatchObject({
      status: 'cannot_calculate',
      interpretation: ROSNER_CANNOT_CALCULATE_TEXT,
    });
  });

  it('rejects negative, non-numeric, NaN, and Infinity values', () => {
    for (const value of ['-1', 'abc', 'NaN', 'Infinity', '1e2', '15.']) {
      expect(calculateRosnerIndex(value, '20', '35').status).toBe('invalid');
    }
  });

  it('uses a below-threshold sentence and does not name a factor or inhibitor type', () => {
    const result = calculateRosnerIndex('100', '20', '30');
    expect(result.interpretation).toBe(ROSNER_NEUTRAL_TEXT);
    expect(result.interpretation.toLowerCase()).not.toMatch(/factor|lupus|deficiency/);
  });

  it('keeps display formatting from changing a threshold decision', () => {
    expect(formatRosnerIndexDisplay('15.00001')).toBe('15.00001');
    expect(compareRosnerToThreshold('15.00001')).toBe(1);
    expect(formatRosnerIndexDisplay('14.25000')).toBe('14.25');
  });
});
