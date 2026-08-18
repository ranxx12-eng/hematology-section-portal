import { z } from 'zod';
import { MAINTENANCE_RESULTS, MAINTENANCE_SHIFTS, MAINTENANCE_TYPE_OPTIONS, MAINTENANCE_TYPES } from './constants';
import type { MaintenanceRecord } from '@/types';

export const maintenanceRecordFormSchema = z.object({
  instrumentId: z.string().uuid('Select an instrument'),
  maintenanceType: z.enum(MAINTENANCE_TYPE_OPTIONS),
  maintenanceDate: z.string().min(1, 'Completion date is required'),
  maintenanceTime: z.string().min(1, 'Completion time is required'),
  shift: z.enum(MAINTENANCE_SHIFTS),
  result: z.enum(MAINTENANCE_RESULTS),
  comments: z.string().optional(),
});

export type MaintenanceRecordFormData = z.infer<typeof maintenanceRecordFormSchema>;

export function emptyMaintenanceRecordForm(): MaintenanceRecordFormData {
  const now = new Date();
  return {
    instrumentId: '',
    maintenanceType: 'daily',
    maintenanceDate: now.toISOString().slice(0, 10),
    maintenanceTime: now.toTimeString().slice(0, 5),
    shift: 'morning',
    result: 'pass',
    comments: '',
  };
}

export function recordToForm(record: MaintenanceRecord): MaintenanceRecordFormData {
  const date = record.date.slice(0, 10);
  const time = record.date.length > 10
    ? new Date(record.date).toTimeString().slice(0, 5)
    : new Date().toTimeString().slice(0, 5);

  return {
    instrumentId: record.instrumentId,
    maintenanceType: (MAINTENANCE_TYPE_OPTIONS as readonly string[]).includes(record.maintenanceType)
      ? record.maintenanceType as MaintenanceRecordFormData['maintenanceType']
      : 'daily',
    maintenanceDate: date,
    maintenanceTime: time,
    shift: (MAINTENANCE_SHIFTS as readonly string[]).includes(record.shift)
      ? (record.shift as MaintenanceRecordFormData['shift'])
      : 'morning',
    result: record.result,
    comments: record.issueFound ?? '',
  };
}

export interface MaintenanceSummaryStats {
  total: number;
  pass: number;
  fail: number;
  reviewed: number;
  complianceRate: number;
}

export function computeMaintenanceSummary(records: Pick<MaintenanceRecord, 'result' | 'supervisorReview'>[]): MaintenanceSummaryStats {
  const total = records.length;
  const pass = records.filter((r) => r.result === 'pass').length;
  const fail = records.filter((r) => r.result === 'fail').length;
  const reviewed = records.filter((r) => r.supervisorReview).length;
  const complianceRate = total ? Math.round((pass / total) * 100) : 0;

  return { total, pass, fail, reviewed, complianceRate };
}
