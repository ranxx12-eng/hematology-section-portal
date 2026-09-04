export type ComparisonStudyType = 'standard_comparison' | 'rumke' | 'open_close_mixing';

export type ComparisonStudyStatus =
  | 'draft'
  | 'submitted'
  | 'pending_review'
  | 'pending_approval'
  | 'approved'
  | 'returned'
  | 'rejected'
  | 'archived';

export type ComparisonSectionCode = 'CBC' | 'COAGULATION' | 'ESR';

export type ComparisonOverallResult =
  | 'acceptable'
  | 'not_acceptable'
  | 'manual_review_required'
  | 'incomplete';

export type ComparisonResultStatus =
  | 'acceptable'
  | 'not_acceptable'
  | 'manual_review'
  | 'incomplete';

export type ComparisonManualReviewDecision =
  | 'accept'
  | 'not_accept'
  | 'repeat_required'
  | 'exclude_result';

export interface ComparisonTestDefinition {
  id: string;
  section: ComparisonSectionCode;
  testCode: string;
  testName: string;
  unit: string;
  taeLimit?: number;
  displayOrder: number;
  isActive: boolean;
}

export interface ComparisonStudySection {
  id: string;
  studyId: string;
  section: ComparisonSectionCode;
  completionPercentage: number;
  displayOrder: number;
}

export type MixingMode = 'close' | 'open';

export interface ComparisonMixingSample {
  id: string;
  studyId: string;
  mode: MixingMode;
  sampleNumber: number;
  initialTestTime?: string;
  finalTestTime?: string;
  elapsedMinutes?: number;
  timingValid?: boolean;
  displayOrder: number;
}

export interface ComparisonMixingResult {
  id: string;
  mixingSampleId: string;
  testCode: string;
  testName: string;
  unit: string;
  taePercentSnapshot: number;
  firstResult?: number;
  taeValue?: number;
  lowerLimit?: number;
  upperLimit?: number;
  finalResult?: number;
  resultStatus: ComparisonResultStatus;
  displayOrder: number;
}

export interface ComparisonStudySample {
  id: string;
  studyId: string;
  section: ComparisonSectionCode;
  sampleId: string;
  displayOrder: number;
}

export interface ComparisonStudyResult {
  id: string;
  sampleId: string;
  testDefinitionId?: string;
  testCode: string;
  testName: string;
  unit: string;
  previousResult?: number;
  newResult?: number;
  differenceUnits?: number;
  differencePercent?: number;
  taeLimitSnapshot?: number;
  resultStatus: ComparisonResultStatus;
  manualReviewDecision?: ComparisonManualReviewDecision;
  manualReviewComment?: string;
  manualReviewedBy?: string;
  manualReviewedByName?: string;
  manualReviewedByStaffId?: string;
  manualReviewedAt?: string;
  issueObservation?: string;
  correctiveAction?: string;
  repeatPerformed: boolean;
  repeatPreviousResult?: number;
  repeatNewResult?: number;
  repeatReason?: string;
  repeatBy?: string;
  repeatByName?: string;
  repeatAt?: string;
  displayOrder: number;
}

export interface ComparisonStudy {
  id: string;
  studyNumber: string;
  formCode?: string;
  studyType: ComparisonStudyType;
  comparisonType?: string;
  studyTitle: string;
  studyDate?: string;
  purpose?: string;
  referenceLabel?: string;
  comparisonLabel?: string;
  referenceInstrumentId?: string;
  comparisonInstrumentId?: string;
  status: ComparisonStudyStatus;
  overallResult?: ComparisonOverallResult;
  generalComments?: string;
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
  parentStudyId?: string;
  versionNumber: number;
  amendmentReason?: string;
  sections: ComparisonStudySection[];
  samples: ComparisonStudySample[];
  results: ComparisonStudyResult[];
  mixingSamples?: ComparisonMixingSample[];
  mixingResults?: ComparisonMixingResult[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface ComparisonStudyListItem {
  id: string;
  studyNumber: string;
  studyType: ComparisonStudyType;
  comparisonType?: string;
  studyTitle: string;
  studyDate?: string;
  referenceLabel?: string;
  comparisonLabel?: string;
  sections: ComparisonSectionCode[];
  sampleCount: number;
  overallResult?: ComparisonOverallResult;
  status: ComparisonStudyStatus;
  preparedByName?: string;
  versionNumber: number;
  createdAt: string;
}

export interface ComparisonStudySummary {
  totalSamples: number;
  totalTests: number;
  acceptable: number;
  notAcceptable: number;
  manualReview: number;
  incomplete: number;
  completionPercent: number;
  overallResult: ComparisonOverallResult;
  analyteSummaries: Array<{
    testCode: string;
    testName: string;
    section: ComparisonSectionCode;
    acceptable: number;
    notAcceptable: number;
    manualReview: number;
    incomplete: number;
    total: number;
  }>;
}

export interface ComparisonAuditEvent {
  id: string;
  studyId: string;
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
