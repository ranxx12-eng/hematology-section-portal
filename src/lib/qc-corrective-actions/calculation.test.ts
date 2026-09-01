import { describe, expect, it } from 'vitest';
import {
  buildMonthSummary,
  canApproveMonth,
  canMarkMonthReadyForReview,
  deriveActionStatus,
  isCorrectiveActionComplete,
  qualifiesForCorrectiveAction,
  requiresExplanation,
  validateCorrectiveActionInput,
} from '@/lib/qc-corrective-actions/calculation';
import type { QcCorrectiveWorklistItem } from '@/types/qc-corrective-action';

describe('qualifiesForCorrectiveAction', () => {
  it('includes QC OUT records', () => {
    expect(qualifiesForCorrectiveAction({ qcStatus: 'OUT' })).toBe(true);
  });

  it('excludes QC IN without follow-up decisions', () => {
    expect(qualifiesForCorrectiveAction({ qcStatus: 'IN' })).toBe(false);
  });

  it('includes not_accept and need_follow_up review decisions', () => {
    expect(qualifiesForCorrectiveAction({ qcStatus: 'IN', reviewDecision: 'not_accept' })).toBe(true);
    expect(qualifiesForCorrectiveAction({ qcStatus: 'IN', reviewDecision: 'need_follow_up' })).toBe(true);
  });
});

describe('corrective action validation', () => {
  it('requires explanation for F and I', () => {
    expect(requiresExplanation('F')).toBe(true);
    expect(requiresExplanation('I')).toBe(true);
    expect(requiresExplanation('A')).toBe(false);
  });

  it('blocks F without explanation', () => {
    expect(validateCorrectiveActionInput({ correctiveActionCode: 'F' })).toMatch(/backup instrument/i);
  });

  it('blocks I without explanation', () => {
    expect(validateCorrectiveActionInput({ correctiveActionCode: 'I' })).toMatch(/Other/i);
  });

  it('accepts complete A action', () => {
    expect(validateCorrectiveActionInput({
      correctiveActionCode: 'A',
      correctedValue: '12.5',
      resultAfterAction: 'resolved_within_range',
    })).toBeNull();
  });

  it('derives completed status', () => {
    expect(deriveActionStatus({
      correctiveActionCode: 'A',
      correctedValue: '10',
      resultAfterAction: 'resolved_within_range',
    })).toBe('completed');
  });

  it('derives required status for empty input', () => {
    expect(deriveActionStatus({})).toBe('required');
  });

  it('derives in_progress for partial input', () => {
    expect(isCorrectiveActionComplete({ correctiveActionCode: 'A' })).toBe(true);
    expect(deriveActionStatus({ correctedValue: '10' })).toBe('in_progress');
  });
});

describe('monthly completeness', () => {
  const baseItem = (overrides: Partial<QcCorrectiveWorklistItem>): QcCorrectiveWorklistItem => ({
    qcRecordId: '1',
    recordedAt: '2026-09-15T10:00:00Z',
    instrumentId: 'inst-1',
    instrumentName: 'Alinity HQ1147',
    qcMaterial: 'Hematology QC Control',
    analyte: 'PTT',
    qcLevel: 'Normal',
    failedValue: 'OUT',
    originalQcStatus: 'OUT',
    actionStatus: 'completed',
    repeatedFailureCount: 1,
    isAlinityHq: true,
    isIncomplete: false,
    ...overrides,
  });

  it('blocks approval when incomplete rows exist', () => {
    const items = [
      baseItem({ isIncomplete: true, actionStatus: 'required' }),
      baseItem({ qcRecordId: '2' }),
    ];
    expect(canMarkMonthReadyForReview(items)).toBe(false);
    expect(canApproveMonth(items, 'reviewed')).toBe(false);
  });

  it('allows approval when complete and reviewed', () => {
    const items = [baseItem({}), baseItem({ qcRecordId: '2' })];
    expect(canMarkMonthReadyForReview(items)).toBe(true);
    expect(canApproveMonth(items, 'reviewed')).toBe(true);
  });

  it('summarizes month metrics', () => {
    const summary = buildMonthSummary([
      baseItem({ actionStatus: 'required', isIncomplete: true }),
      baseItem({ qcRecordId: '2', correctiveActionCode: 'G' }),
      baseItem({ qcRecordId: '3', correctiveActionCode: 'E', repeatedFailureCount: 2 }),
    ]);
    expect(summary.totalQcOut).toBe(3);
    expect(summary.incompleteCount).toBe(1);
    expect(summary.actionCounts.G).toBe(1);
    expect(summary.serviceCallCount).toBe(1);
    expect(summary.recalibrationCount).toBe(1);
    expect(summary.repeatedFailureCount).toBe(1);
  });
});
