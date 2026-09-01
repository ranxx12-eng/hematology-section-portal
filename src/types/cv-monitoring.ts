export type CvMonitoringStatus =
  | 'draft'
  | 'submitted'
  | 'pending_review'
  | 'pending_approval'
  | 'approved'
  | 'returned'
  | 'rejected'
  | 'archived';

export type CvResultStatus = 'ok' | 'high_cv' | 'manual_review' | 'incomplete';

export type CvOverallStatus =
  | 'all_within_limit'
  | 'high_cv_detected'
  | 'manual_review_required'
  | 'incomplete';

export type CvTrendStatus = 'improved' | 'increased' | 'no_change';

export type CvPreviousSourceType =
  | 'auto_from_approved_record'
  | 'historical_paper_record'
  | 'instrument_report'
  | 'qc_report'
  | 'other';

export type CvQualityDisposition =
  | 'accepted_after_investigation'
  | 'corrective_action_required'
  | 'repeat_monitoring_required'
  | 'invalid_excluded';

export type CvQcLevel = 'N' | 'P';

export interface CvMonitoringDefinition {
  id: string;
  instrumentId: string;
  instrumentName?: string;
  analyteCode: string;
  analyteName: string;
  qcLevel: CvQcLevel;
  unit?: string;
  cvLimitPercent: number;
  displayOrder: number;
  isActive: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CvMonitoringLevel {
  id: string;
  monthlyRecordId: string;
  qcLevel: CvQcLevel;
  lotNumber?: string;
  displayOrder: number;
}

export interface CvMonitoringResult {
  id: string;
  monthlyRecordId: string;
  levelId: string;
  definitionId?: string;
  analyteCode: string;
  analyteName: string;
  unit?: string;
  cvLimitSnapshot?: number;
  previousMean?: number;
  previousSd?: number;
  previousCvPercent?: number;
  previousStatus: CvResultStatus;
  previousSourceType?: CvPreviousSourceType;
  previousSourceRecordId?: string;
  previousSourceMonitoringNumber?: string;
  previousManualReason?: string;
  previousManualEnteredBy?: string;
  previousManualEnteredAt?: string;
  currentMean?: number;
  currentSd?: number;
  currentCvPercent?: number;
  currentStatus: CvResultStatus;
  cvChange?: number;
  trendStatus?: CvTrendStatus;
  comment?: string;
  observation?: string;
  investigation?: string;
  possibleCause?: string;
  correctiveAction?: string;
  followUpRequired?: boolean;
  followUpComment?: string;
  qualityDisposition?: CvQualityDisposition;
  displayOrder: number;
}

export interface CvMonitoringRecord {
  id: string;
  monitoringNumber: string;
  formCode: string;
  qid: string;
  instrumentId: string;
  instrumentNameSnapshot: string;
  currentMonth: number;
  currentYear: number;
  previousMonth: number;
  previousYear: number;
  status: CvMonitoringStatus;
  overallStatus?: CvOverallStatus;
  generalComments?: string;
  notes?: string;
  preparedBy?: string;
  preparedByName?: string;
  preparedByStaffId?: string;
  preparedAt?: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedByStaffId?: string;
  reviewedAt?: string;
  reviewComment?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedByStaffId?: string;
  approvedAt?: string;
  approvalComment?: string;
  levels: CvMonitoringLevel[];
  results: CvMonitoringResult[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface CvMonitoringListItem {
  id: string;
  monitoringNumber: string;
  instrumentName: string;
  currentMonth: number;
  currentYear: number;
  levels: CvQcLevel[];
  highCvCount: number;
  overallStatus?: CvOverallStatus;
  status: CvMonitoringStatus;
  preparedByName?: string;
  reviewedByName?: string;
  approvedByName?: string;
  createdAt: string;
}

export interface CvMonitoringSummary {
  totalAnalytes: number;
  currentOk: number;
  currentHighCv: number;
  currentManualReview: number;
  currentIncomplete: number;
  previousOk: number;
  previousHighCv: number;
  overallStatus: CvOverallStatus;
  levelSummaries: Array<{
    qcLevel: CvQcLevel;
    analytes: Array<{ analyteCode: string; analyteName: string; currentStatus: CvResultStatus }>;
  }>;
}

export interface CvTrendDataPoint {
  month: number;
  year: number;
  instrumentId: string;
  instrumentName: string;
  qcLevel: CvQcLevel;
  analyteCode: string;
  analyteName: string;
  mean?: number;
  sd?: number;
  cvPercent?: number;
  cvLimitSnapshot?: number;
  status: CvResultStatus;
  monitoringNumber: string;
  recordId: string;
}

export interface CvDefinitionAuditEvent {
  id: string;
  definitionId: string;
  fieldName: string;
  oldValue?: string;
  newValue?: string;
  changedBy?: string;
  changedByName?: string;
  staffId?: string;
  reason: string;
  createdAt: string;
}

export interface CvMonitoringAuditEvent {
  id: string;
  recordId: string;
  userId: string;
  userName: string;
  staffId?: string;
  action: string;
  oldStatus?: string;
  newStatus?: string;
  comment?: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}
