import { describe, expect, it } from 'vitest';
import { deriveRapiStainCatalogStatus } from '@/lib/qc-records/rapi-catalog-status';
import { FORM_HEMA_021_CODE } from '@/lib/stain-qc/constants';
import type {
  StainQcCorrectiveAction,
  StainQcCriterion,
  StainQcDailyResult,
} from '@/types/stain-qc';

const CRITERIA: StainQcCriterion[] = [{
  id: '1',
  formCode: FORM_HEMA_021_CODE,
  criterionKey: 'pbf_spreading',
  sectionKey: 'pbf',
  sectionLabel: 'PBF',
  rowLabel: 'Spreading',
  displayOrder: 1,
}];

const SHEET = {
  id: 'sheet-1',
  status: 'draft' as const,
  lotNumber: '244741',
  expiryDate: '2026-12-31',
  sheetMonth: 9,
  sheetYear: 2026,
};

function makeResult(overrides: Partial<StainQcDailyResult> = {}): StainQcDailyResult {
  return {
    id: overrides.id ?? 'result-1',
    sheetId: 'sheet-1',
    formCode: FORM_HEMA_021_CODE,
    criterionKey: 'pbf_spreading',
    dayOfMonth: 9,
    resultStatus: 'acceptable',
    lotNumberSnapshot: '244741',
    recordedBy: 'user-1',
    recordedByName: 'Rawan Alfaifi',
    recordedByStaffId: '399894',
    recordedByInitials: 'RA',
    recordedAt: '2026-09-09T10:00:00.000Z',
    ...overrides,
  };
}

describe('deriveRapiStainCatalogStatus', () => {
  const now = new Date('2026-09-09T12:00:00.000Z');

  it('returns Not Recorded when no sheet or daily results exist', () => {
    expect(deriveRapiStainCatalogStatus({
      sheet: null,
      criteria: CRITERIA,
      dailyResults: [],
      correctiveActions: [],
    }, now).status).toBe('Not Recorded');
  });

  it('returns Due when the current day is missing entries', () => {
    const derived = deriveRapiStainCatalogStatus({
      sheet: SHEET,
      criteria: CRITERIA,
      dailyResults: [makeResult({ dayOfMonth: 8 })],
      correctiveActions: [],
    }, now);
    expect(derived.status).toBe('Due');
  });

  it('returns Completed when the current day is fully recorded without issues', () => {
    const derived = deriveRapiStainCatalogStatus({
      sheet: SHEET,
      criteria: CRITERIA,
      dailyResults: [makeResult({ dayOfMonth: 9, resultStatus: 'acceptable' })],
      correctiveActions: [],
    }, now);
    expect(derived.status).toBe('Completed');
    expect(derived.lastRecordedAt).toBe('2026-09-09T10:00:00.000Z');
  });

  it('returns Pending Change Stain for unresolved not acceptable results', () => {
    const derived = deriveRapiStainCatalogStatus({
      sheet: SHEET,
      criteria: CRITERIA,
      dailyResults: [makeResult({ dayOfMonth: 9, resultStatus: 'not_acceptable' })],
      correctiveActions: [],
    }, now);
    expect(derived.status).toBe('Pending Change Stain');
  });

  it('returns OUT when not acceptable results have confirmed change stain', () => {
    const result = makeResult({ id: 'na-1', dayOfMonth: 9, resultStatus: 'not_acceptable' });
    const corrective: StainQcCorrectiveAction = {
      id: 'ca-1',
      sheetId: 'sheet-1',
      dailyResultId: 'na-1',
      formCode: FORM_HEMA_021_CODE,
      criterionKey: 'pbf_spreading',
      dayOfMonth: 9,
      lotNumberSnapshot: '244741',
      actionCode: 'change_stain',
      recordedBy: 'user-1',
      recordedByName: 'Checker',
      recordedByInitials: 'CK',
      recordedAt: '2026-09-09T11:00:00.000Z',
      confirmedAt: '2026-09-09T11:00:00.000Z',
    };
    const derived = deriveRapiStainCatalogStatus({
      sheet: SHEET,
      criteria: CRITERIA,
      dailyResults: [result],
      correctiveActions: [corrective],
    }, now);
    expect(derived.status).toBe('OUT');
  });

  it('maps workflow statuses from the monthly sheet', () => {
    expect(deriveRapiStainCatalogStatus({
      sheet: { ...SHEET, status: 'submitted' },
      criteria: CRITERIA,
      dailyResults: [makeResult()],
      correctiveActions: [],
    }, now).status).toBe('Pending Review');

    expect(deriveRapiStainCatalogStatus({
      sheet: { ...SHEET, status: 'reviewed' },
      criteria: CRITERIA,
      dailyResults: [makeResult()],
      correctiveActions: [],
    }, now).status).toBe('Reviewed / Pending Approval');

    expect(deriveRapiStainCatalogStatus({
      sheet: { ...SHEET, status: 'approved' },
      criteria: CRITERIA,
      dailyResults: [makeResult()],
      correctiveActions: [],
    }, now).status).toBe('Approved');
  });
});
