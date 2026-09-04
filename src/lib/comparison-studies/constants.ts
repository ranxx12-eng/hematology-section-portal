import type { ComparisonStudyType } from '@/types/comparison-study';

export const FORM_HEMA_013_CODE = 'Form-Hema-013';

export const COMPARISON_STUDY_STATUSES = [
  'draft',
  'submitted',
  'pending_review',
  'pending_approval',
  'approved',
  'returned',
  'rejected',
  'archived',
] as const;

export const COMPARISON_TYPES = [
  'Instrument vs Instrument',
  'Method vs Method',
  'Before vs After Maintenance',
  'Before vs After Calibration',
  'Lot-to-Lot',
  'Reagent Lot Comparison',
  'Old Instrument vs New Instrument',
  'Current Method vs Reference Method',
  'Other',
] as const;

export const DEFAULT_SAMPLE_COUNT = 5;

export const DEFAULT_SAMPLE_IDS = ['S1', 'S2', 'S3', 'S4', 'S5'];

export const COMPARISON_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  pending_review: 'Pending Review',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  returned: 'Returned',
  rejected: 'Rejected',
  archived: 'Archived',
};

export const COMPARISON_OVERALL_RESULT_LABELS: Record<string, string> = {
  acceptable: 'ACCEPTABLE',
  not_acceptable: 'NOT ACCEPTABLE',
  manual_review_required: 'MANUAL REVIEW REQUIRED',
  incomplete: 'INCOMPLETE',
};

export const COMPARISON_RESULT_STATUS_LABELS: Record<string, string> = {
  acceptable: 'ACCEPTABLE',
  not_acceptable: 'NOT ACCEPTABLE',
  manual_review: 'MANUAL REVIEW',
  incomplete: 'INCOMPLETE',
};

export const MANUAL_REVIEW_DECISION_LABELS: Record<string, string> = {
  accept: 'Accept',
  not_accept: 'Not Accept',
  repeat_required: 'Repeat Required',
  exclude_result: 'Exclude Result',
};

export interface ComparisonStudyTypeDefinition {
  key: ComparisonStudyType;
  label: string;
  description: string;
  formCode?: string;
  qid?: string;
  phase: 1 | 2;
  supportsStandardSections: boolean;
  supportsFormHema013: boolean;
}

export const COMPARISON_STUDY_TYPES: ComparisonStudyTypeDefinition[] = [
  {
    key: 'standard_comparison',
    label: 'Standard Comparison Study',
    description: 'Form-Hema-013 comparison form with CBC, Coagulation, and ESR sections.',
    formCode: FORM_HEMA_013_CODE,
    phase: 2,
    supportsStandardSections: true,
    supportsFormHema013: true,
  },
  {
    key: 'rumke',
    label: 'Rumke Study',
    description: 'Dedicated Rumke workflow and controlled form will be configured separately.',
    phase: 1,
    supportsStandardSections: false,
    supportsFormHema013: false,
  },
  {
    key: 'open_close_mixing',
    label: 'Open / Close Mode Mixing',
    description: 'Form-Hema-018 sample mixing time validation for Close Mode and Open Mode on Alinity HQ1147.',
    formCode: 'Form-Hema-018',
    qid: 'HMG/SAH/QID/9171',
    phase: 2,
    supportsStandardSections: false,
    supportsFormHema013: false,
  },
];

export function getComparisonStudyTypeDefinition(
  key: ComparisonStudyType,
): ComparisonStudyTypeDefinition | undefined {
  return COMPARISON_STUDY_TYPES.find((type) => type.key === key);
}

export function comparisonTypeRequiresInstruments(comparisonType?: string): boolean {
  return comparisonType === 'Instrument vs Instrument'
    || comparisonType === 'Old Instrument vs New Instrument';
}
