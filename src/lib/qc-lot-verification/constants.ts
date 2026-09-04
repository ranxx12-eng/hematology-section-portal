import type {
  QcVerificationFinalDecision,
  QcVerificationStudyStatus,
  QcVerificationType,
} from '@/types/qc-lot-verification';

export const FORM_HEMA_020_CODE = 'Form-Hema-020';
export const FORM_HEMA_020_TITLE = 'Establish Mean and Reference Interval CBC';
export const FORM_HEMA_020_QID = 'HMG/SAH/QID/9173';

export const CBC_RUN_DAYS = 5;
export const CBC_RUNS_PER_DAY = 4;
export const CBC_TOTAL_RUNS = CBC_RUN_DAYS * CBC_RUNS_PER_DAY;

export const SDI_ACCEPTANCE_THRESHOLD = 2;

export const QC_VERIFICATION_TYPE_LABELS: Record<QcVerificationType, string> = {
  cbc: 'CBC QC Verification',
  coagulation: 'Coagulation QC Verification',
};

export const QC_VERIFICATION_STATUS_LABELS: Record<QcVerificationStudyStatus, string> = {
  draft: 'Draft',
  runs_completed: 'Runs Completed',
  pending_review: 'Pending Review',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const QC_VERIFICATION_FINAL_DECISION_LABELS: Record<QcVerificationFinalDecision, string> = {
  verification_acceptable: 'Verification for the new control lot is ACCEPTABLE',
  established_data_acceptable: 'Established data for the new control lot is ACCEPTABLE',
  reestablished_data_acceptable: 'Re-established data for the control lot is ACCEPTABLE',
  verification_unacceptable_reject: 'Verification for the new control lot is UNACCEPTABLE — REJECT new control lot',
};

export const ACCEPTABLE_FINAL_DECISIONS: QcVerificationFinalDecision[] = [
  'verification_acceptable',
  'established_data_acceptable',
  'reestablished_data_acceptable',
];

/** Form-Hema-020 CBC parameters (26) — CBC ONLY. */
export const CBC_VERIFICATION_PARAMETERS = [
  { code: 'WBC', name: 'WBC' },
  { code: 'NEU', name: 'NEU' },
  { code: 'N%', name: 'N%' },
  { code: 'LYM', name: 'LYM' },
  { code: 'L%', name: 'L%' },
  { code: 'MONO', name: 'MONO' },
  { code: 'M%', name: 'M%' },
  { code: 'EOS', name: 'EOS' },
  { code: 'E%', name: 'E%' },
  { code: 'BASO', name: 'BASO' },
  { code: 'B%', name: 'B%' },
  { code: 'RBC', name: 'RBC' },
  { code: 'HGB', name: 'HGB' },
  { code: 'HCT', name: 'HCT' },
  { code: 'MCV', name: 'MCV' },
  { code: 'MCH', name: 'MCH' },
  { code: 'MCHC', name: 'MCHC' },
  { code: 'RDW', name: 'RDW' },
  { code: 'NRBC', name: 'NRBC' },
  { code: 'PLT', name: 'PLT' },
  { code: 'MPV', name: 'MPV' },
  { code: 'RETIC', name: 'RETIC' },
  { code: 'R%', name: 'R%' },
  { code: 'IRF', name: 'IRF' },
  { code: 'IG', name: 'IG' },
  { code: 'IG%', name: 'IG%' },
] as const;

export function buildQcVerificationContextKey(input: {
  verificationType: QcVerificationType;
  qcMaterialName: string;
  lotNumber: string;
  instrumentId?: string;
}): string {
  const material = input.qcMaterialName.trim().toLowerCase();
  const lot = input.lotNumber.trim().toLowerCase();
  const instrument = input.instrumentId ?? 'none';
  return `type:${input.verificationType}|material:${material}|lot:${lot}|instrument:${instrument}`;
}
