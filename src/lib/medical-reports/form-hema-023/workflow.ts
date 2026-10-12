import {
  MIXING_STUDY_TRANSITIONS,
  type MixingStudyStatus,
} from '@/lib/medical-reports/form-hema-023/constants';

export function isAllowedMixingStudyTransition(
  from: MixingStudyStatus,
  to: MixingStudyStatus,
): boolean {
  return MIXING_STUDY_TRANSITIONS.some(([start, end]) => start === from && end === to);
}

export function reviewerIsIndependent(performerId: string, reviewerId: string): boolean {
  return performerId.length > 0 && reviewerId.length > 0 && performerId !== reviewerId;
}

export function canEditMixingStudy(status: MixingStudyStatus, isPerformer: boolean): boolean {
  return isPerformer && (status === 'draft' || status === 'changes_requested');
}

export function canReviewMixingStudy(status: MixingStudyStatus, isPerformer: boolean, canReview: boolean): boolean {
  return canReview && !isPerformer && status === 'pending_review';
}

export function isReviewedMixingStudyLocked(status: MixingStudyStatus): boolean {
  return status === 'reviewed';
}
