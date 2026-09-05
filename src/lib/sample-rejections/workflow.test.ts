import { describe, it, expect, vi } from 'vitest';
import { canConfirmDiscard, canConfirmDiscardForRejection, canConfirmSupervisorReview } from '@/lib/sample-rejections/permissions';
import {
  buildSampleRejection,
  calculateDiscardDueAt,
  calculateElapsedMinutes,
  createPendingSampleFromRejection,
  getRetentionDays,
} from '@/lib/sample-rejections/workflow';
import { emptySampleRejectionForm, sampleRejectionFormSchema } from '@/lib/sample-rejections/schema';
import type { Permission } from '@/lib/permissions/roles';
import type { SampleRejection, SystemSettings } from '@/types';

const staff = { userId: 'user-1', fullName: 'Ahmed', staffId: 'HEM-0005' };

const baseForm = {
  ...emptySampleRejectionForm(),
  patientId: 'DEMO-P001',
  patientName: 'Test Patient',
  patientLabAccNumber: 'ACC-10001',
  department: 'Emergency Department',
  rejectedTests: ['CBC'],
  rejectedTube: 'EDTA',
  rejectionReasons: ['Specimen Hemolyzed'],
  informedNurseName: 'Nurse A',
  nurseId: 'NRS-001',
};

function mockCan(grants: Permission[]): (permission: Permission) => boolean {
  return (permission) => grants.includes(permission);
}

describe('Sample Rejection Workflow', () => {
  it('validates required form fields', () => {
    const result = sampleRejectionFormSchema.safeParse(baseForm);
    expect(result.success).toBe(true);
  });

  it('requires other reason when Other is selected', () => {
    const result = sampleRejectionFormSchema.safeParse({
      ...baseForm,
      rejectionReasons: ['Other'],
      otherRejectionReason: '',
    });
    expect(result.success).toBe(false);
  });

  it('calculates discard due date using retention days', () => {
    const dueAt = calculateDiscardDueAt('2026-07-28', '10:00', 3);
    expect(new Date(dueAt).getDate()).toBe(31);
  });

  it('creates rejection and linked pending sample', () => {
    const rejection = buildSampleRejection(baseForm, staff, 3);
    const pending = createPendingSampleFromRejection(rejection, staff);
    expect(pending.sourceType).toBe('rejection');
    expect(pending.sampleRejectionId).toBe(rejection.id);
    expect(pending.replacementSampleStatus).toBe('Awaiting Replacement Sample');
    expect(pending.isActive).toBe(true);
  });

  it('allows supervisor review for authorized permission and blocks creator', () => {
    const rejection = buildSampleRejection(baseForm, staff, 3);
    const reviewCan = mockCan(['sample_rejections.review']);
    const adminCan = mockCan(['sample_rejections.review', 'users.manage']);

    expect(canConfirmSupervisorReview(reviewCan, 'supervisor-1', rejection)).toBe(true);
    expect(canConfirmSupervisorReview(reviewCan, staff.userId, rejection)).toBe(false);
    expect(canConfirmSupervisorReview(mockCan([]), 'tech-1', rejection)).toBe(false);
    expect(canConfirmSupervisorReview(adminCan, staff.userId, rejection)).toBe(true);
  });

  it('blocks supervisor review after reviewed', () => {
    const rejection: SampleRejection = {
      ...buildSampleRejection(baseForm, staff, 3),
      supervisorReviewStatus: 'reviewed',
    };
    expect(canConfirmSupervisorReview(mockCan(['sample_rejections.review']), 'supervisor-1', rejection)).toBe(false);
  });

  it('allows discard when due even if awaiting replacement', () => {
    const rejection: SampleRejection = {
      ...buildSampleRejection(baseForm, staff, 3),
      replacementSampleStatus: 'Awaiting Replacement Sample',
      discardStatus: 'discard_due',
    };
    expect(canConfirmDiscardForRejection('section_supervisor', rejection)).toBe(true);
  });

  it('blocks discard before due date', () => {
    const rejection: SampleRejection = {
      ...buildSampleRejection(baseForm, staff, 3),
      replacementSampleStatus: 'Awaiting Replacement Sample',
      discardStatus: 'not_due',
    };
    expect(canConfirmDiscardForRejection('section_supervisor', rejection)).toBe(false);
  });

  it('allows discard for authorized roles', () => {
    expect(canConfirmDiscard('quality_link')).toBe(true);
    expect(canConfirmDiscard('lab_technologist')).toBe(false);
  });

  it('reads retention days from settings with default', () => {
    const settings = {
      rejectedSampleRetentionDays: 5,
    } as SystemSettings;
    expect(getRetentionDays(settings)).toBe(5);
  });

  it('calculates elapsed minutes from rejection timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-05T15:30:00'));
    // Rejection at local noon previous day → 27h 30m elapsed
    expect(calculateElapsedMinutes('2026-09-04', '12:00')).toBe(27 * 60 + 30);
    vi.useRealTimers();
  });
});
