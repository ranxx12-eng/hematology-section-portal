export const QC_CORRECTIVE_ACTIONS = [
  'Repeat QC',
  'Reconstitute/Prepare New QC Material',
  'Change QC Vial',
  'Check QC Lot/Expiry',
  'Check Reagent',
  'Change Reagent',
  'Check Reagent Lot/Expiry',
  'Calibration Performed',
  'Recalibration Performed',
  'Instrument Maintenance Performed',
  'Cleaning Performed',
  'Probe/Aspiration Check',
  'Re-run After Maintenance',
  'Contacted Senior/Supervisor',
  'Contacted Engineer/Technical Support',
  'Opened Service Ticket',
  'Other',
] as const;

export type QCCorrectiveAction = (typeof QC_CORRECTIVE_ACTIONS)[number];

export const QC_IN_OUT_STATUSES = ['IN', 'OUT'] as const;
export type QCInOutStatus = (typeof QC_IN_OUT_STATUSES)[number];

export const QC_RESOLUTION_STATUSES = ['IN', 'Still OUT', 'Pending'] as const;
export type QCResolutionStatus = (typeof QC_RESOLUTION_STATUSES)[number];

export const QC_RESOLUTION_FILTER_OPTIONS = [
  'all',
  'resolved',
  'unresolved',
  'Pending',
  'Still OUT',
] as const;

export const QC_FREQUENCIES = ['daily', 'monthly'] as const;
export type QCFrequency = (typeof QC_FREQUENCIES)[number];

export const QC_FREQUENCY_LABELS: Record<QCFrequency, string> = {
  daily: 'Daily',
  monthly: 'Monthly',
};

export const QC_REVIEW_STATUSES = ['Pending Review', 'Reviewed'] as const;
export type QCReviewStatus = (typeof QC_REVIEW_STATUSES)[number];

export const QC_APPROVAL_STATUSES = ['Pending Approval', 'Approved'] as const;
export type QCApprovalStatus = (typeof QC_APPROVAL_STATUSES)[number];

export const QC_DECISIONS = ['accept', 'not_accept', 'need_follow_up'] as const;
export type QCDecision = (typeof QC_DECISIONS)[number];

export const QC_DECISION_LABELS: Record<QCDecision, string> = {
  accept: 'Accept',
  not_accept: 'Not Accept',
  need_follow_up: 'Need Follow Up',
};
