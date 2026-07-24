import { describe, it, expect } from 'vitest';
import { calculateFinalScore, getEvaluationRating, EVALUATION_WEIGHTS } from '@/lib/calculations/evaluation';

describe('Evaluation Calculations', () => {
  it('calculates final score with correct weights', () => {
    const input = {
      fte: 1,
      staffEvaluation: 5,
      supervisorEvaluation: 5,
      labManagerEvaluation: 5,
      labDirectorEvaluation: 5,
    };
    const score = calculateFinalScore(input);
    expect(score).toBe(100);
  });

  it('weights FTE at 40%', () => {
    const score = calculateFinalScore({
      fte: 0.5,
      staffEvaluation: 1,
      supervisorEvaluation: 1,
      labManagerEvaluation: 1,
      labDirectorEvaluation: 1,
    });
    // FTE: 0.5 * 100 * 0.4 = 20; each eval at 1/5 * 100 * weight = 6+2+2+2 = 12; total = 32
    expect(score).toBe(32);
  });

  it('returns outstanding for score >= 90', () => {
    expect(getEvaluationRating(95)).toBe('outstanding');
  });

  it('returns exceeds_expectations for score 80-89.99', () => {
    expect(getEvaluationRating(85)).toBe('exceeds_expectations');
  });

  it('returns meets_expectations for score 70-79.99', () => {
    expect(getEvaluationRating(75)).toBe('meets_expectations');
  });

  it('returns needs_improvement for score 60-69.99', () => {
    expect(getEvaluationRating(65)).toBe('needs_improvement');
  });

  it('returns unsatisfactory for score < 60', () => {
    expect(getEvaluationRating(50)).toBe('unsatisfactory');
  });

  it('has weights summing to 1', () => {
    const sum = Object.values(EVALUATION_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1);
  });
});
