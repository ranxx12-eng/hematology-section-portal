export type StainQcFormCode = 'Form-Hema-021' | 'Form-Hema-039';

export type StainQcWorkflowStatus = 'draft' | 'submitted' | 'reviewed' | 'approved';

export type StainQcCellStatus = 'acceptable' | 'not_acceptable' | 'na';

export type StainQcOverallEvaluation = 'acceptable' | 'not_acceptable' | 'na';

export type StainQcResponsibilityType =
  | 'slide_prepared'
  | 'slide_checked'
  | 'qc_correction_change_stain';

export interface StainQcCriterion {
  id: string;
  formCode: StainQcFormCode;
  criterionKey: string;
  sectionKey: string;
  sectionLabel: string;
  rowLabel: string;
  componentLabel?: string;
  idealColor?: string;
  displayOrder: number;
}

export interface StainQcDailyResult {
  id: string;
  sheetId: string;
  formCode: StainQcFormCode;
  criterionKey: string;
  dayOfMonth: number;
  resultStatus: StainQcCellStatus;
  lotNumberSnapshot: string;
  recordedBy: string;
  recordedByName: string;
  recordedByStaffId?: string;
  recordedByEmployeeId?: string;
  recordedByInitials: string;
  recordedAt: string;
  lastUpdatedBy?: string;
  lastUpdatedByName?: string;
  lastUpdatedAt?: string;
  amendmentReason?: string;
}

export interface StainQcResponsibilityEntry {
  id: string;
  sheetId: string;
  formCode: StainQcFormCode;
  responsibilityType: StainQcResponsibilityType;
  dayOfMonth: number;
  lotNumberSnapshot: string;
  recordedBy: string;
  recordedByName: string;
  recordedByStaffId?: string;
  recordedByEmployeeId?: string;
  recordedByInitials: string;
  recordedAt: string;
  note?: string;
}

export interface StainQcCorrectiveAction {
  id: string;
  sheetId: string;
  dailyResultId: string;
  formCode: StainQcFormCode;
  criterionKey: string;
  dayOfMonth: number;
  lotNumberSnapshot: string;
  comment: string;
  recordedBy: string;
  recordedByName: string;
  recordedByStaffId?: string;
  recordedAt: string;
}

export interface StainQcMonthlySheet {
  id: string;
  sheetNumber: string;
  formCode: StainQcFormCode;
  formTitle: string;
  stainName: string;
  lotNumber: string;
  expiryDate: string;
  sheetMonth: number;
  sheetYear: number;
  overallEvaluation?: StainQcOverallEvaluation;
  status: StainQcWorkflowStatus;
  versionNumber: number;
  parentSheetId?: string;
  amendmentReason?: string;
  submittedBy?: string;
  submittedByName?: string;
  submittedByStaffId?: string;
  submittedAt?: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface StainQcMonthlySheetDetail extends StainQcMonthlySheet {
  criteria: StainQcCriterion[];
  dailyResults: StainQcDailyResult[];
  responsibilityEntries: StainQcResponsibilityEntry[];
  correctiveActions: StainQcCorrectiveAction[];
}

export interface StainQcListItem extends StainQcMonthlySheet {
  completionPercent: number;
  missingRequiredCount: number;
  notAcceptableCount: number;
  pendingCorrectiveCount: number;
}

export interface StainQcCellKey {
  criterionKey: string;
  dayOfMonth: number;
}

export type StainQcDailyGrid = Record<string, Record<number, StainQcDailyResult | undefined>>;

export type StainQcResponsibilityGrid = Record<StainQcResponsibilityType, Record<number, StainQcResponsibilityEntry | undefined>>;
