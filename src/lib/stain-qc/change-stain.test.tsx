import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MonthlyStainQcGrid } from '@/components/stain-qc/monthly-stain-qc-grid';
import { FORM_HEMA_021_CODE, STAIN_QC_CONTROLLED_CORRECTIVE_ACTION } from '@/lib/stain-qc/constants';
import {
  buildChangeStainAuditValue,
  formatChangeStainPdfLine,
  formatQcCorrectionCellDisplay,
  isChangeStainConfirmed,
  pendingChangeStainResultIds,
  sheetAllowsLotReplacement,
} from '@/lib/stain-qc/change-stain';
import type {
  StainQcCorrectiveAction,
  StainQcCriterion,
  StainQcDailyResult,
  StainQcResponsibilityEntry,
} from '@/types/stain-qc';

const CRITERION: StainQcCriterion = {
  id: '1',
  formCode: FORM_HEMA_021_CODE,
  criterionKey: 'pbf_spreading',
  sectionKey: 'peripheral_blood_film',
  sectionLabel: 'Peripheral Blood Film',
  rowLabel: 'Spreading',
  displayOrder: 1,
};

function makeResult(overrides: Partial<StainQcDailyResult> = {}): StainQcDailyResult {
  return {
    id: overrides.id ?? 'result-1',
    sheetId: 'sheet-1',
    formCode: FORM_HEMA_021_CODE,
    criterionKey: 'pbf_spreading',
    dayOfMonth: 5,
    resultStatus: 'not_acceptable',
    lotNumberSnapshot: 'LOT-1',
    recordedBy: 'user-1',
    recordedByName: 'Alhanouf Khalaf',
    recordedByInitials: 'AK',
    recordedAt: '2026-09-06T10:00:00.000Z',
    ...overrides,
  };
}

function makeCorrective(overrides: Partial<StainQcCorrectiveAction> = {}): StainQcCorrectiveAction {
  return {
    id: 'ca-1',
    sheetId: 'sheet-1',
    dailyResultId: 'result-1',
    formCode: FORM_HEMA_021_CODE,
    criterionKey: 'pbf_spreading',
    dayOfMonth: 5,
    lotNumberSnapshot: 'LOT-1',
    actionCode: 'change_stain',
    recordedBy: 'user-1',
    recordedByName: 'Alhanouf Khalaf',
    recordedByInitials: 'AK',
    recordedAt: '2026-09-06T11:00:00.000Z',
    confirmedAt: '2026-09-06T11:00:00.000Z',
    ...overrides,
  };
}

describe('Change Stain helpers', () => {
  it('treats only confirmed change_stain actions as complete', () => {
    expect(isChangeStainConfirmed(makeCorrective())).toBe(true);
    expect(isChangeStainConfirmed({ actionCode: 'change_stain', confirmedAt: '' })).toBe(false);
  });

  it('lists pending not acceptable results without confirmed Change Stain', () => {
    const results = [
      makeResult({ id: 'bad-1' }),
      makeResult({ id: 'bad-2', dayOfMonth: 6 }),
      makeResult({ id: 'ok-1', resultStatus: 'acceptable', dayOfMonth: 7 }),
    ];
    const actions = [makeCorrective({ dailyResultId: 'bad-1' })];
    expect(pendingChangeStainResultIds(results, actions)).toEqual(['bad-2']);
  });

  it('formats QC Correction row display with controlled action and initials', () => {
    const entry: StainQcResponsibilityEntry = {
      id: 'resp-1',
      sheetId: 'sheet-1',
      formCode: FORM_HEMA_021_CODE,
      responsibilityType: 'qc_correction_change_stain',
      dayOfMonth: 5,
      lotNumberSnapshot: 'LOT-1',
      recordedBy: 'user-1',
      recordedByName: 'Alhanouf Khalaf',
      recordedByInitials: 'AK',
      recordedAt: '2026-09-06T11:00:00.000Z',
      note: STAIN_QC_CONTROLLED_CORRECTIVE_ACTION,
    };
    expect(formatQcCorrectionCellDisplay(entry)).toBe('Change Stain · AK');
    expect(formatQcCorrectionCellDisplay(undefined)).toBe('—');
  });

  it('builds audit history value with day, criterion, employee, and optional comment', () => {
    const value = buildChangeStainAuditValue({
      criterionKey: 'pbf_spreading',
      dayOfMonth: 5,
      recordedByName: 'Alhanouf Khalaf',
      recordedByInitials: 'AK',
      recordedAt: '2026-09-06T11:00:00.000Z',
      optionalComment: 'Replaced bottle',
    });
    expect(value).toContain('Change Stain');
    expect(value).toContain('day 5');
    expect(value).toContain('pbf_spreading');
    expect(value).toContain('Alhanouf Khalaf');
    expect(value).toContain('AK');
    expect(value).toContain('comment: Replaced bottle');
  });

  it('formats PDF corrective line with controlled action, initials, and timestamp', () => {
    const line = formatChangeStainPdfLine(makeCorrective({ comment: 'New bottle opened' }));
    expect(line).toContain('Day 5');
    expect(line).toContain('pbf_spreading');
    expect(line).toContain('Change Stain');
    expect(line).toContain('AK');
    expect(line).toContain('Comment: New bottle opened');
  });

  it('blocks lot replacement on sheets with daily results', () => {
    expect(sheetAllowsLotReplacement({
      currentLotNumber: '244741',
      currentExpiryDate: '2026-12-31',
      nextLotNumber: '999999',
      nextExpiryDate: '2027-01-31',
      hasDailyResults: true,
    }).allowed).toBe(false);

    expect(sheetAllowsLotReplacement({
      currentLotNumber: '244741',
      currentExpiryDate: '2026-12-31',
      nextLotNumber: '999999',
      hasDailyResults: false,
    }).allowed).toBe(true);
  });
});

describe('MonthlyStainQcGrid Change Stain display', () => {
  it('shows Change Stain with initials in QC Correction row for confirmed days', () => {
    render(
      <MonthlyStainQcGrid
        criteria={[CRITERION]}
        month={9}
        year={2026}
        dailyResults={[makeResult()]}
        correctiveActions={[makeCorrective()]}
        responsibilityEntries={[{
          id: 'resp-1',
          sheetId: 'sheet-1',
          formCode: FORM_HEMA_021_CODE,
          responsibilityType: 'qc_correction_change_stain',
          dayOfMonth: 5,
          lotNumberSnapshot: 'LOT-1',
          recordedBy: 'user-1',
          recordedByName: 'Alhanouf Khalaf',
          recordedByInitials: 'AK',
          recordedAt: '2026-09-06T11:00:00.000Z',
        }]}
        readOnly
      />,
    );
    expect(screen.getByText('Change Stain · AK')).toBeTruthy();
  });
});
