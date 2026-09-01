import type { Permission } from '@/lib/permissions/roles';

export function canViewMedicalReports(can: (p: Permission) => boolean): boolean {
  return can('medical_reports.view');
}

export function canCreateMedicalReports(can: (p: Permission) => boolean): boolean {
  return can('medical_reports.create');
}

export function canEditMedicalReports(can: (p: Permission) => boolean): boolean {
  return can('medical_reports.edit');
}

export function canReviewMedicalReports(can: (p: Permission) => boolean): boolean {
  return can('medical_reports.review');
}

export function canApproveMedicalReports(can: (p: Permission) => boolean): boolean {
  return can('medical_reports.approve');
}

export function canPrintMedicalReports(can: (p: Permission) => boolean): boolean {
  return can('medical_reports.print');
}
