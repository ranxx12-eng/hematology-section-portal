import type { CvQcLevel } from '@/types/cv-monitoring';

export const FORM_HEMA_015_CODE = 'Form-Hema-015';
export const FORM_HEMA_015_TITLE = 'Monthly CV Comparison';
export const FORM_HEMA_015_FOOTER = 'Form-Hema-015-Monthly CV Comparison';
export const FORM_HEMA_015_QID = 'HMG/SAH/QID/9167';

export const CV_MONITORING_STATUSES = [
  'draft',
  'submitted',
  'pending_review',
  'pending_approval',
  'approved',
  'returned',
  'rejected',
  'archived',
] as const;

export const CV_QC_LEVELS: CvQcLevel[] = ['N', 'P'];

export const CV_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  pending_review: 'Pending Review',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  returned: 'Returned',
  rejected: 'Rejected',
  archived: 'Archived',
};

export const CV_RESULT_STATUS_LABELS: Record<string, string> = {
  ok: 'OK',
  high_cv: 'HIGH CV',
  manual_review: 'MANUAL REVIEW',
  incomplete: 'INCOMPLETE',
};

export const CV_OVERALL_STATUS_LABELS: Record<string, string> = {
  all_within_limit: 'ALL WITHIN LIMIT',
  high_cv_detected: 'HIGH CV DETECTED',
  manual_review_required: 'MANUAL REVIEW REQUIRED',
  incomplete: 'INCOMPLETE',
};

export const CV_TREND_LABELS: Record<string, string> = {
  improved: 'Improved',
  increased: 'Increased',
  no_change: 'No Change',
};

export const CV_PREVIOUS_SOURCE_LABELS: Record<string, string> = {
  auto_from_approved_record: 'Auto from approved record',
  historical_paper_record: 'Historical paper record',
  instrument_report: 'Instrument report',
  qc_report: 'QC report',
  other: 'Other',
};

export const CV_QUALITY_DISPOSITION_LABELS: Record<string, string> = {
  accepted_after_investigation: 'Accepted After Investigation',
  corrective_action_required: 'Corrective Action Required',
  repeat_monitoring_required: 'Repeat Monitoring Required',
  invalid_excluded: 'Invalid / Excluded From Final Assessment',
};

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export const MONTH_ABBREVIATIONS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
] as const;

export function monthAbbreviation(month: number): string {
  return MONTH_ABBREVIATIONS[month - 1] ?? String(month);
}

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? String(month);
}

export function derivePreviousMonth(currentMonth: number, currentYear: number): { month: number; year: number } {
  if (currentMonth === 1) return { month: 12, year: currentYear - 1 };
  return { month: currentMonth - 1, year: currentYear };
}

export const STAGO_INSTRUMENT_LOOKUP = {
  serialNumber: 'N5562',
  assetCode: 'HMG87227',
  name: 'Stago STA-R MAX3',
  aliases: ['Stago STA R MAX3'],
} as const;

export interface OfficialCvLimitSeed {
  qcLevel: CvQcLevel;
  analyteCode: string;
  analyteName: string;
  cvLimitPercent: number;
  displayOrder: number;
}

/** Official Form-Hema-015 STAGO limits — stored in DB, not in UI components. */
export const OFFICIAL_STAGO_CV_LIMITS: OfficialCvLimitSeed[] = [
  { qcLevel: 'N', analyteCode: 'PT', analyteName: 'PT', cvLimitPercent: 7.627, displayOrder: 1 },
  { qcLevel: 'N', analyteCode: 'PTT', analyteName: 'PTT', cvLimitPercent: 7.971, displayOrder: 2 },
  { qcLevel: 'N', analyteCode: 'FIB', analyteName: 'Fibrinogen', cvLimitPercent: 10.656, displayOrder: 3 },
  { qcLevel: 'N', analyteCode: 'DD', analyteName: 'D-Dimer', cvLimitPercent: 33.33, displayOrder: 4 },
  { qcLevel: 'P', analyteCode: 'PT', analyteName: 'PT', cvLimitPercent: 11.194, displayOrder: 1 },
  { qcLevel: 'P', analyteCode: 'PTT', analyteName: 'PTT', cvLimitPercent: 7.576, displayOrder: 2 },
  { qcLevel: 'P', analyteCode: 'FIB', analyteName: 'Fibrinogen', cvLimitPercent: 9.615, displayOrder: 3 },
  { qcLevel: 'P', analyteCode: 'DD', analyteName: 'D-Dimer', cvLimitPercent: 9.756, displayOrder: 4 },
];

export function analytePrintCode(code: string): string {
  return code === 'DD' ? 'D-D' : code;
}
