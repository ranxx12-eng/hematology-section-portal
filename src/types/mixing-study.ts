import type {
  MixingStudyAuditEvent,
  MixingStudyStatus,
  MixingTestSelection,
  MixingTestType,
} from '@/lib/medical-reports/form-hema-023/constants';

export interface MixingStudyResult {
  testType: MixingTestType;
  patientClottingTime: string | null;
  nppClottingTime: string | null;
  targetValue: string | null;
  immediateMixClottingTime: string | null;
  immediateRosnerIndex: string | null;
  immediateInterpretation: string | null;
  incubatedMixClottingTime: string | null;
  incubatedRosnerIndex: string | null;
  incubatedInterpretation: string | null;
  conclusion: string | null;
}

export interface MixingStudyEvent {
  eventType: MixingStudyAuditEvent;
  actorName: string | null;
  actorStaffId: string | null;
  performedAt: string;
}

export interface MixingStudy {
  id: string;
  studyNumber: string;
  testSelection: MixingTestSelection;
  studyDate: string;
  status: MixingStudyStatus;
  sampleReferencePresent: boolean;
  performedByName: string;
  performedByStaffId: string | null;
  submittedAt: string | null;
  reviewedByName: string | null;
  reviewedByStaffId: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  canEdit: boolean;
  canSubmit: boolean;
  canReview: boolean;
  canRequestChanges: boolean;
  canPrint: boolean;
  results: MixingStudyResult[];
  events: MixingStudyEvent[];
}

export interface MixingStudyListItem {
  id: string;
  studyNumber: string;
  testSelection: MixingTestSelection;
  studyDate: string;
  status: MixingStudyStatus;
  sampleReferencePresent: boolean;
  performedByName: string;
  performedByStaffId: string | null;
  reviewedByName: string | null;
  reviewedByStaffId: string | null;
  createdAt: string;
}
