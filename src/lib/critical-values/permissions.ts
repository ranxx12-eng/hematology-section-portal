import type { Permission } from '@/lib/permissions/roles';
import type { CriticalValue } from '@/types';

export function canReviewCriticalValue(
  can: (permission: Permission) => boolean,
  record: CriticalValue,
): boolean {
  if (!can('critical_values.review')) return false;
  return record.reviewStatus === 'Pending Review' || record.reviewStatus === 'Needs Follow-up';
}

export function canCreateCriticalValue(can: (permission: Permission) => boolean): boolean {
  return can('critical_values.manage');
}
