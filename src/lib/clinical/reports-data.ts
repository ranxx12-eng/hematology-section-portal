import { fetchAuditLogs } from './audit-logs';
import { fetchInventoryItems } from './inventory';
import { fetchMaintenanceRecords } from './maintenance-records';
import { fetchQCRecords } from './qc-records';
import { fetchTrainingCourses } from './training';

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
