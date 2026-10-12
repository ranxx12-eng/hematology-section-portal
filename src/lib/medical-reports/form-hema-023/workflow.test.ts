import { describe, expect, it } from 'vitest';
import {
  canEditMixingStudy,
  canReviewMixingStudy,
  isAllowedMixingStudyTransition,
  isReviewedMixingStudyLocked,
  reviewerIsIndependent,
} from '@/lib/medical-reports/form-hema-023/workflow';

describe('Form-Hema-023 workflow', () => {
  it('requires the reviewer to be a different person from the performer', () => {
    expect(reviewerIsIndependent('performer', 'performer')).toBe(false);
    expect(reviewerIsIndependent('performer', 'reviewer')).toBe(true);
    expect(canReviewMixingStudy('pending_review', true, true)).toBe(false);
    expect(canReviewMixingStudy('pending_review', false, true)).toBe(true);
  });

  it('blocks skipped stages and keeps a reviewed study locked', () => {
    expect(isAllowedMixingStudyTransition('draft', 'reviewed')).toBe(false);
    expect(isAllowedMixingStudyTransition('draft', 'pending_review')).toBe(true);
    expect(isAllowedMixingStudyTransition('pending_review', 'reviewed')).toBe(true);
    expect(isAllowedMixingStudyTransition('reviewed', 'draft')).toBe(false);
    expect(isReviewedMixingStudyLocked('reviewed')).toBe(true);
    expect(canEditMixingStudy('reviewed', true)).toBe(false);
    expect(canEditMixingStudy('draft', true)).toBe(true);
  });
});
