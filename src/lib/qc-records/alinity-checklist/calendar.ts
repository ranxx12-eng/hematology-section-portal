import { ALINITY_CHECKLIST_TIME_ZONE } from '@/lib/qc-records/alinity-checklist/constants';

export function daysInMonth(year: number, month: number): number {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Invalid checklist month');
  }
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isValidChecklistDay(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(day) || day < 1) return false;
  return day <= daysInMonth(year, month);
}

export interface RiyadhDateParts {
  year: number;
  month: number;
  day: number;
}

export function riyadhDateParts(isoTimestamp: string): RiyadhDateParts {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid QC timestamp');
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ALINITY_CHECKLIST_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value) throw new Error('Invalid QC timestamp');
    return Number(value);
  };
  return { year: read('year'), month: read('month'), day: read('day') };
}

export function checklistMonthLabel(year: number, month: number): string {
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  return label;
}
