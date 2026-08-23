import type { Permission } from '@/lib/permissions/roles';
import type { SampleRejection } from '@/types';
import { DISCARD_AUTHORIZED_ROLES } from './constants';
import type { Role } from '@/lib/permissions/roles';

export function canConfirmSupervisorReview(
  can: (permission: Permission) => boolean,
  userId: string,
  rejection: SampleRejection,
): boolean {
  if (!can('sample_rejections.review')) return false;
  if (rejection.supervisorReviewStatus === 'reviewed') return false;
  if (rejection.createdByUserId === userId && !can('users.manage')) return false;
  return true;
}

export function canConfirmDiscard(role: Role): boolean {
  return DISCARD_AUTHORIZED_ROLES.includes(role as typeof DISCARD_AUTHORIZED_ROLES[number]);
}

export function canConfirmDiscardForRejection(role: Role, rejection: SampleRejection): boolean {
  if (!canConfirmDiscard(role)) return false;
  if (rejection.discardStatus === 'discarded') return false;
  if (rejection.replacementSampleStatus === 'Completed') return false;
  return rejection.discardStatus === 'discard_due';
}

export function isWorkflowLocked(rejection: SampleRejection): boolean {
  return rejection.replacementSampleStatus === 'Completed' || rejection.replacementSampleStatus === 'Discarded';
}

export function isReviewBlocked(rejection: SampleRejection): boolean {
  return rejection.supervisorReviewStatus === 'reviewed';
}
