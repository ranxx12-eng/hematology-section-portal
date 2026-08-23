import type { Role } from '@/lib/permissions/roles';
import type { CriticalValue } from '@/types';

export const CRITICAL_VALUE_REVIEW_ROLES = [
  'section_supervisor',
  'head_of_section',
  'quality_officer',
  'quality_link',
  'lab_manager',
  'system_admin',
] as const;

const CREATE_ONLY_ROLES = ['lab_technologist', 'senior_lab_technologist'] as const;

export function canReviewCriticalValue(role: Role, record: CriticalValue): boolean {
  if (!CRITICAL_VALUE_REVIEW_ROLES.includes(role as typeof CRITICAL_VALUE_REVIEW_ROLES[number])) {
    return false;
  }
  if (CREATE_ONLY_ROLES.includes(role as typeof CREATE_ONLY_ROLES[number])) {
    return false;
  }
  return record.reviewStatus === 'Pending Review' || record.reviewStatus === 'Needs Follow-up';
}

export function canCreateCriticalValue(role: Role): boolean {
  return role !== 'read_only' && role !== 'viewer' && role !== 'trainee';
}
