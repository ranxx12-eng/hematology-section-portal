import type { ReagentLotComparison, ReagentLotComparisonResult } from '@/types/inventory-module';

const RESOLUTION_REQUIRED: Array<ReagentLotComparisonResult['interpretation']> = [
  'not_acceptable',
  'cannot_calculate',
  'manual_review',
  'criteria_not_configured',
];

export interface FormHema022ValidationIssue {
  code: string;
  message: string;
}

export function validateFormHema022Submission(study: ReagentLotComparison): FormHema022ValidationIssue[] {
  const issues: FormHema022ValidationIssue[] = [];

  if (study.schemaVersion !== 2) {
    return issues;
  }

  if (!study.results.length) {
    issues.push({ code: 'no_results', message: 'Enter results for all required tests and samples.' });
    return issues;
  }

  for (const result of study.results) {
    if (result.interpretation === 'incomplete') {
      issues.push({
        code: 'incomplete_result',
        message: `Sample ${result.sampleNumber} · ${result.testLabel ?? result.testCode ?? 'Test'} is incomplete.`,
      });
    }
    if (RESOLUTION_REQUIRED.includes(result.interpretation) && !result.comment?.trim()) {
      issues.push({
        code: 'resolution_required',
        message: `Sample ${result.sampleNumber} · ${result.testLabel ?? result.testCode ?? 'Test'} requires a documented resolution comment.`,
      });
    }
  }

  if (!study.studyYear) {
    issues.push({ code: 'study_year', message: 'Study year is required.' });
  }
  if (!study.studyDate) {
    issues.push({ code: 'study_date', message: 'Study date is required.' });
  }
  if (!study.instrumentNameSnapshot?.trim()) {
    issues.push({ code: 'instrument', message: 'Instrument is required.' });
  }

  return issues;
}
