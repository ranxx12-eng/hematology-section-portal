export type InstrumentItemType = 'instrument' | 'equipment';

export type EquipmentMaintenanceRecordType = 'ppm' | 'calibration';

export type EquipmentMaintenanceDueStatus =
  | 'completed'
  | 'due_soon'
  | 'overdue'
  | 'not_required';

export type EquipmentMaintenanceResult = 'pass' | 'fail' | 'conditional';

export interface EquipmentMaintenanceRecord {
  id: string;
  instrumentEquipmentId: string;
  recordType: EquipmentMaintenanceRecordType;
  performedDate: string;
  nextDueDate?: string;
  dueStatus: EquipmentMaintenanceDueStatus;
  performedBy: string;
  performedByName: string;
  performedByStaffId?: string;
  serviceProvider?: string;
  engineerName?: string;
  certificateNumber?: string;
  workOrderNumber?: string;
  ticketNumber?: string;
  result: EquipmentMaintenanceResult;
  comment?: string;
  attachmentPath?: string;
  attachmentName?: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedByStaffId?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstrumentMaintenanceSummary {
  instrumentId: string;
  instrumentName: string;
  itemType: InstrumentItemType;
  assetCode?: string;
  location?: string;
  lastPpmDate?: string;
  nextPpmDate?: string;
  ppmStatus: EquipmentMaintenanceDueStatus;
  lastCalibrationDate?: string;
  nextCalibrationDate?: string;
  calibrationStatus: EquipmentMaintenanceDueStatus;
  ppmRequired: boolean;
  calibrationRequired: boolean;
}

export interface PpmCalibrationDashboardStats {
  totalItems: number;
  ppmDueSoon: number;
  ppmOverdue: number;
  calibrationDueSoon: number;
  calibrationOverdue: number;
}

export type PpmCalibrationTab =
  | 'overview'
  | 'ppm'
  | 'calibration'
  | 'due_soon'
  | 'overdue'
  | 'history';
