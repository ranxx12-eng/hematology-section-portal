import { describe, it, expect } from 'vitest';
import { calculateRiskScore, getRiskLevel } from '@/lib/calculations/risk';

describe('Risk Calculations', () => {
  it('calculates risk score as likelihood × severity', () => {
    expect(calculateRiskScore(3, 4)).toBe(12);
  });

  it('clamps likelihood and severity to 1-5', () => {
    expect(calculateRiskScore(0, 10)).toBe(5);
    expect(calculateRiskScore(10, 0)).toBe(5);
  });

  it('returns low risk for score < 6', () => {
    expect(getRiskLevel(4)).toBe('low');
  });

  it('returns medium risk for score 6-11', () => {
    expect(getRiskLevel(8)).toBe('medium');
  });

  it('returns high risk for score 12-19', () => {
    expect(getRiskLevel(15)).toBe('high');
  });

  it('returns critical risk for score >= 20', () => {
    expect(getRiskLevel(25)).toBe('critical');
  });
});
