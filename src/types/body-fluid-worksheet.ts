export type BodyFluidWorksheetStatus = 'draft' | 'submitted';

export type BodyFluidSpecimenType =
  | 'csf'
  | 'pleural'
  | 'peritoneal'
  | 'synovial'
  | 'pericardial'
  | 'other';

export type BodyFluidClotStatus = 'clotted' | 'not_clotted';

export type BodyFluidAgreementResult = 'not_performed' | 'acceptable' | 'discrepancy';

export type BodyFluidCellType = 'wbc' | 'rbc';

export interface BodyFluidCountEntry {
  id?: string;
  worksheetId?: string;
  techNumber: 1 | 2;
  cellType: BodyFluidCellType;
  squareNumber: number;
  countValue?: number;
}

export interface BodyFluidWorksheet {
  id: string;
  patientLabelReference: string;
  timeReceived?: string;
  specimenType?: BodyFluidSpecimenType;
  specimenTypeOther?: string;
  tubeNumber?: string;
  clotStatus?: BodyFluidClotStatus;
  colorAppearance?: string;
  chamberBackground?: string;
  dilutionUsed: boolean;
  dilutionBackgroundOk?: boolean;
  dilutionFactor?: number;
  secondTechEnabled: boolean;
  primaryTechUserId: string;
  primaryTechName: string;
  primaryTechStaffId?: string;
  secondTechUserId?: string;
  secondTechName?: string;
  secondTechStaffId?: string;
  tech1TotalWbc?: number;
  tech1AvgWbc?: number;
  tech1TotalRbc?: number;
  tech1AvgRbc?: number;
  tech2TotalWbc?: number;
  tech2AvgWbc?: number;
  tech2TotalRbc?: number;
  tech2AvgRbc?: number;
  wbcAgreement: BodyFluidAgreementResult;
  rbcAgreement: BodyFluidAgreementResult;
  finalWbc?: number;
  finalRbc?: number;
  differentialNeutrophils?: number;
  differentialLymphocytes?: number;
  differentialMonocytes?: number;
  differentialOtherType?: string;
  differentialOtherQuantity?: number;
  comments?: string;
  pathologistName?: string;
  pathologistStaffId?: string;
  pathologistReviewedAt?: string;
  pathologistComment?: string;
  status: BodyFluidWorksheetStatus;
  submittedAt?: string;
  counts: BodyFluidCountEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface BodyFluidWorksheetListItem {
  id: string;
  patientLabelReference: string;
  specimenType?: BodyFluidSpecimenType;
  timeReceived?: string;
  primaryTechName: string;
  status: BodyFluidWorksheetStatus;
  finalWbc?: number;
  finalRbc?: number;
  submittedAt?: string;
  createdAt: string;
}
