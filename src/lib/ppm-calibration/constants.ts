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
