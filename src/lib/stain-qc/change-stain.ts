import { STAIN_QC_CONTROLLED_CORRECTIVE_ACTION } from '@/lib/stain-qc/constants';
import type { StainQcCorrectiveAction, StainQcDailyResult, StainQcResponsibilityEntry } from '@/types/stain-qc';

export function isChangeStainConfirmed(action: Pick<StainQcCorrectiveAction, 'actionCode' | 'confirmedAt'>): boolean {
  return action.actionCode === 'change_stain' && Boolean(action.confirmedAt);
}

export function pendingChangeStainResultIds(
  results: StainQcDailyResult[],
  correctiveActions: StainQcCorrectiveAction[],
): string[] {
  const confirmed = new Set(
    correctiveActions.filter(isChangeStainConfirmed).map((action) => action.dailyResultId),
  );
  return results
    .filter((result) => result.resultStatus === 'not_acceptable' && !confirmed.has(result.id))
    .map((result) => result.id);
}

export function formatQcCorrectionCellDisplay(entry?: StainQcResponsibilityEntry): string {
  if (!entry) return '—';
  return `${STAIN_QC_CONTROLLED_CORRECTIVE_ACTION} · ${entry.recordedByInitials}`;
}

export function buildChangeStainAuditValue(input: {
  criterionKey: string;
  dayOfMonth: number;
  recordedByName: string;
  recordedByInitials: string;
  recordedAt: string;
  optionalComment?: string | null;
}): string {
  return [
    STAIN_QC_CONTROLLED_CORRECTIVE_ACTION,
    `day ${input.dayOfMonth}`,
    input.criterionKey,
    input.recordedByName,
    input.recordedByInitials,
    input.recordedAt,
    input.optionalComment?.trim() ? `comment: ${input.optionalComment.trim()}` : null,
  ].filter(Boolean).join(' · ');
}

export function formatChangeStainPdfLine(action: StainQcCorrectiveAction): string {
  const parts = [
    `Day ${action.dayOfMonth}`,
    action.criterionKey,
    STAIN_QC_CONTROLLED_CORRECTIVE_ACTION,
    action.recordedByInitials,
    new Date(action.recordedAt).toLocaleString(),
  ];
  if (action.comment?.trim()) parts.push(`Comment: ${action.comment.trim()}`);
  return parts.join(' · ');
}

export function sheetAllowsLotReplacement(input: {
  currentLotNumber: string;
  currentExpiryDate: string;
  nextLotNumber?: string;
  nextExpiryDate?: string;
  hasDailyResults: boolean;
}): { allowed: boolean; reason?: string } {
  if (!input.hasDailyResults) return { allowed: true };
  const lotChanged = input.nextLotNumber != null
    && input.nextLotNumber.trim() !== input.currentLotNumber.trim();
  const expiryChanged = input.nextExpiryDate != null
    && input.nextExpiryDate !== input.currentExpiryDate;
  if (lotChanged || expiryChanged) {
    return {
      allowed: false,
      reason: 'Replacing the stain lot requires a new monthly sheet for the new lot number and expiry.',
    };
  }
  return { allowed: true };
}
