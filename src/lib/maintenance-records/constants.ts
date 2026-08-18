export const MAINTENANCE_TYPES = ['daily', 'weekly', 'monthly'] as const;

export const MAINTENANCE_TYPE_OPTIONS = [
  'daily',
  'weekly',
  'monthly',
  'preventive',
  'corrective',
  'emergency',
] as const;

export const MAINTENANCE_RESULTS = ['pass', 'fail', 'partial'] as const;

export const MAINTENANCE_SHIFTS = ['morning', 'evening', 'night'] as const;
