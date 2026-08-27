export const REPORT_DATE_RANGE_PRESETS = [
  'today',
  'yesterday',
  'this_week',
  'last_week',
  'this_month',
  'last_month',
  'custom',
  'all',
] as const;

export type ReportDateRangePreset = (typeof REPORT_DATE_RANGE_PRESETS)[number];

export interface ReportDateRange {
  preset: ReportDateRangePreset;
  from?: string;
  to?: string;
}

export interface DateRangeBounds {
  from: string | null;
  to: string | null;
}

export const REPORT_DATE_RANGE_PRESET_LABELS: Record<ReportDateRangePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This Week',
  last_week: 'Last Week',
  this_month: 'This Month',
  last_month: 'Last Month',
  custom: 'Custom Date Range',
  all: 'All Records',
};

/** Local calendar date as YYYY-MM-DD (avoids UTC day-shift on date-only values). */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Normalize a record date to YYYY-MM-DD using local calendar semantics. */
export function normalizeRecordDate(value: string | Date | null | undefined): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return toLocalDateString(parsed);
  }
  if (Number.isNaN(value.getTime())) return null;
  return toLocalDateString(value);
}

export function getDateRangeBounds(
  preset: ReportDateRangePreset,
  customFrom?: string,
  customTo?: string,
  now: Date = new Date(),
): DateRangeBounds {
  if (preset === 'all') return { from: null, to: null };

  const today = toLocalDateString(now);

  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      const y = toLocalDateString(d);
      return { from: y, to: y };
    }
    case 'this_week': {
      const start = new Date(now);
      start.setDate(start.getDate() - start.getDay());
      return { from: toLocalDateString(start), to: today };
    }
    case 'last_week': {
      const end = new Date(now);
      end.setDate(end.getDate() - end.getDay() - 1);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      return { from: toLocalDateString(start), to: toLocalDateString(end) };
    }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toLocalDateString(start), to: today };
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toLocalDateString(start), to: toLocalDateString(end) };
    }
    case 'custom': {
      const from = customFrom?.trim() || null;
      const to = customTo?.trim() || null;
      if (from && to && from > to) return { from: to, to: from };
      return { from, to };
    }
    default:
      return { from: null, to: null };
  }
}

export function getDateRangePreset(range: ReportDateRange, now: Date = new Date()): DateRangeBounds {
  return getDateRangeBounds(range.preset, range.from, range.to, now);
}

export function filterRecordsByDateRange<T>(
  records: T[],
  getRecordDate: (record: T) => string | Date | null | undefined,
  range: ReportDateRange,
  now: Date = new Date(),
): T[] {
  const bounds = getDateRangeBounds(range.preset, range.from, range.to, now);
  if (bounds.from === null && bounds.to === null) return records;

  return records.filter((record) => {
    const dateStr = normalizeRecordDate(getRecordDate(record));
    if (!dateStr) return false;
    if (bounds.from && dateStr < bounds.from) return false;
    if (bounds.to && dateStr > bounds.to) return false;
    return true;
  });
}

function formatDisplayDate(isoDate: string, locale = 'en'): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** User-facing reporting period label for print/PDF headers. */
export function formatReportingPeriodLabel(range: ReportDateRange, locale = 'en', now: Date = new Date()): string {
  if (range.preset === 'all') return 'All Records';

  const bounds = getDateRangeBounds(range.preset, range.from, range.to, now);
  const { from, to } = bounds;

  if (range.preset === 'today' || range.preset === 'yesterday') {
    if (from) return formatDisplayDate(from, locale);
  }

  if (from && to) {
    if (from === to) return formatDisplayDate(from, locale);
    return `${formatDisplayDate(from, locale)} – ${formatDisplayDate(to, locale)}`;
  }

  if (from) return `From ${formatDisplayDate(from, locale)}`;
  if (to) return `Through ${formatDisplayDate(to, locale)}`;
  return REPORT_DATE_RANGE_PRESET_LABELS[range.preset];
}

export const REPORTING_PERIOD_PREFIX = 'Reporting Period:';

export function formatReportingPeriodLine(range: ReportDateRange, locale = 'en', now: Date = new Date()): string {
  return `${REPORTING_PERIOD_PREFIX} ${formatReportingPeriodLabel(range, locale, now)}`;
}
