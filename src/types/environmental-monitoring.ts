export type EnvironmentalAssetType =
  | 'refrigerator'
  | 'cold_room'
  | 'storage_room'
  | 'room_temperature';

export type EnvironmentalReadingStatus = 'in_range' | 'out_of_range';
export type EnvironmentalReadingSource = 'qr' | 'portal';
export type EnvironmentalExcursionStatus =
  | 'open'
  | 'under_action'
  | 'awaiting_recheck'
  | 'resolved'
  | 'voided';

export type EnvironmentalReviewDecision = 'accept' | 'not_accept' | 'need_follow_up';
export type EnvironmentalOutOfRangeParameters = 'temperature' | 'humidity' | 'temperature_humidity';
export type EnvironmentalWindowComplianceStatus =
  | 'upcoming'
  | 'due'
  | 'completed'
  | 'missing';

export interface EnvironmentalAsset {
  id: string;
  assetCode: string;
  assetName: string;
  assetType: EnvironmentalAssetType;
  location?: string;
  serialNumber?: string;
  description?: string;
  minTemperature: number;
  maxTemperature: number;
  humidityMin?: number;
  humidityMax?: number;
  humidityRequired: boolean;
  monitoringFrequency: string;
  qrToken: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentalMonitoringWindow {
  id: string;
  assetId: string;
  windowName: string;
  startTime: string;
  endTime: string;
  required: boolean;
  daysOfWeek: number[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentalReading {
  id: string;
  assetId: string;
  monitoringWindowId?: string;
  recordedAt: string;
  temperature: number;
  humidity?: number;
  calculatedStatus: EnvironmentalReadingStatus;
  rangeMinAtReading: number;
  rangeMaxAtReading: number;
  humidityMinAtReading?: number;
  humidityMaxAtReading?: number;
  outOfRangeParameters?: EnvironmentalOutOfRangeParameters;
  performedByUserId: string;
  performedByName: string;
  performedByStaffId?: string;
  source: EnvironmentalReadingSource;
  comment?: string;
  voidedAt?: string;
  voidedBy?: string;
  voidedByName?: string;
  voidedByStaffId?: string;
  voidReason?: string;
  createdAt: string;
}

export interface EnvironmentalReadingCorrection {
  id: string;
  readingId: string;
  previousTemperature: number;
  newTemperature: number;
  previousHumidity?: number;
  newHumidity?: number;
  correctionReason: string;
  correctedByUserId: string;
  correctedByName: string;
  correctedByStaffId?: string;
  correctedAt: string;
}

export interface EnvironmentalExcursion {
  id: string;
  readingId: string;
  assetId: string;
  detectedAt: string;
  detectedTemperature: number;
  detectedHumidity?: number;
  rangeMinAtDetection: number;
  rangeMaxAtDetection: number;
  humidityMinAtDetection?: number;
  humidityMaxAtDetection?: number;
  humidityRequiredAtDetection?: boolean;
  outOfRangeParameters?: EnvironmentalOutOfRangeParameters;
  status: EnvironmentalExcursionStatus;
  immediateAction?: string;
  affectedMaterial?: string;
  maintenanceTicketNumber?: string;
  additionalComment?: string;
  recheckTemperature?: number;
  recheckHumidity?: number;
  recheckAt?: string;
  recheckedByUserId?: string;
  recheckedByName?: string;
  recheckedByStaffId?: string;
  resolutionStatus?: string;
  resolutionComment?: string;
  resolvedAt?: string;
  resolvedByUserId?: string;
  resolvedByName?: string;
  resolvedByStaffId?: string;
  reviewStatus: 'Pending Review' | 'Reviewed';
  reviewDecision?: EnvironmentalReviewDecision;
  reviewComment?: string;
  reviewedByUserId?: string;
  reviewedByName?: string;
  reviewedByStaffId?: string;
  reviewedAt?: string;
  voidedAt?: string;
  voidReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentalAuditEvent {
  id: string;
  module: string;
  recordType: string;
  recordId: string;
  eventType: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  performedByUserId?: string;
  performedByName?: string;
  performedByStaffId?: string;
  performedAt: string;
  reason?: string;
}

export interface EnvironmentalDashboardStats {
  dailyCompliancePercent: number;
  missingReadings: number;
  excursionsThisMonth: number;
  openExcursions: number;
}

export interface EnvironmentalAssetStatusRow {
  asset: EnvironmentalAsset;
  acceptableRangeLabel: string;
  lastReading?: EnvironmentalReading;
  displayStatus: 'IN RANGE' | 'OUT OF RANGE' | 'DUE' | 'MISSING' | 'NO READING';
  lastCheckedAt?: string;
  performedBy?: string;
  nextDueWindow?: string;
}
