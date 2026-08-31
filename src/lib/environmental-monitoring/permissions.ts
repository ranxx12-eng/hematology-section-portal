import type { Permission } from '@/lib/permissions/roles';
import type { EnvironmentalExcursion } from '@/types/environmental-monitoring';

export function canViewEnvironmental(can: (permission: Permission) => boolean): boolean {
  return can('environmental.view');
}

export function canRecordEnvironmental(can: (permission: Permission) => boolean): boolean {
  return can('environmental.record');
}

export function canCorrectEnvironmental(can: (permission: Permission) => boolean): boolean {
  return can('environmental.correct');
}

export function canReviewEnvironmentalExcursion(
  can: (permission: Permission) => boolean,
  excursion: EnvironmentalExcursion,
  userId?: string,
): boolean {
  if (!can('environmental.review')) return false;
  if (excursion.reviewStatus === 'Reviewed') return false;
  if (userId && excursion.resolvedByUserId === userId) return false;
  return excursion.status === 'resolved' || excursion.status === 'awaiting_recheck';
}

export function canResolveEnvironmentalExcursion(can: (permission: Permission) => boolean): boolean {
  return can('environmental.resolve');
}

export function canManageEnvironmentalAssets(can: (permission: Permission) => boolean): boolean {
  return can('environmental.manage_assets');
}

export function canAuditEnvironmental(can: (permission: Permission) => boolean): boolean {
  return can('environmental.audit');
}

export function canVoidEnvironmental(can: (permission: Permission) => boolean): boolean {
  return can('environmental.void');
}

export function formatEnvironmentalRange(
  min: number,
  max: number,
  unit = '°C',
): string {
  return `${min}${unit} – ${max}${unit}`;
}
