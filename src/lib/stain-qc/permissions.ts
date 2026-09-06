import type { Permission } from '@/lib/permissions/roles';
import type { StainQcMonthlySheet, StainQcWorkflowStatus } from '@/types/stain-qc';

export function canViewStainQc(can: (p: Permission) => boolean): boolean {
  return can('stain_qc.view');
}

export function canRecordStainQc(can: (p: Permission) => boolean): boolean {
  return can('stain_qc.record');
}

export function canSubmitStainQc(can: (p: Permission) => boolean): boolean {
  return can('stain_qc.submit');
}

export function canReviewStainQc(can: (p: Permission) => boolean): boolean {
  return can('stain_qc.review');
}

export function canApproveStainQc(can: (p: Permission) => boolean): boolean {
  return can('stain_qc.approve');
}

export function canExportStainQc(can: (p: Permission) => boolean): boolean {
  return can('stain_qc.export');
}

export function canAmendStainQc(can: (p: Permission) => boolean): boolean {
  return can('stain_qc.amend');
}

export function isStainQcSheetEditable(status: StainQcWorkflowStatus): boolean {
  return status === 'draft';
}

export function canReviewStainQcSheet(
  sheet: Pick<StainQcMonthlySheet, 'status' | 'submittedBy'>,
  userId: string,
  can: (p: Permission) => boolean,
): boolean {
  return sheet.status === 'submitted'
    && canReviewStainQc(can)
    && sheet.submittedBy !== userId;
}

export function canApproveStainQcSheet(
  sheet: Pick<StainQcMonthlySheet, 'status'>,
  can: (p: Permission) => boolean,
): boolean {
  return sheet.status === 'reviewed' && canApproveStainQc(can);
}

export function canSubmitStainQcSheet(
  sheet: Pick<StainQcMonthlySheet, 'status'>,
  can: (p: Permission) => boolean,
): boolean {
  return sheet.status === 'draft' && canSubmitStainQc(can);
}

export function canRecordOnStainQcSheet(
  sheet: Pick<StainQcMonthlySheet, 'status' | 'lotNumber' | 'expiryDate'>,
  can: (p: Permission) => boolean,
): boolean {
  if (!canRecordStainQc(can)) return false;
  if (!isStainQcSheetEditable(sheet.status)) return false;
  return Boolean(sheet.lotNumber?.trim()) && Boolean(sheet.expiryDate);
}
