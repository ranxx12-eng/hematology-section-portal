export type QcVerificationType = 'cbc' | 'coagulation';

export type QcVerificationStudyStatus =
  | 'draft'
  | 'runs_completed'
  | 'pending_review'
  | 'pending_approval'
  | 'approved'
  | 'rejected';

export type QcVerificationFinalDecision =
  | 'verification_acceptable'
  | 'established_data_acceptable'
  | 'reestablished_data_acceptable'
  | 'verification_unacceptable_reject';

export type QcVerificationParameterResult = 'pass' | 'fail' | 'manual_review' | 'incomplete';

export interface QcLotVerificationRun {
  id: string;
  studyId: string;
  dayNumber: number;
  runNumber: number;
  completed: boolean;
  completedByName?: string;
  completedAt?: string;
}

export interface QcLotVerificationParameter {
  id: string;
  studyId: string;
  parameterCode: string;
  parameterName: string;
  displayOrder: number;
  manufacturerMean?: number;
  manufacturerSd?: number;
  establishedMean?: number;
  establishedSd?: number;
  manufacturerLower?: number;
  manufacturerUpper?: number;
  establishedLower?: number;
  establishedUpper?: number;
  difference?: number;
  sdi?: number;
  result: QcVerificationParameterResult;
}

export interface QcLotVerificationEvidenceRef {
  type: 'raw_data_sheet' | 'analyzer_qc_summary' | 'other';
  label: string;
  storagePath?: string;
  note?: string;
}

export interface QcLotVerificationStudy {
  id: string;
  studyNumber: string;
  verificationType: QcVerificationType;
  status: QcVerificationStudyStatus;
  qcMaterialName: string;
  qcMaterialCode?: string;
  lotNumber: string;
  inventoryItemId?: string;
  instrumentId?: string;
  instrumentNameSnapshot?: string;
  contextKey: string;
  studyDate?: string;
  finalDecision?: QcVerificationFinalDecision;
  finalDecisionNotes?: string;
  evidenceRefs: QcLotVerificationEvidenceRef[];
  preparedByName?: string;
  reviewedByName?: string;
  approvedByName?: string;
  rejectedByName?: string;
  rejectionComment?: string;
  runs: QcLotVerificationRun[];
  parameters: QcLotVerificationParameter[];
  createdAt: string;
  updatedAt: string;
}

export interface QcLotVerificationProgress {
  completedRuns: number;
  totalRuns: number;
  percent: number;
  runsComplete: boolean;
  dayProgress: Array<{ dayNumber: number; completed: number; total: number }>;
}

export interface QcLotVerificationSummary {
  totalParameters: number;
  passed: number;
  failed: number;
  manualReview: number;
  incomplete: number;
}

export type QcLotVerificationLookupStatus =
  | 'verified'
  | 'not_verified'
  | 'in_progress'
  | 'rejected';

export interface QcLotVerificationLookupResult {
  status: QcLotVerificationLookupStatus;
  studyId?: string;
  studyNumber?: string;
  message: string;
}
