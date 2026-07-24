export const EVALUATION_WEIGHTS = {
  fte: 0.4,
  staff: 0.3,
  supervisor: 0.1,
  labManager: 0.1,
  labDirector: 0.1,
} as const;

export type EvaluationRating = 'outstanding' | 'exceeds_expectations' | 'meets_expectations' | 'needs_improvement' | 'unsatisfactory';

export interface EvaluationInput {
  fte: number;
  staffEvaluation: number;
  supervisorEvaluation: number;
  labManagerEvaluation: number;
  labDirectorEvaluation: number;
}

export function calculateFinalScore(input: EvaluationInput): number {
  const fteScore = Math.min(Math.max(input.fte, 0), 1) * 100 * EVALUATION_WEIGHTS.fte;
  const staffScore = (Math.min(Math.max(input.staffEvaluation, 1), 5) / 5) * 100 * EVALUATION_WEIGHTS.staff;
  const supervisorScore = (Math.min(Math.max(input.supervisorEvaluation, 1), 5) / 5) * 100 * EVALUATION_WEIGHTS.supervisor;
  const labManagerScore = (Math.min(Math.max(input.labManagerEvaluation, 1), 5) / 5) * 100 * EVALUATION_WEIGHTS.labManager;
  const labDirectorScore = (Math.min(Math.max(input.labDirectorEvaluation, 1), 5) / 5) * 100 * EVALUATION_WEIGHTS.labDirector;
  return Math.round((fteScore + staffScore + supervisorScore + labManagerScore + labDirectorScore) * 100) / 100;
}

export function getEvaluationRating(score: number): EvaluationRating {
  if (score >= 90) return 'outstanding';
  if (score >= 80) return 'exceeds_expectations';
  if (score >= 70) return 'meets_expectations';
  if (score >= 60) return 'needs_improvement';
  return 'unsatisfactory';
}

export const RATING_LABELS: Record<EvaluationRating, { en: string; ar: string; color: string }> = {
  outstanding: { en: 'Outstanding', ar: 'ممتاز', color: 'bg-emerald-500' },
  exceeds_expectations: { en: 'Exceeds Expectations', ar: 'يتجاوز التوقعات', color: 'bg-sky-500' },
  meets_expectations: { en: 'Meets Expectations', ar: 'يلبي التوقعات', color: 'bg-blue-500' },
  needs_improvement: { en: 'Needs Improvement', ar: 'يحتاج تحسين', color: 'bg-amber-500' },
  unsatisfactory: { en: 'Unsatisfactory', ar: 'غير مرضٍ', color: 'bg-red-500' },
};
