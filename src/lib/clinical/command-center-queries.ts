import { createClient } from '@/lib/supabase/client';

export interface QueryResult<T> {
  data: T;
  error: string | null;
}

const DEV_TIMING = process.env.NODE_ENV === 'development';

async function measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!DEV_TIMING) return fn();
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const ms = Math.round(performance.now() - start);
    // eslint-disable-next-line no-console
    console.debug(`[command-center] ${label}: ${ms}ms`);
  }
}

function isoDate(d: Date): string {
  return d.toISOString();
}

export function getDashboardDateBounds(now = new Date()) {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const trendStart = new Date(now);
  trendStart.setDate(trendStart.getDate() - 8 * 7);
  trendStart.setHours(0, 0, 0, 0);

  return { todayStart, monthStart, trendStart };
}

export interface DashboardQcOutRow {
  id: string;
  recordedAt: string;
  resolutionStatus: string;
}

export async function fetchDashboardQcOutRecords(
  trendStart: Date,
): Promise<QueryResult<DashboardQcOutRow[]>> {
  return measure('qc-out', async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('qc_records')
        .select('id, recorded_at, resolution_status')
        .is('deleted_at', null)
        .eq('qc_status', 'OUT')
        .gte('recorded_at', isoDate(trendStart))
        .order('recorded_at', { ascending: false });

      if (error) return { data: [], error: error.message };

      return {
        data: (data ?? []).map((row) => ({
          id: row.id as string,
          recordedAt: row.recorded_at as string,
          resolutionStatus: row.resolution_status as string,
        })),
        error: null,
      };
    } catch (err) {
      return {
        data: [],
        error: err instanceof Error ? err.message : 'Failed to load QC summary',
      };
    }
  });
}

export interface DashboardCvTrendRow {
  recordId: string;
  currentYear: number;
  currentMonth: number;
  highCvCount: number;
}

export async function fetchDashboardCvSummary(): Promise<
  QueryResult<{ totalHighCv: number; trendRows: DashboardCvTrendRow[] }>
> {
  return measure('cv-summary', async () => {
    try {
      const supabase = createClient();
      const now = new Date();
      const trendStart = new Date(now);
      trendStart.setDate(trendStart.getDate() - 8 * 7);
      const cutoffYear = trendStart.getFullYear();
      const cutoffMonth = trendStart.getMonth() + 1;

      const [totalRes, recordsRes] = await Promise.all([
        supabase
          .from('cv_monitoring_results')
          .select('id, cv_monitoring_monthly_records!inner(deleted_at)', { count: 'exact', head: true })
          .eq('current_status', 'high_cv')
          .is('cv_monitoring_monthly_records.deleted_at', null),
        supabase
          .from('cv_monitoring_monthly_records')
          .select('id, current_year, current_month')
          .is('deleted_at', null)
          .or(
            `current_year.gt.${cutoffYear},and(current_year.eq.${cutoffYear},current_month.gte.${cutoffMonth})`,
          ),
      ]);

      if (totalRes.error) {
        return { data: { totalHighCv: 0, trendRows: [] }, error: totalRes.error.message };
      }
      if (recordsRes.error) {
        return { data: { totalHighCv: 0, trendRows: [] }, error: recordsRes.error.message };
      }

      const recordIds = (recordsRes.data ?? []).map((row) => row.id as string);
      let highCvByRecord = new Map<string, number>();

      if (recordIds.length > 0) {
        const { data: highCvRows, error: highCvError } = await supabase
          .from('cv_monitoring_results')
          .select('monthly_record_id')
          .in('monthly_record_id', recordIds)
          .eq('current_status', 'high_cv');

        if (highCvError) {
          return { data: { totalHighCv: 0, trendRows: [] }, error: highCvError.message };
        }

        for (const row of highCvRows ?? []) {
          const id = row.monthly_record_id as string;
          highCvByRecord.set(id, (highCvByRecord.get(id) ?? 0) + 1);
        }
      }

      const trendRows: DashboardCvTrendRow[] = (recordsRes.data ?? [])
        .map((row) => ({
          recordId: row.id as string,
          currentYear: row.current_year as number,
          currentMonth: row.current_month as number,
          highCvCount: highCvByRecord.get(row.id as string) ?? 0,
        }))
        .filter((row) => row.highCvCount > 0);

      return {
        data: {
          totalHighCv: totalRes.count ?? 0,
          trendRows,
        },
        error: null,
      };
    } catch (err) {
      return {
        data: { totalHighCv: 0, trendRows: [] },
        error: err instanceof Error ? err.message : 'Failed to load CV summary',
      };
    }
  });
}

export async function fetchDashboardCriticalValuesCount(): Promise<QueryResult<number>> {
  return measure('critical-values-count', async () => {
    try {
      const supabase = createClient();
      const { count, error } = await supabase
        .from('critical_values')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null);

      if (error) return { data: 0, error: error.message };
      return { data: count ?? 0, error: null };
    } catch (err) {
      return {
        data: 0,
        error: err instanceof Error ? err.message : 'Failed to load critical values count',
      };
    }
  });
}

export interface DashboardRejectionRow {
  id: string;
  rejectionDate: string;
  rejectionReasons: string[];
}

export async function fetchDashboardRejections(
  trendStart: Date,
): Promise<QueryResult<DashboardRejectionRow[]>> {
  return measure('rejections', async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('sample_rejections')
        .select('id, rejection_date, rejection_reasons')
        .is('deleted_at', null)
        .gte('rejection_date', trendStart.toISOString().slice(0, 10))
        .order('rejection_date', { ascending: false });

      if (error) return { data: [], error: error.message };

      return {
        data: (data ?? []).map((row) => ({
          id: row.id as string,
          rejectionDate: row.rejection_date as string,
          rejectionReasons: (row.rejection_reasons as string[] | null) ?? [],
        })),
        error: null,
      };
    } catch (err) {
      return {
        data: [],
        error: err instanceof Error ? err.message : 'Failed to load rejections',
      };
    }
  });
}

export interface DashboardTaskRow {
  id: string;
  title: string;
  priority: string;
  dueDate: string;
  status: string;
}

export async function fetchDashboardPendingTasks(
  userId: string,
): Promise<QueryResult<DashboardTaskRow[]>> {
  return measure('tasks', async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, priority, due_date, status')
        .is('deleted_at', null)
        .eq('assigned_to', userId)
        .not('status', 'in', '("completed","cancelled")')
        .order('due_date', { ascending: true })
        .limit(20);

      if (error) return { data: [], error: error.message };

      return {
        data: (data ?? []).map((row) => ({
          id: row.id as string,
          title: row.title as string,
          priority: row.priority as string,
          dueDate: row.due_date as string,
          status: row.status as string,
        })),
        error: null,
      };
    } catch (err) {
      return {
        data: [],
        error: err instanceof Error ? err.message : 'Failed to load tasks',
      };
    }
  });
}

export interface DashboardInstrumentRow {
  id: string;
  name: string;
  serialNumber?: string;
  status: string;
  active?: boolean;
  calibrationDueDate?: string;
  nextMaintenance?: string;
}

export async function fetchDashboardInstruments(): Promise<
  QueryResult<{ instruments: DashboardInstrumentRow[]; overdueCalibration: number }>
> {
  return measure('instruments', async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('instruments')
        .select('id, name, serial_number, status, active, calibration_due_date, next_maintenance')
        .is('deleted_at', null)
        .order('name');

      if (error) return { data: { instruments: [], overdueCalibration: 0 }, error: error.message };

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const instruments: DashboardInstrumentRow[] = (data ?? []).map((row) => ({
        id: row.id as string,
        name: row.name as string,
        serialNumber: (row.serial_number as string | null) ?? undefined,
        status: row.status as string,
        active: row.active as boolean | undefined,
        calibrationDueDate: (row.calibration_due_date as string | null) ?? undefined,
        nextMaintenance: (row.next_maintenance as string | null) ?? undefined,
      }));

      const overdueCalibration = instruments.filter((i) => {
        if (i.active === false || !i.calibrationDueDate) return false;
        return new Date(i.calibrationDueDate) <= todayStart;
      }).length;

      return {
        data: { instruments, overdueCalibration },
        error: null,
      };
    } catch (err) {
      return {
        data: { instruments: [], overdueCalibration: 0 },
        error: err instanceof Error ? err.message : 'Failed to load instruments',
      };
    }
  });
}

export interface DashboardCalendarRow {
  id: string;
  title: string;
  startDate: string;
  type: string;
}

export async function fetchDashboardUpcomingCalendar(
  todayStart: Date,
): Promise<QueryResult<DashboardCalendarRow[]>> {
  return measure('calendar', async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('calendar_events')
        .select('id, title, starts_at, event_type')
        .is('deleted_at', null)
        .gte('starts_at', isoDate(todayStart))
        .order('starts_at', { ascending: true })
        .limit(6);

      if (error) return { data: [], error: error.message };

      return {
        data: (data ?? []).map((row) => ({
          id: row.id as string,
          title: row.title as string,
          startDate: row.starts_at as string,
          type: (row.event_type as string | null) ?? 'Calendar',
        })),
        error: null,
      };
    } catch (err) {
      return {
        data: [],
        error: err instanceof Error ? err.message : 'Failed to load calendar',
      };
    }
  });
}

export interface DashboardAuditRow {
  id: string;
  action: string;
  module: string;
  recordId?: string;
  createdAt: string;
}

export async function fetchDashboardRecentActivity(): Promise<QueryResult<DashboardAuditRow[]>> {
  return measure('audit-activity', async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, action, module, record_id, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) return { data: [], error: error.message };

      return {
        data: (data ?? []).map((row) => ({
          id: row.id as string,
          action: row.action as string,
          module: row.module as string,
          recordId: (row.record_id as string | null) ?? undefined,
          createdAt: row.created_at as string,
        })),
        error: null,
      };
    } catch (err) {
      return {
        data: [],
        error: err instanceof Error ? err.message : 'Failed to load recent activity',
      };
    }
  });
}
