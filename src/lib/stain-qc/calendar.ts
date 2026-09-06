import type { StainQcCellStatus, StainQcCriterion, StainQcDailyResult } from '@/types/stain-qc';
import { STAIN_QC_RESULT_SYMBOL_ARIA_LABELS } from '@/lib/stain-qc/constants';

export function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

export function isValidCalendarDay(day: number, month: number, year: number): boolean {
  if (day < 1 || day > 31) return false;
  return day <= daysInMonth(month, year);
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function isCurrentCalendarDay(day: number, month: number, year: number, now = new Date()): boolean {
  return now.getFullYear() === year && now.getMonth() + 1 === month && now.getDate() === day;
}

export function isFutureCalendarDay(day: number, month: number, year: number, now = new Date()): boolean {
  const target = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return target > today;
}

export interface CompletionSummary {
  totalApplicableCells: number;
  filledCells: number;
  missingCells: number;
  notAcceptableCells: number;
  pendingCorrectiveCount: number;
  completionPercent: number;
}

export function buildDailyGrid(results: StainQcDailyResult[]): Record<string, Record<number, StainQcDailyResult | undefined>> {
  const grid: Record<string, Record<number, StainQcDailyResult | undefined>> = {};
  for (const result of results) {
    if (!grid[result.criterionKey]) grid[result.criterionKey] = {};
    grid[result.criterionKey]![result.dayOfMonth] = result;
  }
  return grid;
}

export function computeCompletionSummary(input: {
  criteria: StainQcCriterion[];
  month: number;
  year: number;
  results: StainQcDailyResult[];
  correctiveActionResultIds: Set<string>;
}): CompletionSummary {
  const validDays = daysInMonth(input.month, input.year);
  const resultMap = new Map<string, StainQcDailyResult>();
  for (const result of input.results) {
    resultMap.set(`${result.criterionKey}:${result.dayOfMonth}`, result);
  }

  let totalApplicableCells = 0;
  let filledCells = 0;
  let notAcceptableCells = 0;
  let pendingCorrectiveCount = 0;

  for (const criterion of input.criteria) {
    for (let day = 1; day <= validDays; day += 1) {
      totalApplicableCells += 1;
      const result = resultMap.get(`${criterion.criterionKey}:${day}`);
      if (!result) continue;
      filledCells += 1;
      if (result.resultStatus === 'not_acceptable') {
        notAcceptableCells += 1;
        if (!input.correctiveActionResultIds.has(result.id)) {
          pendingCorrectiveCount += 1;
        }
      }
    }
  }

  const missingCells = totalApplicableCells - filledCells;
  const completionPercent = totalApplicableCells === 0
    ? 0
    : Math.round((filledCells / totalApplicableCells) * 100);

  return {
    totalApplicableCells,
    filledCells,
    missingCells,
    notAcceptableCells,
    pendingCorrectiveCount,
    completionPercent,
  };
}

export function nextCellStatus(current: StainQcCellStatus | null, action: 'click' | 'clear' | 'not_acceptable' | 'na'): StainQcCellStatus | null {
  if (action === 'clear') return null;
  if (action === 'click') return current == null ? 'acceptable' : current;
  if (action === 'not_acceptable') return 'not_acceptable';
  if (action === 'na') return 'na';
  return current;
}

export function cellStatusClass(status: StainQcCellStatus | null): string {
  switch (status) {
    case 'acceptable':
      return 'bg-emerald-50 text-emerald-900 border-emerald-300';
    case 'not_acceptable':
      return 'bg-red-50 text-red-900 border-red-400 font-semibold';
    case 'na':
      return 'bg-muted text-muted-foreground border-border';
    default:
      return 'bg-background text-muted-foreground border-border hover:bg-muted/40';
  }
}

export function cellStatusSymbol(status: StainQcCellStatus | null): string {
  switch (status) {
    case 'acceptable':
      return '✓';
    case 'not_acceptable':
      return '✕';
    case 'na':
      return 'N/A';
    default:
      return '';
  }
}

export function cellStatusAriaLabel(status: StainQcCellStatus | null): string {
  if (status == null) return 'Empty';
  return STAIN_QC_RESULT_SYMBOL_ARIA_LABELS[status] ?? status;
}
