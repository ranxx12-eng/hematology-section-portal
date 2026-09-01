import {
  QC_CORRECTIVE_ACTIONS_REQUIRING_EXPLANATION,
  correctiveActionSnapshotText,
} from './constants';
import type {
  QcCorrectiveActionCode,
  QcCorrectiveActionFormInput,
  QcCorrectiveActionStatus,
  QcCorrectiveMonthSummary,
  QcCorrectiveResultAfterAction,
  QcCorrectiveWorklistItem,
} from '@/types/qc-corrective-action';

export interface QcRecordQualificationInput {
  qcStatus: 'IN' | 'OUT';
  reviewDecision?: 'accept' | 'not_accept' | 'need_follow_up' | null;
  approvalDecision?: 'accept' | 'not_accept' | 'need_follow_up' | null;
}

export function qualifiesForCorrectiveAction(record: QcRecordQualificationInput): boolean {
  if (record.qcStatus === 'OUT') return true;
  if (record.reviewDecision === 'not_accept' || record.reviewDecision === 'need_follow_up') return true;
  if (record.approvalDecision === 'not_accept' || record.approvalDecision === 'need_follow_up') return true;
  return false;
}

export function formatOriginalQcStatusLabel(record: QcRecordQualificationInput): string {
  if (record.qcStatus === 'OUT') return 'OUT';
  if (record.reviewDecision === 'not_accept') return 'Not Acceptable';
  if (record.reviewDecision === 'need_follow_up') return 'Need Follow Up';
  if (record.approvalDecision === 'not_accept') return 'Not Acceptable';
  if (record.approvalDecision === 'need_follow_up') return 'Need Follow Up';
  return record.qcStatus;
}

export function requiresExplanation(code?: QcCorrectiveActionCode): boolean {
  return !!code && QC_CORRECTIVE_ACTIONS_REQUIRING_EXPLANATION.includes(code);
}

export function deriveActionStatus(input: QcCorrectiveActionFormInput): QcCorrectiveActionStatus {
  const hasAny =
    !!input.correctiveActionCode
    || !!input.correctedValue?.trim()
    || !!input.explanation?.trim()
    || !!input.remarks?.trim()
    || !!input.resultAfterAction;

  if (!hasAny) return 'required';
  if (isCorrectiveActionComplete(input)) return 'completed';
  return 'in_progress';
}

export function isCorrectiveActionComplete(input: QcCorrectiveActionFormInput): boolean {
  if (!input.correctiveActionCode) return false;
  if (requiresExplanation(input.correctiveActionCode) && !input.explanation?.trim()) return false;
  if (input.resultAfterAction === 'follow_up_required' && !input.remarks?.trim() && !input.explanation?.trim()) {
    return false;
  }
  return true;
}

export function validateCorrectiveActionInput(input: QcCorrectiveActionFormInput): string | null {
  if (!input.correctiveActionCode) {
    const hasPartial =
      !!input.correctedValue?.trim()
      || !!input.explanation?.trim()
      || !!input.remarks?.trim()
      || !!input.resultAfterAction;
    if (hasPartial) return null;
    return 'Corrective action is required';
  }
  if (requiresExplanation(input.correctiveActionCode) && !input.explanation?.trim()) {
    return EXPLANATION_ERROR(input.correctiveActionCode);
  }
  if (input.correctedValue?.trim()) {
    const numeric = Number(input.correctedValue);
    if (Number.isNaN(numeric)) return 'Corrected value must be numeric';
  }
  return null;
}

function EXPLANATION_ERROR(code: QcCorrectiveActionCode): string {
  if (code === 'F') return 'Explanation is required when using backup instrument';
  return 'Explanation is required for Other corrective action';
}

export function parseCorrectedValue(value?: string): { numeric?: number; text?: string } {
  if (!value?.trim()) return {};
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) return { numeric };
  return { text: value.trim() };
}

export function formatCorrectedValueDisplay(
  numeric?: number | null,
  text?: string | null,
): string | undefined {
  if (text?.trim()) return text.trim();
  if (numeric != null && !Number.isNaN(Number(numeric))) return String(numeric);
  return undefined;
}

export function deriveFailedValueDisplay(
  resultValue?: number | null,
  qcStatus?: 'IN' | 'OUT',
): string {
  if (resultValue != null && !Number.isNaN(Number(resultValue))) return String(resultValue);
  if (qcStatus === 'OUT') return 'OUT';
  return '—';
}

export function deriveResultAfterCorrectiveAction(input: {
  correctedValue?: string;
  rangeMin?: number | null;
  rangeMax?: number | null;
  selected?: QcCorrectiveResultAfterAction;
}): QcCorrectiveResultAfterAction | undefined {
  if (input.selected) return input.selected;
  const parsed = parseCorrectedValue(input.correctedValue);
  if (parsed.numeric == null) return undefined;
  if (input.rangeMin == null || input.rangeMax == null) return undefined;
  if (parsed.numeric >= input.rangeMin && parsed.numeric <= input.rangeMax) {
    return 'resolved_within_range';
  }
  return 'still_out_of_range';
}

export function buildMonthSummary(items: QcCorrectiveWorklistItem[]): QcCorrectiveMonthSummary {
  const year = items[0]?.recordedAt ? new Date(items[0].recordedAt).getFullYear() : new Date().getFullYear();
  const month = items[0]?.recordedAt ? new Date(items[0].recordedAt).getMonth() + 1 : new Date().getMonth() + 1;

  const actionCounts: Partial<Record<QcCorrectiveActionCode, number>> = {};
  let serviceCallCount = 0;
  let recalibrationCount = 0;
  let repeatedFailureCount = 0;

  for (const item of items) {
    if (item.correctiveActionCode) {
      actionCounts[item.correctiveActionCode] = (actionCounts[item.correctiveActionCode] ?? 0) + 1;
      if (item.correctiveActionCode === 'G') serviceCallCount += 1;
      if (item.correctiveActionCode === 'E') recalibrationCount += 1;
    }
    if (item.repeatedFailureCount > 1) repeatedFailureCount += 1;
  }

  const incomplete = items.filter((item) => item.isIncomplete);
  const completed = items.filter((item) => item.actionStatus === 'completed');
  const required = items.filter((item) => item.actionStatus === 'required');
  const pendingReview = items.filter((item) =>
    item.actionStatus === 'completed' && item.monthlyReviewStatus === 'ready_for_review');
  const pendingApproval = items.filter((item) =>
    item.monthlyReviewStatus === 'reviewed');
  const approved = items.filter((item) => item.monthlyReviewStatus === 'approved');

  return {
    year,
    month,
    totalQcOut: items.length,
    correctiveActionsRequired: required.length + items.filter((i) => i.actionStatus === 'in_progress').length,
    completed: completed.length,
    pendingReview: pendingReview.length,
    pendingApproval: pendingApproval.length,
    approved: approved.length,
    missingData: incomplete.length,
    incompleteCount: incomplete.length,
    actionCounts,
    serviceCallCount,
    recalibrationCount,
    repeatedFailureCount,
  };
}

export function countRepeatedFailures(
  records: Array<{
    instrumentId: string;
    analyte: string;
    qcLevel: string;
    recordedAt: string;
  }>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const record of records) {
    const key = `${record.instrumentId}|${record.analyte}|${record.qcLevel}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function repeatedFailureKey(instrumentId: string, analyte: string, qcLevel: string): string {
  return `${instrumentId}|${analyte}|${qcLevel}`;
}

export function canMarkMonthReadyForReview(items: QcCorrectiveWorklistItem[]): boolean {
  if (items.length === 0) return false;
  return items.every((item) => !item.isIncomplete);
}

export function canApproveMonth(
  items: QcCorrectiveWorklistItem[],
  monthlyStatus?: string,
): boolean {
  if (monthlyStatus !== 'reviewed') return false;
  if (items.some((item) => item.isIncomplete)) return false;
  if (items.some((item) => item.resultAfterAction === 'follow_up_required' && item.actionStatus !== 'completed')) {
    return false;
  }
  return true;
}

export function buildCorrectiveActionSnapshot(code: QcCorrectiveActionCode): string {
  return correctiveActionSnapshotText(code);
}

export function mergeExistingQcNotes(input: {
  correctiveActions?: string[];
  correctiveActionComment?: string;
  correctiveActionOther?: string;
}): string | undefined {
  const parts = [
    ...(input.correctiveActions ?? []),
    input.correctiveActionOther?.trim(),
    input.correctiveActionComment?.trim(),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join('; ') : undefined;
}
