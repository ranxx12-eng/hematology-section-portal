import type { Role } from '@/lib/permissions/roles';
import type { SampleRejection } from '@/types';
import { DISCARD_AUTHORIZED_ROLES, SUPERVISOR_REVIEW_ROLES } from './constants';

export function canConfirmSupervisorReview(role: Role, userId: string, rejection: SampleRejection): boolean {
  if (!SUPERVISOR_REVIEW_ROLES.includes(role as typeof SUPERVISOR_REVIEW_ROLES[number])) return false;
  if (rejection.supervisorReviewStatus === 'reviewed') return false;
  if (rejection.createdByUserId === userId && role !== 'system_admin') return false;
  return true;
}

export function canConfirmDiscard(role: Role): boolean {
  return DISCARD_AUTHORIZED_ROLES.includes(role as typeof DISCARD_AUTHORIZED_ROLES[number]);
}

export function isWorkflowLocked(rejection: SampleRejection): boolean {
  return rejection.replacementSampleStatus === 'Completed' || rejection.replacementSampleStatus === 'Discarded';
}
