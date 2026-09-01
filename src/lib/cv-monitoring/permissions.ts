import type { Permission } from '@/lib/permissions/roles';
import type { CvMonitoringListItem, CvMonitoringRecord, CvMonitoringStatus } from '@/types/cv-monitoring';

export function canViewCvMonitoring(can: (p: Permission) => boolean): boolean {
  return can('cv_monitoring.view');
}

export function canCreateCvMonitoring(can: (p: Permission) => boolean): boolean {
  return can('cv_monitoring.create');
}

export function canEditCvMonitoring(can: (p: Permission) => boolean): boolean {
  return can('cv_monitoring.edit');
}

export function canSubmitCvMonitoring(can: (p: Permission) => boolean): boolean {
  return can('cv_monitoring.submit');
}

export function canReviewCvMonitoring(can: (p: Permission) => boolean): boolean {
  return can('cv_monitoring.review');
}

export function canApproveCvMonitoring(can: (p: Permission) => boolean): boolean {
  return can('cv_monitoring.approve');
}

export function canExportCvMonitoring(can: (p: Permission) => boolean): boolean {
  return can('cv_monitoring.export');
}

export function canArchiveCvMonitoring(can: (p: Permission) => boolean): boolean {
  return can('cv_monitoring.archive');
}

export function canManageCvDefinitions(can: (p: Permission) => boolean): boolean {
  return can('cv_monitoring.manage_definitions');
}

export function isCvRecordEditable(record: Pick<CvMonitoringRecord, 'status'> | CvMonitoringStatus): boolean {
  const status = typeof record === 'string' ? record : record.status;
  return status === 'draft' || status === 'returned';
}

export function filterCvRecordsByTab<T extends Pick<CvMonitoringListItem, 'status' | 'overallStatus'>>(
  records: T[],
  tab: string,
): T[] {
  switch (tab) {
    case 'draft':
      return records.filter((r) => r.status === 'draft');
    case 'pending_review':
      return records.filter((r) => r.status === 'pending_review' || r.status === 'submitted');
    case 'pending_approval':
      return records.filter((r) => r.status === 'pending_approval');
    case 'approved':
      return records.filter((r) => r.status === 'approved');
    case 'high_cv':
      return records.filter((r) => r.overallStatus === 'high_cv_detected');
    case 'archived':
      return records.filter((r) => r.status === 'archived');
    default:
      return records.filter((r) => r.status !== 'archived');
  }
}
