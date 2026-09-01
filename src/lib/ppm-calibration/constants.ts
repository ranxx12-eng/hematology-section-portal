export const PPM_CALIBRATION_DUE_SOON_DAYS = 30;

export const INSTRUMENT_ITEM_TYPES = ['instrument', 'equipment'] as const;

export const INSTRUMENT_ITEM_TYPE_LABELS: Record<'instrument' | 'equipment', string> = {
  instrument: 'Instrument',
  equipment: 'Equipment',
};

export const EQUIPMENT_MAINTENANCE_RECORD_TYPES = ['ppm', 'calibration'] as const;

export const EQUIPMENT_MAINTENANCE_RESULTS = ['pass', 'fail', 'conditional'] as const;

export const DUE_STATUS_LABELS: Record<
  import('@/types/ppm-calibration').EquipmentMaintenanceDueStatus,
  string
> = {
  completed: 'Completed',
  due_soon: 'Due Soon',
  overdue: 'Overdue',
  not_required: 'Not Required',
};

export const PPM_CALIBRATION_BUCKET = 'ppm-calibration-files';

export const PPM_CALIBRATION_STORAGE_PREFIX = 'ppm-calibration';

export const PPM_FREQUENCY_VALUES = ['annual', 'semi_annual', 'quarterly', 'monthly', 'not_required'] as const;

export const PPM_FREQUENCY_LABELS: Record<(typeof PPM_FREQUENCY_VALUES)[number], string> = {
  annual: 'Annually',
  semi_annual: 'Semi-Annual',
  quarterly: 'Quarterly',
  monthly: 'Monthly',
  not_required: 'Not Required',
};

export const EQUIPMENT_CATEGORY_VALUES = [
  'pipette',
  'refrigerator',
  'centrifuge',
  'microscope',
  'other',
] as const;

export const EQUIPMENT_CATEGORY_LABELS: Record<(typeof EQUIPMENT_CATEGORY_VALUES)[number], string> = {
  pipette: 'Pipette',
  refrigerator: 'Refrigerator',
  centrifuge: 'Centrifuge',
  microscope: 'Microscope',
  other: 'Other',
};

export const CALIBRATION_PERFORMER_TYPES = ['internal_staff', 'external_engineer'] as const;

export const CALIBRATION_PERFORMER_TYPE_LABELS: Record<(typeof CALIBRATION_PERFORMER_TYPES)[number], string> = {
  internal_staff: 'Internal Staff',
  external_engineer: 'External Engineer',
};

export const OPERATIONAL_STATUS_VALUES = ['active', 'inactive', 'out_of_service'] as const;

export const OPERATIONAL_STATUS_LABELS: Record<(typeof OPERATIONAL_STATUS_VALUES)[number], string> = {
  active: 'Active',
  inactive: 'Inactive',
  out_of_service: 'Out of Service',
};

export function normalizeMaintenanceFrequency(value: string | undefined | null): string | undefined {
  if (!value?.trim()) return undefined;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['annual', 'annually', 'annualy', 'yearly', '12_months'].includes(normalized)) return 'annual';
  if (['semi_annual', 'semiannual', 'semiannual', '6_months'].includes(normalized)) return 'semi_annual';
  if (['quarterly', 'quarter'].includes(normalized)) return 'quarterly';
  if (['monthly', 'month'].includes(normalized)) return 'monthly';
  if (['not_required', 'none', 'n_a', 'na'].includes(normalized)) return 'not_required';
  return normalized;
}

export function formatMaintenanceFrequency(value: string | undefined | null): string {
  const normalized = normalizeMaintenanceFrequency(value);
  if (!normalized) return '—';
  return PPM_FREQUENCY_LABELS[normalized as keyof typeof PPM_FREQUENCY_LABELS] ?? value ?? '—';
}
