import { fetchAuditLogs } from './audit-logs';
import { fetchCorrectedResults } from './corrected-results';
import { fetchCriticalValues } from './critical-values';
import { fetchInventoryItems } from './inventory';
import { fetchInstruments } from './instruments';
import { fetchMaintenanceRecords } from './maintenance-records';
import { fetchPendingSamples } from './pending-samples';
import { fetchQCRecords } from './qc-records';
import { fetchSampleRejections } from './sample-rejections';
import { fetchTasks } from './tasks';
import { fetchTATRecords } from './tat-records';
import { fetchTrainingCourses } from './training';
import { fetchAnnouncements } from './announcements';
import { fetchCalendarEvents } from './calendar-events';
import { countDiscardDue } from '@/lib/sample-rejections/metrics';
import type { DashboardStats } from '@/types';
import type { Announcement, CalendarEvent } from '@/types/modules';
import type { CriticalValue, PendingSample, SampleRejection, TATRecord, Task } from '@/types';
import type { SystemSettings } from '@/types';
import type { DashboardImages } from '@/types/portal-content';

export async function fetchReportExportData(reportId: string) {
  switch (reportId) {
    case 'qc-summary': {
      const result = await fetchQCRecords();
      return result.data.slice(0, 100).map((r) => [r.parameter, r.level, r.qcStatus]);
    }
    case 'maintenance-log': {
      const result = await fetchMaintenanceRecords();
      return result.data.map((m) => [m.maintenanceType, m.date, m.result]);
    }
    case 'training-status': {
      const result = await fetchTrainingCourses();
      return result.data.map((c) => [c.title, c.category, c.status]);
    }
    case 'inventory-report': {
      const result = await fetchInventoryItems();
      return result.data.map((i) => [i.itemName, String(i.quantity), i.status]);
    }
    case 'audit-summary': {
      const result = await fetchAuditLogs();
      return result.data.map((a) => [a.action, a.module, a.createdAt]);
    }
    default:
      return [];
  }
}

export async function fetchOperationalStats() {
  const [qc, maintenance, training, inventory] = await Promise.all([
    fetchQCRecords(),
    fetchMaintenanceRecords(),
    fetchTrainingCourses(),
    fetchInventoryItems(),
  ]);

  return {
    qcCount: qc.data.length,
    maintenanceCount: maintenance.data.length,
    trainingCount: training.data.length,
    inventoryCount: inventory.data.length,
    openTasksEstimate: 0,
  };
}

export interface OperationalDashboardMetrics {
  qualityControl: number;
  maintenance: number;
  activeInstruments: number;
  tasks: number;
  criticalValues: number;
  sampleRejections: number;
  needToDiscardSample: number;
  pendingSamples: number;
}

export async function fetchOperationalDashboardMetrics(): Promise<OperationalDashboardMetrics> {
  const [
    qcRecords,
    maintenanceRecords,
    instruments,
    tasks,
    criticalValues,
    sampleRejections,
    pendingSamples,
  ] = await Promise.all([
    fetchQCRecords(),
    fetchMaintenanceRecords(),
    fetchInstruments(),
    fetchTasks(),
    fetchCriticalValues(),
    fetchSampleRejections(),
    fetchPendingSamples(),
  ]);

  return {
    qualityControl: qcRecords.data.length,
    maintenance: maintenanceRecords.data.length,
    activeInstruments: instruments.data.filter((instrument) => instrument.status === 'operational').length,
    tasks: tasks.data.filter((task) => !['completed', 'cancelled'].includes(task.status)).length,
    criticalValues: criticalValues.data.length,
    sampleRejections: sampleRejections.data.length,
    needToDiscardSample: countDiscardDue(sampleRejections.data),
    pendingSamples: pendingSamples.data.filter((sample) => sample.isActive).length,
  };
}

export interface DashboardWidgetData {
  settings: SystemSettings;
  dashboardImages: DashboardImages;
  criticalValues: CriticalValue[];
  sampleRejections: SampleRejection[];
  pendingSamples: PendingSample[];
  tatRecords: TATRecord[];
  announcements: Announcement[];
  calendarEvents: CalendarEvent[];
  tasks: Task[];
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const [
    criticalValues,
    sampleRejections,
    pendingSamples,
    correctedResults,
    tatRecords,
    tasks,
    instruments,
    inventory,
    training,
  ] = await Promise.all([
    fetchCriticalValues(),
    fetchSampleRejections(),
    fetchPendingSamples(),
    fetchCorrectedResults(),
    fetchTATRecords(),
    fetchTasks(),
    fetchInstruments(),
    fetchInventoryItems(),
    fetchTrainingCourses(),
  ]);

  const openTasks = tasks.data.filter((t) => !['completed', 'cancelled'].includes(t.status)).length;

  return {
    totalSamples: tatRecords.data.length + pendingSamples.data.length,
    routineSamples: tatRecords.data.filter((t) => t.priority === 'routine').length,
    statSamples: tatRecords.data.filter((t) => t.priority === 'stat').length,
    criticalValues: criticalValues.data.length,
    sampleRejections: sampleRejections.data.length,
    correctedResults: correctedResults.data.length,
    pendingSamples: pendingSamples.data.filter((p) => p.isActive).length,
    activeInstruments: instruments.data.filter((i) => i.status === 'operational').length,
    instrumentsUnderMaintenance: instruments.data.filter((i) => i.status === 'under_maintenance' || i.status === 'warning').length,
    expiringInventory: inventory.data.filter((i) => i.status === 'expired' || i.status === 'low_stock').length,
    trainingCompletionRate: training.data.length > 0 ? 78 : 0,
    openTasks,
  };
}

export async function fetchDashboardWidgetData(
  settings: SystemSettings,
  dashboardImages: DashboardImages,
): Promise<DashboardWidgetData> {
  const [
    criticalValues,
    sampleRejections,
    pendingSamples,
    tatRecords,
    announcements,
    calendarEvents,
    tasks,
  ] = await Promise.all([
    fetchCriticalValues(),
    fetchSampleRejections(),
    fetchPendingSamples(),
    fetchTATRecords(),
    fetchAnnouncements(),
    fetchCalendarEvents(),
    fetchTasks(),
  ]);

  return {
    settings,
    dashboardImages,
    criticalValues: criticalValues.data,
    sampleRejections: sampleRejections.data,
    pendingSamples: pendingSamples.data,
    tatRecords: tatRecords.data,
    announcements: announcements.data,
    calendarEvents: calendarEvents.data,
    tasks: tasks.data,
  };
}
