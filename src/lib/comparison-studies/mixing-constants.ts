import type { ComparisonOverallResult, ComparisonResultStatus } from '@/types/comparison-study';

export const FORM_HEMA_018_CODE = 'Form-Hema-018';
export const FORM_HEMA_018_QID = 'HMG/SAH/QID/9171';
export const FORM_HEMA_018_TITLE = 'Sample Mixing Time Validation';
export const MIXING_INSTRUMENT_NAME = 'Alinity HQ 1147';

export const MIXING_MODES = ['close', 'open'] as const;
export type MixingMode = (typeof MIXING_MODES)[number];

export const MIXING_MODE_LABELS: Record<MixingMode, string> = {
  close: 'Close Mode',
  open: 'Open Mode',
};

export const MIXING_SAMPLE_COUNT = 5;

/** Central TAE configuration for Form-Hema-018 (percent). */
export const MIXING_TAE_LIMITS = {
  WBC: 15,
  RBC: 6,
  HGB: 7,
  PLT: 25,
} as const;

export type MixingParameterCode = keyof typeof MIXING_TAE_LIMITS;

export const MIXING_PARAMETERS: Array<{
  testCode: MixingParameterCode;
  testName: string;
  unit: string;
  taePercent: number;
  displayOrder: number;
}> = [
  { testCode: 'WBC', testName: 'WBC', unit: '×10³/µL', taePercent: MIXING_TAE_LIMITS.WBC, displayOrder: 0 },
  { testCode: 'RBC', testName: 'RBC', unit: '×10⁶/µL', taePercent: MIXING_TAE_LIMITS.RBC, displayOrder: 1 },
  { testCode: 'HGB', testName: 'HGB', unit: 'g/dL', taePercent: MIXING_TAE_LIMITS.HGB, displayOrder: 2 },
  { testCode: 'PLT', testName: 'PLT', unit: '×10³/µL', taePercent: MIXING_TAE_LIMITS.PLT, displayOrder: 3 },
];

export const MIN_ELAPSED_MINUTES = 2 * 60;
export const MAX_ELAPSED_MINUTES = 4 * 60;

export const MIXING_TIMING_INVALID_LABEL = 'Outside validated 2–4 hour window';

export const MIXING_MODE_STATUS_LABELS = {
  acceptable: 'Acceptable',
  not_acceptable: 'Not Acceptable',
  incomplete: 'Incomplete',
  timing_review: 'Timing Review',
} as const;

export type MixingModeStatus = keyof typeof MIXING_MODE_STATUS_LABELS;

export function suggestMixingConclusion(overall: ComparisonOverallResult): string {
  if (overall === 'acceptable') {
    return 'Sample mixing time validation is acceptable for Open Mode and Close Mode within the validated 2–4 hour interval.';
  }
  return 'Sample mixing time validation requires review due to one or more results outside the allowed TAE limits.';
}
