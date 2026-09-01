export type QcCorrectiveActionCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';

export type QcCorrectiveActionStatus = 'required' | 'in_progress' | 'completed';

export type QcCorrectiveResultAfterAction =
  | 'resolved_within_range'
  | 'still_out_of_range'
  | 'follow_up_required'
  | 'not_applicable';

export type QcCorrectiveMonthlyStatus =
  | 'open'
  | 'ready_for_review'
  | 'reviewed'
  | 'approved'
  | 'returned'
  | 'archived';

export interface QcCorrectiveActionExtension {
  id: string;
  qcRecordId: string;
  correctedValue?: number;
  correctedValueText?: string;
  correctiveActionCode?: QcCorrectiveActionCode;
  correctiveActionTextSnapshot?: string;
  explanation?: string;
  remarks?: string;
  resultAfterAction?: QcCorrectiveResultAfterAction;
  actionStatus: QcCorrectiveActionStatus;
  completedByUserId?: string;
  completedByName?: string;
  completedByStaffId?: string;
  completedAt?: string;
  preparedByUserId?: string;
  preparedByName?: string;
  preparedByStaffId?: string;
  preparedAt?: string;
  instrumentIdSnapshot?: string;
  instrumentNameSnapshot?: string;
  qcMaterialSnapshot?: string;
  analyteSnapshot?: string;
  qcLevelSnapshot?: string;
  failedValueSnapshot?: string;
  operatorNameSnapshot?: string;
  operatorStaffIdSnapshot?: string;
  recordedAtSnapshot?: string;
  lotNumberSnapshot?: string;
  expiryDateSnapshot?: string;
  originalQcStatusSnapshot?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QcCorrectiveWorklistItem {
  qcRecordId: string;
  recordedAt: string;
  instrumentId: string;
  instrumentName: string;
  qcMaterial: string;
  analyte: string;
  qcLevel: string;
  failedValue: string;
  correctedValue?: string;
  correctiveActionCode?: QcCorrectiveActionCode;
  correctiveActionLabel?: string;
  explanation?: string;
  remarks?: string;
  operatorName?: string;
  operatorStaffId?: string;
  lotNumber?: string;
  expiryDate?: string;
  originalQcStatus: string;
  originalReviewDecision?: string;
  originalApprovalDecision?: string;
  existingQcCorrectiveNotes?: string;
  actionStatus: QcCorrectiveActionStatus;
  resultAfterAction?: QcCorrectiveResultAfterAction;
  extensionId?: string;
  repeatedFailureCount: number;
  monthlyReviewStatus?: QcCorrectiveMonthlyStatus;
  monthlyReviewId?: string;
  isAlinityHq: boolean;
  isIncomplete: boolean;
}

export interface QcCorrectiveMonthlyReview {
  id: string;
  year: number;
  month: number;
  instrumentId: string;
  instrumentName?: string;
  formCode: string;
  qid: string;
  status: QcCorrectiveMonthlyStatus;
  versionNumber: number;
  parentReviewId?: string;
  amendmentReason?: string;
  preparedByUserId?: string;
  preparedByName?: string;
  preparedByStaffId?: string;
  preparedAt?: string;
  reviewedByUserId?: string;
  reviewedByName?: string;
  reviewedByStaffId?: string;
  reviewedAt?: string;
  reviewComment?: string;
  approvedByUserId?: string;
  approvedByName?: string;
  approvedByStaffId?: string;
  approvedAt?: string;
  approvalComment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QcCorrectiveMonthSummary {
  year: number;
  month: number;
  totalQcOut: number;
  correctiveActionsRequired: number;
  completed: number;
  pendingReview: number;
  pendingApproval: number;
  approved: number;
  missingData: number;
  incompleteCount: number;
  actionCounts: Partial<Record<QcCorrectiveActionCode, number>>;
  serviceCallCount: number;
  recalibrationCount: number;
  repeatedFailureCount: number;
}

export interface QcCorrectiveActionFormInput {
  correctedValue?: string;
  correctiveActionCode?: QcCorrectiveActionCode;
  explanation?: string;
  remarks?: string;
  resultAfterAction?: QcCorrectiveResultAfterAction;
}

export interface QcCorrectiveAuditEvent {
  id: string;
  qcRecordId?: string;
  monthlyReviewId?: string;
  userId?: string;
  userName?: string;
  staffId?: string;
  action: string;
  oldStatus?: string;
  newStatus?: string;
  comment?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
