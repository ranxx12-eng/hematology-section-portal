import type {
  QcCorrectiveActionCode,
  QcCorrectiveActionStatus,
  QcCorrectiveMonthlyStatus,
  QcCorrectiveResultAfterAction,
} from '@/types/qc-corrective-action';

export const FORM_HEMA_016_CODE = 'Form-Hema-016';
export const FORM_HEMA_016_TITLE = 'QC Corrective Action Form – ALINITY-HQ';
export const FORM_HEMA_016_FOOTER = 'Form-Hema-016-QC Corrective Action Form – ALINITY-HQ';
/** Normalized from source duplicate HMG/SAH/QID/HMG/SAH/QID/9168 */
export const FORM_HEMA_016_QID = 'HMG/SAH/QID/9168';

export const DEFAULT_ALINITY_QC_MATERIAL = 'Hematology QC Control';

export const QC_CORRECTIVE_ACTION_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const;

export const QC_CORRECTIVE_ACTION_LEGEND: Record<QcCorrectiveActionCode, string> = {
  A: 'Repeated value within the acceptable range (check for trend)',
  B: 'Open new vial of QC material and repeated',
  C: 'Rerun QC using same vial',
  D: 'Change reagent and repeat QC',
  E: 'Recalibrate and repeat QC',
  F: 'Use backup instrument (explain why?)',
  G: 'Call for service and notify supervisor',
  H: 'QC material in the wrong position',
  I: 'Other (Explain)',
};

export const QC_CORRECTIVE_ACTIONS_REQUIRING_EXPLANATION: QcCorrectiveActionCode[] = ['F', 'I'];

export const EXPLANATION_PROMPTS: Partial<Record<QcCorrectiveActionCode, string>> = {
  F: 'Explain why the backup instrument was used.',
  I: 'Describe the other corrective action.',
};

export const QC_CORRECTIVE_ACTION_STATUS_LABELS: Record<QcCorrectiveActionStatus, string> = {
  required: 'Corrective Action Required',
  in_progress: 'In Progress',
  completed: 'Completed',
};

export const QC_CORRECTIVE_MONTHLY_STATUS_LABELS: Record<QcCorrectiveMonthlyStatus, string> = {
  open: 'Open',
  ready_for_review: 'Ready for Review',
  reviewed: 'Reviewed',
  approved: 'Approved',
  returned: 'Returned',
  archived: 'Archived',
};

export const QC_CORRECTIVE_RESULT_AFTER_LABELS: Record<QcCorrectiveResultAfterAction, string> = {
  resolved_within_range: 'Resolved / Within Acceptable Range',
  still_out_of_range: 'Still Out of Range',
  follow_up_required: 'Follow-Up Required',
  not_applicable: 'Not Applicable',
};

export const ALINITY_HQ_INSTRUMENT_NAME_PATTERNS = [
  /^Alinity HQ\s*1147$/i,
  /^Alinity HQ1147$/i,
  /^Alinity HQ\s*1149$/i,
  /^Alinity HQ1149$/i,
];

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? String(month);
}

export function formatCorrectiveActionDisplay(code?: QcCorrectiveActionCode): string {
  if (!code) return '—';
  const label = QC_CORRECTIVE_ACTION_LEGEND[code];
  return label ? `${code} — ${label}` : code;
}

export function isAlinityHqInstrumentName(name: string): boolean {
  const trimmed = name.trim();
  return ALINITY_HQ_INSTRUMENT_NAME_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function correctiveActionSnapshotText(code: QcCorrectiveActionCode): string {
  return QC_CORRECTIVE_ACTION_LEGEND[code];
}
