import type { Role } from '@/lib/permissions/roles';
import type { SampleRejection } from '@/types';
import { DISCARD_AUTHORIZED_ROLES, SUPERVISOR_REVIEW_ROLES } from './constants';

const CREATE_ONLY_ROLES = ['lab_technologist', 'senior_lab_technologist'] as const;

export function canConfirmSupervisorReview(role: Role, userId: string, rejection: SampleRejection): boolean {
  if (CREATE_ONLY_ROLES.includes(role as typeof CREATE_ONLY_ROLES[number])) return false;
  if (!SUPERVISOR_REVIEW_ROLES.includes(role as typeof SUPERVISOR_REVIEW_ROLES[number])) return false;
  if (rejection.supervisorReviewStatus === 'reviewed') return false;
  if (rejection.createdByUserId === userId && role !== 'system_admin') return false;
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
