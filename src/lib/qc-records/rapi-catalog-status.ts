import { daysInMonth, isFutureCalendarDay } from '@/lib/stain-qc/calendar';
import { isChangeStainConfirmed } from '@/lib/stain-qc/change-stain';
import type {
  StainQcCorrectiveAction,
  StainQcCriterion,
  StainQcDailyResult,
  StainQcMonthlySheet,
  StainQcWorkflowStatus,
} from '@/types/stain-qc';

export type RapiStainCatalogStatus =
  | 'Not Recorded'
  | 'Due'
  | 'Completed'
  | 'OUT'
  | 'Pending Change Stain'
  | 'Pending Review'
  | 'Reviewed / Pending Approval'
  | 'Approved';

export interface RapiStainCatalogSnapshot {
  sheet: Pick<
    StainQcMonthlySheet,
    'id' | 'status' | 'lotNumber' | 'expiryDate' | 'sheetMonth' | 'sheetYear'
  > | null;
  criteria: StainQcCriterion[];
  dailyResults: StainQcDailyResult[];
  correctiveActions: StainQcCorrectiveAction[];
}

export interface RapiStainCatalogDerived {
  status: RapiStainCatalogStatus;
  lastRecordedAt?: string;
  sheetMonth: number;
  sheetYear: number;
  sheetId?: string;
  lotNumber?: string;
  expiryDate?: string;
}

function latestRecordedAt(results: StainQcDailyResult[]): string | undefined {
  return results.reduce<string | undefined>((latest, result) => {
    if (!latest || result.recordedAt > latest) return result.recordedAt;
    return latest;
  }, undefined);
}

function workflowStatusLabel(status: StainQcWorkflowStatus): RapiStainCatalogStatus | null {
  switch (status) {
    case 'approved':
      return 'Approved';
    case 'reviewed':
      return 'Reviewed / Pending Approval';
    case 'submitted':
      return 'Pending Review';
    default:
      return null;
  }
}

function deriveCurrentDayDraftStatus(input: {
  criteria: StainQcCriterion[];
  dailyResults: StainQcDailyResult[];
  correctiveActions: StainQcCorrectiveAction[];
  month: number;
  year: number;
  today: number;
}): RapiStainCatalogStatus {
  const { criteria, dailyResults, correctiveActions, month, year, today } = input;
  const confirmedIds = new Set(
    correctiveActions.filter(isChangeStainConfirmed).map((action) => action.dailyResultId),
  );

  const missingToday = criteria.some(
    (criterion) => !dailyResults.some(
      (result) => result.criterionKey === criterion.criterionKey && result.dayOfMonth === today,
    ),
  );
  if (missingToday) return 'Due';

  const todayNotAcceptable = dailyResults.filter(
    (result) => result.dayOfMonth === today && result.resultStatus === 'not_acceptable',
  );
  if (todayNotAcceptable.some((result) => !confirmedIds.has(result.id))) {
    return 'Pending Change Stain';
  }
  if (todayNotAcceptable.length > 0) return 'OUT';

  void month;
  void year;
  return 'Completed';
}

export function deriveRapiStainCatalogStatus(
  snapshot: RapiStainCatalogSnapshot,
  now = new Date(),
): RapiStainCatalogDerived {
  const sheetMonth = snapshot.sheet?.sheetMonth ?? now.getMonth() + 1;
  const sheetYear = snapshot.sheet?.sheetYear ?? now.getFullYear();
  const lastRecordedAt = latestRecordedAt(snapshot.dailyResults);

  const base: RapiStainCatalogDerived = {
    status: 'Not Recorded',
    sheetMonth,
    sheetYear,
    lastRecordedAt,
    sheetId: snapshot.sheet?.id,
    lotNumber: snapshot.sheet?.lotNumber,
    expiryDate: snapshot.sheet?.expiryDate,
  };

  if (!snapshot.sheet || snapshot.dailyResults.length === 0) {
    return base;
  }

  const workflowLabel = workflowStatusLabel(snapshot.sheet.status);
  if (workflowLabel) {
    return { ...base, status: workflowLabel };
  }

  const today = now.getDate();
  const isCurrentMonth = now.getFullYear() === sheetYear && now.getMonth() + 1 === sheetMonth;
  const validDays = daysInMonth(sheetMonth, sheetYear);

  if (
    isCurrentMonth
    && today <= validDays
    && !isFutureCalendarDay(today, sheetMonth, sheetYear, now)
  ) {
    return {
      ...base,
      status: deriveCurrentDayDraftStatus({
        criteria: snapshot.criteria,
        dailyResults: snapshot.dailyResults,
        correctiveActions: snapshot.correctiveActions,
        month: sheetMonth,
        year: sheetYear,
        today,
      }),
    };
  }

  return { ...base, status: 'Completed' };
}
