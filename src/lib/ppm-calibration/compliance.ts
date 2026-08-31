import type {
  EquipmentMaintenanceDueStatus,
  EquipmentMaintenanceRecordType,
} from '@/types/ppm-calibration';
import { PPM_CALIBRATION_DUE_SOON_DAYS } from './constants';

function parseDateOnly(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00`);
}

export function isMaintenanceTypeRequired(
  frequency: string | null | undefined,
): boolean {
  if (!frequency) return true;
  const normalized = frequency.trim().toLowerCase();
  return normalized !== 'not_required' && normalized !== 'none' && normalized !== 'n/a';
}

export function computeDueStatus(
  nextDueDate: string | null | undefined,
  required: boolean,
  now = new Date(),
): EquipmentMaintenanceDueStatus {
  if (!required) return 'not_required';
  if (!nextDueDate) return 'overdue';

  const due = parseDateOnly(nextDueDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const warningEnd = new Date(today);
  warningEnd.setDate(warningEnd.getDate() + PPM_CALIBRATION_DUE_SOON_DAYS);

  if (due < today) return 'overdue';
  if (due <= warningEnd) return 'due_soon';
  return 'completed';
}

export function computeRecordDueStatus(
  record: { nextDueDate?: string | null; recordType: EquipmentMaintenanceRecordType },
  instrument: {
    ppmFrequency?: string | null;
    calibrationFrequency?: string | null;
  },
  now = new Date(),
): EquipmentMaintenanceDueStatus {
  const required = record.recordType === 'ppm'
    ? isMaintenanceTypeRequired(instrument.ppmFrequency)
    : isMaintenanceTypeRequired(instrument.calibrationFrequency);
  return computeDueStatus(record.nextDueDate, required, now);
}

export function dueStatusBadgeVariant(
  status: EquipmentMaintenanceDueStatus,
): 'success' | 'warning' | 'destructive' | 'secondary' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'due_soon':
      return 'warning';
    case 'overdue':
      return 'destructive';
    default:
      return 'secondary';
  }
}
