import type { StatusChipVariant } from '@/components/ui/status-chip';
import type { Permission } from '@/lib/permissions/roles';
import {
  fetchDashboardCriticalValuesCount,
  fetchDashboardCvSummary,
  fetchDashboardInstruments,
  fetchDashboardPendingTasks,
  fetchDashboardQcOutRecords,
  fetchDashboardRecentActivity,
  fetchDashboardRejections,
  fetchDashboardUpcomingCalendar,
  getDashboardDateBounds,
} from './command-center-queries';

export interface CommandCenterAlert {
  id: string;
  title: string;
  context: string;
  time: string;
  severity: 'high' | 'medium' | 'low';
  href: string;
}

export interface CommandCenterTask {
  id: string;
  title: string;
  module: string;
  priority: string;
  dueDate: string;
  status: string;
  href: string;
}

export interface CommandCenterScheduleItem {
  id: string;
  title: string;
  date: string;
  type: string;
  href: string;
}

export interface CommandCenterInstrument {
  id: string;
  name: string;
  serialNumber?: string;
  statusLabel: string;
  statusVariant: StatusChipVariant;
}

export interface CommandCenterActivity {
  id: string;
  action: string;
  module: string;
  entity?: string;
  time: string;
}

export interface CommandCenterQuickAction {
  id: string;
  label: string;
  href: string;
  icon: string;
  permission?: Permission;
}

export interface CommandCenterSectionErrors {
  qc?: string;
  cv?: string;
  critical?: string;
  rejections?: string;
  tasks?: string;
  instruments?: string;
  calendar?: string;
  activity?: string;
}

export interface CommandCenterSummary {
  qcOutToday: number;
  qcOutThisMonth: number;
  qcOutWeeklyTrend: number[];
  highCvCount: number;
  highCvWeeklyTrend: number[];
  criticalValuesCount: number;
  rejectionsThisMonth: number;
  overdueActions: number;
  qualityHealthConfigured: false;
  criticalTatConfigured: false;
  rejectionRateConfigured: false;
  instruments: CommandCenterInstrument[];
  alerts: CommandCenterAlert[];
  pendingTasks: CommandCenterTask[];
  upcomingSchedule: CommandCenterScheduleItem[];
  rejectionReasons: Array<{ reason: string; count: number; percentage: number }>;
  rejectionTotalThisMonth: number;
  kpiTrendWeeks: string[];
  kpiTrendQcOut: number[];
  kpiTrendHighCv: number[];
  kpiTrendRejections: number[];
  recentActivity: CommandCenterActivity[];
  quickActions: CommandCenterQuickAction[];
  sectionErrors: CommandCenterSectionErrors;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function weekKey(d: Date): string {
  const start = startOfDay(d);
  start.setDate(start.getDate() - start.getDay());
  return start.toISOString().slice(0, 10);
}

function lastNWeekLabels(n: number): string[] {
  const labels: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    labels.push(weekKey(d));
  }
  return labels;
}

function countByWeek<T>(
  items: T[],
  getDate: (item: T) => string | Date | undefined,
  weeks: string[],
): number[] {
  const buckets = Object.fromEntries(weeks.map((w) => [w, 0]));
  for (const item of items) {
    const raw = getDate(item);
    if (!raw) continue;
    const key = weekKey(new Date(raw));
    if (key in buckets) buckets[key] += 1;
  }
  return weeks.map((w) => buckets[w] ?? 0);
}

function instrumentStatus(instrument: {
  status: string;
  active?: boolean;
  calibrationDueDate?: string;
  nextMaintenance?: string;
}): { label: string; variant: StatusChipVariant } {
  const today = startOfDay(new Date());
  if (instrument.active === false) {
    return { label: 'Inactive', variant: 'neutral' };
  }
  if (instrument.status === 'under_maintenance' || instrument.status === 'warning') {
    return { label: 'Maintenance Due', variant: 'warning' };
  }
  if (instrument.calibrationDueDate) {
    const due = startOfDay(new Date(instrument.calibrationDueDate));
    if (due <= today) return { label: 'Calibration Due', variant: 'danger' };
    const soon = new Date(today);
    soon.setDate(soon.getDate() + 14);
    if (due <= soon) return { label: 'Due Soon', variant: 'warning' };
  }
  if (instrument.nextMaintenance) {
    const due = startOfDay(new Date(instrument.nextMaintenance));
    if (due <= today) return { label: 'Maintenance Due', variant: 'warning' };
  }
  return { label: 'Operational', variant: 'success' };
}

const EMPTY_SUMMARY: Omit<CommandCenterSummary, 'quickActions' | 'sectionErrors'> = {
  qcOutToday: 0,
  qcOutThisMonth: 0,
  qcOutWeeklyTrend: [],
  highCvCount: 0,
  highCvWeeklyTrend: [],
  criticalValuesCount: 0,
  rejectionsThisMonth: 0,
  overdueActions: 0,
  qualityHealthConfigured: false,
  criticalTatConfigured: false,
  rejectionRateConfigured: false,
  instruments: [],
  alerts: [],
  pendingTasks: [],
  upcomingSchedule: [],
  rejectionReasons: [],
  rejectionTotalThisMonth: 0,
  kpiTrendWeeks: [],
  kpiTrendQcOut: [],
  kpiTrendHighCv: [],
  kpiTrendRejections: [],
  recentActivity: [],
};

function buildQuickActions(locale: string): CommandCenterQuickAction[] {
  return [
    { id: 'qa-qc', label: 'Record QC', href: `/${locale}/quality-control`, icon: 'FlaskConical', permission: 'qc.manage' },
    { id: 'qa-rejection', label: 'Record Rejection', href: `/${locale}/sample-rejections`, icon: 'TestTube2', permission: 'sample_rejections.manage' },
    { id: 'qa-critical', label: 'Critical Value', href: `/${locale}/critical-values`, icon: 'AlertTriangle', permission: 'critical_values.manage' },
    { id: 'qa-env', label: 'Temperature Log', href: `/${locale}/environmental-monitoring`, icon: 'Thermometer', permission: 'environmental.record' },
    { id: 'qa-cal', label: 'New Calibration', href: `/${locale}/ppm-calibration`, icon: 'Gauge', permission: 'ppm_calibration.create' },
    { id: 'qa-comparison', label: 'New Comparison', href: `/${locale}/quality/comparison-studies/new`, icon: 'GitCompare', permission: 'comparison.edit' },
    { id: 'qa-corrective', label: 'Corrective Action', href: `/${locale}/quality-control/corrective-actions`, icon: 'ClipboardCheck', permission: 'qc_corrective.edit' },
    { id: 'qa-docs', label: 'Document Upload', href: `/${locale}/documents`, icon: 'FileText', permission: 'documents.view' },
    { id: 'qa-reports', label: 'Run Report', href: `/${locale}/reports`, icon: 'BarChart3', permission: 'reports.view' },
  ];
}

export async function fetchCommandCenterSummary(
  locale: string,
  userId: string,
): Promise<CommandCenterSummary> {
  const now = new Date();
  const { todayStart, monthStart, trendStart } = getDashboardDateBounds(now);
  const weekLabels = lastNWeekLabels(8);
  const sectionErrors: CommandCenterSectionErrors = {};

  const totalStart = process.env.NODE_ENV === 'development' ? performance.now() : 0;

  const [
    qcSettled,
    cvSettled,
    criticalSettled,
    rejectionSettled,
    taskSettled,
    instrumentSettled,
    calendarSettled,
    auditSettled,
  ] = await Promise.allSettled([
    fetchDashboardQcOutRecords(trendStart),
    fetchDashboardCvSummary(),
    fetchDashboardCriticalValuesCount(),
    fetchDashboardRejections(trendStart),
    fetchDashboardPendingTasks(userId),
    fetchDashboardInstruments(),
    fetchDashboardUpcomingCalendar(todayStart),
    fetchDashboardRecentActivity(),
  ]);

  const qcResult = qcSettled.status === 'fulfilled'
    ? qcSettled.value
    : { data: [], error: 'Failed to load QC summary' };
  if (qcResult.error) sectionErrors.qc = qcResult.error;

  const cvResult = cvSettled.status === 'fulfilled'
    ? cvSettled.value
    : { data: { totalHighCv: 0, trendRows: [] }, error: 'Failed to load CV summary' };
  if (cvResult.error) sectionErrors.cv = cvResult.error;

  const criticalResult = criticalSettled.status === 'fulfilled'
    ? criticalSettled.value
    : { data: 0, error: 'Failed to load critical values' };
  if (criticalResult.error) sectionErrors.critical = criticalResult.error;

  const rejectionResult = rejectionSettled.status === 'fulfilled'
    ? rejectionSettled.value
    : { data: [], error: 'Failed to load rejections' };
  if (rejectionResult.error) sectionErrors.rejections = rejectionResult.error;

  const taskResult = taskSettled.status === 'fulfilled'
    ? taskSettled.value
    : { data: [], error: 'Failed to load tasks' };
  if (taskResult.error) sectionErrors.tasks = taskResult.error;

  const instrumentResult = instrumentSettled.status === 'fulfilled'
    ? instrumentSettled.value
    : { data: { instruments: [], overdueCalibration: 0 }, error: 'Failed to load instruments' };
  if (instrumentResult.error) sectionErrors.instruments = instrumentResult.error;

  const calendarResult = calendarSettled.status === 'fulfilled'
    ? calendarSettled.value
    : { data: [], error: 'Failed to load calendar' };
  if (calendarResult.error) sectionErrors.calendar = calendarResult.error;

  const auditResult = auditSettled.status === 'fulfilled'
    ? auditSettled.value
    : { data: [], error: 'Failed to load recent activity' };
  if (auditResult.error) sectionErrors.activity = auditResult.error;

  if (process.env.NODE_ENV === 'development') {
    const totalMs = Math.round(performance.now() - totalStart);
    // eslint-disable-next-line no-console
    console.debug(`[command-center] total summary: ${totalMs}ms`);
  }

  const qcOutRecords = qcResult.data;
  const qcOutToday = qcOutRecords.filter((r) => new Date(r.recordedAt) >= todayStart).length;
  const qcOutThisMonth = qcOutRecords.filter((r) => new Date(r.recordedAt) >= monthStart).length;
  const qcOutWeeklyTrend = countByWeek(qcOutRecords, (r) => r.recordedAt, weekLabels);

  const highCvCount = cvResult.data.totalHighCv;
  const highCvWeeklyTrend = countByWeek(
    cvResult.data.trendRows,
    (r) => (r.currentYear ? new Date(r.currentYear, (r.currentMonth ?? 1) - 1, 1) : undefined),
    weekLabels,
  );

  const rejections = rejectionResult.data;
  const rejectionsThisMonth = rejections.filter((r) => new Date(r.rejectionDate) >= monthStart);
  const rejectionWeeklyTrend = countByWeek(rejectionsThisMonth, (r) => r.rejectionDate, weekLabels);

  const reasonCounts = new Map<string, number>();
  for (const rejection of rejectionsThisMonth) {
    for (const reason of rejection.rejectionReasons ?? []) {
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
  }
  const rejectionTotal = [...reasonCounts.values()].reduce((a, b) => a + b, 0);
  const rejectionReasons = [...reasonCounts.entries()]
    .map(([reason, count]) => ({
      reason,
      count,
      percentage: rejectionTotal > 0 ? Math.round((count / rejectionTotal) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const openTasks = taskResult.data;
  const overdueTasks = openTasks.filter((t) => new Date(t.dueDate) < todayStart);

  const instruments = instrumentResult.data.instruments
    .filter((i) => i.active !== false)
    .slice(0, 8)
    .map((instrument) => {
      const status = instrumentStatus(instrument);
      return {
        id: instrument.id,
        name: instrument.name,
        serialNumber: instrument.serialNumber,
        statusLabel: status.label,
        statusVariant: status.variant,
      };
    });

  const overdueCalibration = instrumentResult.data.overdueCalibration;

  const alerts: CommandCenterAlert[] = [];
  const alertKeys = new Set<string>();

  const pushAlert = (alert: CommandCenterAlert) => {
    if (alertKeys.has(alert.id)) return;
    alertKeys.add(alert.id);
    alerts.push(alert);
  };

  if (qcOutToday > 0) {
    pushAlert({
      id: 'qc-out-today',
      title: 'QC OUT',
      context: `${qcOutToday} record(s) today require follow-up`,
      time: now.toISOString(),
      severity: 'high',
      href: `/${locale}/quality-control`,
    });
  }

  if (highCvCount > 0) {
    pushAlert({
      id: 'high-cv',
      title: 'High CV',
      context: `${highCvCount} analyte result(s) flagged across CV monitoring`,
      time: now.toISOString(),
      severity: 'medium',
      href: `/${locale}/quality/cv-monitoring`,
    });
  }

  if (overdueCalibration > 0) {
    pushAlert({
      id: 'cal-due',
      title: 'Calibration Due',
      context: `${overdueCalibration} instrument(s) past calibration due date`,
      time: now.toISOString(),
      severity: 'high',
      href: `/${locale}/ppm-calibration`,
    });
  }

  const unresolvedOut = qcOutRecords.filter((r) => r.resolutionStatus !== 'IN').length;
  if (unresolvedOut > 0 && qcOutToday === 0) {
    pushAlert({
      id: 'qc-out-open',
      title: 'Open QC OUT',
      context: `${unresolvedOut} unresolved QC OUT record(s)`,
      time: now.toISOString(),
      severity: 'medium',
      href: `/${locale}/quality-control/corrective-actions`,
    });
  }

  const pendingTasks: CommandCenterTask[] = openTasks.slice(0, 8).map((task) => ({
    id: task.id,
    title: task.title,
    module: 'Tasks',
    priority: task.priority,
    dueDate: task.dueDate,
    status: task.status.replace(/_/g, ' '),
    href: `/${locale}/tasks`,
  }));

  const upcomingSchedule: CommandCenterScheduleItem[] = calendarResult.data.map((event) => ({
    id: event.id,
    title: event.title,
    date: event.startDate,
    type: event.type ?? 'Calendar',
    href: `/${locale}/calendar`,
  }));

  const recentActivity: CommandCenterActivity[] = auditResult.data.map((log) => ({
    id: log.id,
    action: log.action,
    module: log.module,
    entity: log.recordId,
    time: log.createdAt,
  }));

  return {
    ...EMPTY_SUMMARY,
    qcOutToday,
    qcOutThisMonth,
    qcOutWeeklyTrend,
    highCvCount,
    highCvWeeklyTrend,
    criticalValuesCount: criticalResult.data,
    rejectionsThisMonth: rejectionsThisMonth.length,
    overdueActions: overdueTasks.length + overdueCalibration,
    instruments,
    alerts: alerts.slice(0, 8),
    pendingTasks,
    upcomingSchedule,
    rejectionReasons,
    rejectionTotalThisMonth: rejectionsThisMonth.length,
    kpiTrendWeeks: weekLabels.map((w) => w.slice(5)),
    kpiTrendQcOut: qcOutWeeklyTrend,
    kpiTrendHighCv: highCvWeeklyTrend,
    kpiTrendRejections: rejectionWeeklyTrend,
    recentActivity,
    quickActions: buildQuickActions(locale),
    sectionErrors,
  };
}
