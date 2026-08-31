import type {
  EnvironmentalAssetType,
  EnvironmentalExcursionStatus,
  EnvironmentalReadingStatus,
  EnvironmentalReviewDecision,
} from '@/types/environmental-monitoring';

export const ENVIRONMENTAL_ASSET_TYPES: EnvironmentalAssetType[] = [
  'refrigerator',
  'cold_room',
  'storage_room',
  'room_temperature',
];

export const ENVIRONMENTAL_ASSET_TYPE_LABELS: Record<EnvironmentalAssetType, string> = {
  refrigerator: 'Refrigerator',
  cold_room: 'Cold Room',
  storage_room: 'Storage Room',
  room_temperature: 'Room Temperature',
};

export const ENVIRONMENTAL_READING_STATUS_LABELS: Record<EnvironmentalReadingStatus, string> = {
  in_range: 'IN RANGE',
  out_of_range: 'OUT OF RANGE',
};

export const ENVIRONMENTAL_EXCURSION_STATUS_LABELS: Record<EnvironmentalExcursionStatus, string> = {
  open: 'Open',
  under_action: 'Under Action',
  awaiting_recheck: 'Awaiting Recheck',
  resolved: 'Resolved',
  voided: 'Voided',
};

export const ENVIRONMENTAL_REVIEW_DECISION_LABELS: Record<EnvironmentalReviewDecision, string> = {
  accept: 'Accept',
  not_accept: 'Not Accept',
  need_follow_up: 'Need Follow Up',
};

export const ENVIRONMENTAL_AUDIT_EVENT_TYPES = [
  'ASSET_CREATED',
  'ASSET_UPDATED',
  'READING_CREATED',
  'READING_CORRECTED',
  'READING_VOIDED',
  'EXCURSION_CREATED',
  'EXCURSION_ACTION_ADDED',
  'EXCURSION_RECHECKED',
  'EXCURSION_REVIEWED',
  'EXCURSION_RESOLVED',
  'EXCURSION_VOIDED',
] as const;

export const DEFAULT_MONITORING_WINDOWS = [
  { windowName: 'AM Shift', startTime: '07:00', endTime: '15:00' },
  { windowName: 'PM Shift', startTime: '15:00', endTime: '23:00' },
  { windowName: 'Night Shift', startTime: '23:00', endTime: '07:00' },
] as const;

export const OUT_OF_RANGE_PARAMETER_LABELS = {
  temperature: 'Temperature Out of Range',
  humidity: 'Humidity Out of Range',
  temperature_humidity: 'Temperature + Humidity Out of Range',
} as const;

export const ENVIRONMENTAL_MODULE_KEY = 'environmental_monitoring';
