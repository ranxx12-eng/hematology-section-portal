export type CentrifugePppSampleResult = 'pass' | 'fail';

export type CentrifugePppCalibrationStatus =
  | 'draft'
  | 'completed'
  | 'pending_review'
  | 'pending_approval'
  | 'approved'
  | 'failed';

export interface CentrifugePppCalibrationSample {
  id: string;
  calibrationId: string;
  sampleNumber: number;
  pltResult?: number;
  centrifugeSpeedRpm?: number;
  centrifugeTimeMinutes?: number;
  calculatedResult?: CentrifugePppSampleResult;
  evidencePath?: string;
  evidenceName?: string;
  evidenceUploadedBy?: string;
  evidenceUploadedByName?: string;
  evidenceUploadedByStaffId?: string;
  evidenceUploadedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CentrifugePppCalibration {
  id: string;
  instrumentEquipmentId: string;
  calibrationDate: string;
  nextDueDate?: string;
  performedByType: 'internal_staff' | 'external_engineer';
  performedByUserId: string;
  performedByName: string;
  performedByStaffId?: string;
  overallResult?: CentrifugePppSampleResult;
  status: CentrifugePppCalibrationStatus;
  problem?: string;
  correctiveAction?: string;
  comment?: string;
  reviewStatus: string;
  reviewDecision?: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedByStaffId?: string;
  reviewedAt?: string;
  reviewComment?: string;
  approvalStatus: string;
  approvalDecision?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedByStaffId?: string;
  approvedAt?: string;
  approvalComment?: string;
  finalPdfPath?: string;
  finalPdfName?: string;
  samples: CentrifugePppCalibrationSample[];
  createdAt: string;
  updatedAt: string;
}

export interface CentrifugePppCalibrationListItem {
  id: string;
  calibrationDate: string;
  overallResult?: CentrifugePppSampleResult;
  status: CentrifugePppCalibrationStatus;
  performedByName: string;
  reviewStatus: string;
  approvalStatus: string;
  hasFinalPdf: boolean;
  evidenceComplete: boolean;
}
