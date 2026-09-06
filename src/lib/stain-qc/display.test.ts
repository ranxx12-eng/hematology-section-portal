import { describe, expect, it } from 'vitest';
import {
  buildStainQcPdfGrid,
  formatStainQcEmployeeDisplay,
  formatStainQcResponsibilityCellDisplay,
  stainQcDailyResultCellDisplay,
  stainQcPdfCriterionCells,
  stainQcPdfGridContainsUuid,
} from '@/lib/stain-qc/display';
import { FORM_HEMA_021_CODE, FORM_HEMA_021_TITLE } from '@/lib/stain-qc/constants';
import type {
  StainQcCriterion,
  StainQcDailyResult,
  StainQcMonthlySheetDetail,
  StainQcResponsibilityEntry,
} from '@/types/stain-qc';

const CRITERIA: StainQcCriterion[] = [
  {
    id: '1',
    formCode: FORM_HEMA_021_CODE,
    criterionKey: 'pbf_spreading',
    sectionKey: 'peripheral_blood_film',
    sectionLabel: 'Peripheral Blood Film',
    rowLabel: 'Spreading',
    displayOrder: 1,
  },
  {
    id: '2',
    formCode: FORM_HEMA_021_CODE,
    criterionKey: 'bc_platelets',
    sectionKey: 'blood_cells',
    sectionLabel: 'Blood Cells',
    rowLabel: 'Platelets',
    idealColor: 'Violet to Purple',
    displayOrder: 2,
  },
];

function makeSheet(overrides: Partial<StainQcMonthlySheetDetail> = {}): StainQcMonthlySheetDetail {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    sheetNumber: 'RAPI-QC-2026-001',
    formCode: FORM_HEMA_021_CODE,
    formTitle: FORM_HEMA_021_TITLE,
    stainName: 'RAPI Stain',
    lotNumber: '244741',
    expiryDate: '2026-12-31',
    sheetMonth: 9,
    sheetYear: 2026,
    status: 'draft',
    versionNumber: 1,
    createdAt: '2026-09-06T00:00:00.000Z',
    updatedAt: '2026-09-06T00:00:00.000Z',
    criteria: CRITERIA,
    dailyResults: [],
    responsibilityEntries: [],
    correctiveActions: [],
    ...overrides,
  };
}

describe('stainQcDailyResultCellDisplay', () => {
  it('renders only result symbols', () => {
    expect(stainQcDailyResultCellDisplay('acceptable')).toBe('✓');
    expect(stainQcDailyResultCellDisplay('not_acceptable')).toBe('✕');
    expect(stainQcDailyResultCellDisplay('na')).toBe('N/A');
    expect(stainQcDailyResultCellDisplay(null)).toBe('');
  });
});

describe('formatStainQcEmployeeDisplay', () => {
  it('renders full name and hospital staff ID', () => {
    expect(formatStainQcEmployeeDisplay('Rawan Alfaifi', '399894')).toBe('Rawan Alfaifi · Staff ID: 399894');
  });

  it('does not generate initials such as R/399894', () => {
    expect(formatStainQcEmployeeDisplay('Rawan Alfaifi', '399894')).not.toContain('R/399894');
  });
});

describe('buildStainQcPdfGrid', () => {
  const dailyResults: StainQcDailyResult[] = [
    {
      id: 'result-1',
      sheetId: '00000000-0000-0000-0000-000000000001',
      formCode: FORM_HEMA_021_CODE,
      criterionKey: 'pbf_spreading',
      dayOfMonth: 2,
      resultStatus: 'acceptable',
      lotNumberSnapshot: '244741',
      recordedBy: '00000000-0000-0000-0000-000000000099',
      recordedByName: 'Rawan Alfaifi',
      recordedByStaffId: '399894',
      recordedByInitials: 'R/399894',
      recordedAt: '2026-09-06T10:00:00.000Z',
    },
    {
      id: 'result-2',
      sheetId: '00000000-0000-0000-0000-000000000001',
      formCode: FORM_HEMA_021_CODE,
      criterionKey: 'bc_platelets',
      dayOfMonth: 3,
      resultStatus: 'not_acceptable',
      lotNumberSnapshot: '244741',
      recordedBy: '00000000-0000-0000-0000-000000000099',
      recordedByName: 'Rawan Alfaifi',
      recordedByStaffId: '399894',
      recordedByInitials: 'R/399894',
      recordedAt: '2026-09-06T10:00:00.000Z',
    },
    {
      id: 'result-3',
      sheetId: '00000000-0000-0000-0000-000000000001',
      formCode: FORM_HEMA_021_CODE,
      criterionKey: 'bc_platelets',
      dayOfMonth: 4,
      resultStatus: 'na',
      lotNumberSnapshot: '244741',
      recordedBy: '00000000-0000-0000-0000-000000000099',
      recordedByName: 'Rawan Alfaifi',
      recordedByStaffId: '399894',
      recordedByInitials: 'R/399894',
      recordedAt: '2026-09-06T10:00:00.000Z',
    },
  ];

  const preparedEntry: StainQcResponsibilityEntry = {
    id: 'resp-prepared',
    sheetId: '00000000-0000-0000-0000-000000000001',
    formCode: FORM_HEMA_021_CODE,
    responsibilityType: 'slide_prepared',
    dayOfMonth: 2,
    lotNumberSnapshot: '244741',
    recordedBy: '00000000-0000-0000-0000-000000000099',
    recordedByName: 'Rawan Alfaifi',
    recordedByStaffId: '399894',
    recordedByInitials: 'R/399894',
    recordedAt: '2026-09-06T09:00:00.000Z',
  };

  const checkedEntry: StainQcResponsibilityEntry = {
    id: 'resp-checked',
    sheetId: '00000000-0000-0000-0000-000000000001',
    formCode: FORM_HEMA_021_CODE,
    responsibilityType: 'slide_checked',
    dayOfMonth: 5,
    lotNumberSnapshot: '244741',
    recordedBy: '00000000-0000-0000-0000-000000000088',
    recordedByName: 'Alhanouf Khalaf',
    recordedByStaffId: '401122',
    recordedByInitials: 'AK/401122',
    recordedAt: '2026-09-06T12:00:00.000Z',
  };

  it('uses separate criterion, component, and ideal color columns with section headers', () => {
    const { head, body } = buildStainQcPdfGrid(makeSheet({ dailyResults }));
    expect(head[0]?.slice(0, 4)).toEqual(['Criterion', 'Component', 'Ideal Color', '1']);
    expect(body.some((row) => typeof row[0] === 'object' && row[0].content === 'Peripheral Blood Film')).toBe(true);
    expect(body.some((row) => typeof row[0] === 'object' && row[0].content === 'Blood Cells')).toBe(true);
    const spreadingRow = body.find((row) => row[0] === 'Spreading');
    expect(spreadingRow?.[1]).toBe('');
    expect(spreadingRow?.[2]).toBe('');
  });

  it('keeps criterion cells as symbols only without recorder identity', () => {
    const { body } = buildStainQcPdfGrid(makeSheet({ dailyResults }));
    const criterionCells = stainQcPdfCriterionCells(body);
    expect(criterionCells).toContain('✓');
    expect(criterionCells).toContain('✕');
    expect(criterionCells).toContain('N/A');
    expect(criterionCells.filter(Boolean)).not.toContain('R/399894');
    expect(criterionCells.join(' ')).not.toMatch(/Staff ID:/);
  });

  it('leaves empty days blank in criterion rows', () => {
    const { body } = buildStainQcPdfGrid(makeSheet({ dailyResults }));
    const spreadingRow = body.find((row) => row[0] === 'Spreading') as string[];
    expect(spreadingRow[3]).toBe('');
    expect(spreadingRow[4]).toBe('✓');
  });

  it('renders Prepared By with full name and staff ID under the correct day only', () => {
    const { body } = buildStainQcPdfGrid(makeSheet({
      dailyResults,
      responsibilityEntries: [preparedEntry],
    }));
    const preparedRow = body.find((row) => typeof row[0] === 'object' && row[0].content === 'Prepared By');
    expect(preparedRow?.[2]).toBe('Rawan Alfaifi · Staff ID: 399894');
    expect(preparedRow?.[1]).toBe('');
    expect(preparedRow?.[3]).toBe('');
  });

  it('keeps Checked By separate from Prepared By', () => {
    const { body } = buildStainQcPdfGrid(makeSheet({
      dailyResults,
      responsibilityEntries: [preparedEntry, checkedEntry],
    }));
    const preparedRow = body.find((row) => typeof row[0] === 'object' && row[0].content === 'Prepared By');
    const checkedRow = body.find((row) => typeof row[0] === 'object' && row[0].content === 'Checked By');
    expect(formatStainQcResponsibilityCellDisplay('slide_checked', checkedEntry)).toBe('Alhanouf Khalaf · Staff ID: 401122');
    expect(preparedRow?.[5]).toBe('');
    expect(checkedRow?.[5]).toBe('Alhanouf Khalaf · Staff ID: 401122');
  });

  it('does not expose UUIDs in grid output', () => {
    const { body } = buildStainQcPdfGrid(makeSheet({
      dailyResults,
      responsibilityEntries: [preparedEntry, checkedEntry],
    }));
    expect(stainQcPdfGridContainsUuid(body)).toBe(false);
  });
});
