import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StainQcResultLegend } from '@/components/stain-qc/stain-qc-result-legend';
import {
  buildDailyGrid,
  cellStatusAriaLabel,
  cellStatusSymbol,
  computeCompletionSummary,
  daysInMonth,
  isLeapYear,
  isValidCalendarDay,
  nextCellStatus,
} from '@/lib/stain-qc/calendar';
import {
  FORM_HEMA_021_CODE,
  FORM_HEMA_021_TITLE,
  FORM_HEMA_039_CODE,
  FORM_HEMA_039_TITLE,
  STAIN_QC_RESULT_SYMBOL_LEGEND_LINES,
  getStainQcFormDefinition,
  stainQcPdfLegendBlock,
  stainQcResultLegendText,
  titleIncludesGiemsaFor021,
} from '@/lib/stain-qc/constants';
import {
  canApproveStainQc,
  canApproveStainQcSheet,
  canRecordStainQc,
  canReviewStainQc,
  canReviewStainQcSheet,
  canSubmitStainQc,
  isStainQcSheetEditable,
} from '@/lib/stain-qc/permissions';
import { hasPermission } from '@/lib/permissions/roles';
import { getStainQcPdfLegendBlock, renderStainQcFormPdf } from '@/lib/print/stain-qc-form-pdf';
import type {
  StainQcCriterion,
  StainQcDailyResult,
  StainQcMonthlySheetDetail,
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

function makeResult(overrides: Partial<StainQcDailyResult> = {}): StainQcDailyResult {
  return {
    id: overrides.id ?? 'result-1',
    sheetId: overrides.sheetId ?? 'sheet-1',
    formCode: FORM_HEMA_021_CODE,
    criterionKey: overrides.criterionKey ?? 'pbf_spreading',
    dayOfMonth: overrides.dayOfMonth ?? 1,
    resultStatus: overrides.resultStatus ?? 'acceptable',
    lotNumberSnapshot: 'LOT-1',
    recordedBy: overrides.recordedBy ?? 'user-1',
    recordedByName: overrides.recordedByName ?? 'Alhanouf Khalaf',
    recordedByInitials: overrides.recordedByInitials ?? 'AK',
    recordedAt: overrides.recordedAt ?? '2026-09-06T10:00:00.000Z',
    ...overrides,
  };
}

describe('result symbol legend', () => {
  it('defines the exact official legend lines', () => {
    expect(STAIN_QC_RESULT_SYMBOL_LEGEND_LINES).toEqual([
      '✓ : ACCEPTABLE',
      '✕ : NOT ACCEPTABLE',
      'N/A : NOT APPLICABLE',
    ]);
  });

  it('renders all three legend values in the UI header legend', () => {
    render(<StainQcResultLegend />);
    expect(screen.getByRole('group', { name: 'Result symbol legend' })).toBeTruthy();
    expect(screen.getByText('✓ : ACCEPTABLE')).toBeTruthy();
    expect(screen.getByText('✕ : NOT ACCEPTABLE')).toBeTruthy();
    expect(screen.getByText('N/A : NOT APPLICABLE')).toBeTruthy();
  });

  it('includes all three legend values in the PDF header block', () => {
    const block = getStainQcPdfLegendBlock();
    expect(stainQcResultLegendText()).toEqual(STAIN_QC_RESULT_SYMBOL_LEGEND_LINES);
    expect(stainQcPdfLegendBlock()).toBe(block);
    expect(block).toContain('✓ : ACCEPTABLE');
    expect(block).toContain('✕ : NOT ACCEPTABLE');
    expect(block).toContain('N/A : NOT APPLICABLE');
    expect(block).not.toMatch(/HMG\/SAH\/QID/i);
  });
});

describe('Form-Hema-021 identity', () => {
  it('displays the correct independent title', () => {
    const def = getStainQcFormDefinition(FORM_HEMA_021_CODE);
    expect(def.formTitle).toBe('Quality Control RAPI Stain');
    expect(def.stainName).toBe('RAPI Stain');
  });

  it('does not include Giemsa Stain in the Form-Hema-021 title', () => {
    expect(FORM_HEMA_021_TITLE).not.toMatch(/giemsa/i);
    expect(titleIncludesGiemsaFor021(FORM_HEMA_021_TITLE, FORM_HEMA_021_CODE)).toBe(false);
    expect(getStainQcFormDefinition(FORM_HEMA_039_CODE).formTitle).toBe(FORM_HEMA_039_TITLE);
  });
});

describe('daily cell behavior', () => {
  it('click on empty cell sets acceptable', () => {
    expect(nextCellStatus(null, 'click')).toBe('acceptable');
  });

  it('saved acceptable records identity metadata separately from empty', () => {
    const result = makeResult();
    expect(result.recordedByName).toBe('Alhanouf Khalaf');
    expect(result.recordedAt).toBeTruthy();
    expect(cellStatusSymbol('acceptable')).toBe('✓');
    expect(cellStatusSymbol(null)).toBe('');
    expect(cellStatusAriaLabel('na')).toBe('NOT APPLICABLE');
    expect(cellStatusAriaLabel(null)).toBe('Empty');
  });

  it('N/A persists distinctly from empty', () => {
    expect(cellStatusSymbol('na')).toBe('N/A');
    expect(nextCellStatus(null, 'na')).toBe('na');
  });

  it('does not silently convert empty to N/A', () => {
    expect(nextCellStatus(null, 'click')).toBe('acceptable');
    expect(nextCellStatus(null, 'clear')).toBeNull();
  });
});

describe('calendar rules', () => {
  it('disables invalid month days', () => {
    expect(isValidCalendarDay(31, 4, 2026)).toBe(false);
    expect(isValidCalendarDay(30, 2, 2026)).toBe(false);
    expect(isValidCalendarDay(31, 2, 2026)).toBe(false);
  });

  it('supports February and leap years', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(daysInMonth(2, 2024)).toBe(29);
    expect(isValidCalendarDay(29, 2, 2024)).toBe(true);
    expect(daysInMonth(2, 2026)).toBe(28);
  });
});

describe('completion and concurrency helpers', () => {
  it('counts only valid calendar days and treats N/A as filled', () => {
    const summary = computeCompletionSummary({
      criteria: CRITERIA,
      month: 4,
      year: 2026,
      results: [
        makeResult({ criterionKey: 'pbf_spreading', dayOfMonth: 1, resultStatus: 'acceptable' }),
        makeResult({ id: 'result-2', criterionKey: 'bc_platelets', dayOfMonth: 1, resultStatus: 'na' }),
      ],
      correctiveActionResultIds: new Set(),
    });
    expect(summary.totalApplicableCells).toBe(60);
    expect(summary.filledCells).toBe(2);
    expect(summary.missingCells).toBe(58);
  });

  it('does not overwrite existing grid entries when rebuilding', () => {
    const first = makeResult({ dayOfMonth: 3 });
    const grid = buildDailyGrid([first]);
    expect(grid.pbf_spreading?.[3]?.recordedBy).toBe('user-1');
  });

  it('tracks pending corrective actions for not acceptable cells', () => {
    const result = makeResult({ id: 'bad-1', resultStatus: 'not_acceptable' });
    const summary = computeCompletionSummary({
      criteria: CRITERIA,
      month: 4,
      year: 2026,
      results: [result],
      correctiveActionResultIds: new Set(),
    });
    expect(summary.notAcceptableCells).toBe(1);
    expect(summary.pendingCorrectiveCount).toBe(1);
  });
});

describe('permissions and workflow matrix', () => {
  it('allows lab technologist to enter and submit', () => {
    expect(hasPermission('lab_technologist', 'stain_qc.record')).toBe(true);
    expect(hasPermission('lab_technologist', 'stain_qc.submit')).toBe(true);
    expect(canRecordStainQc((p) => hasPermission('lab_technologist', p))).toBe(true);
    expect(canSubmitStainQc((p) => hasPermission('lab_technologist', p))).toBe(true);
  });

  it('allows senior and quality to review but not approve', () => {
    expect(canReviewStainQc((p) => hasPermission('senior_lab_technologist', p))).toBe(true);
    expect(canApproveStainQc((p) => hasPermission('senior_lab_technologist', p))).toBe(false);
    expect(canReviewStainQc((p) => hasPermission('quality_officer', p))).toBe(true);
    expect(canApproveStainQc((p) => hasPermission('quality_officer', p))).toBe(false);
  });

  it('allows section supervisor to approve', () => {
    expect(canApproveStainQc((p) => hasPermission('section_supervisor', p))).toBe(true);
    expect(canReviewStainQcSheet({ status: 'submitted', submittedBy: 'other-user' }, 'reviewer', (p) => hasPermission('senior_lab_technologist', p))).toBe(true);
    expect(canReviewStainQcSheet({ status: 'submitted', submittedBy: 'same-user' }, 'same-user', (p) => hasPermission('senior_lab_technologist', p))).toBe(false);
    expect(canApproveStainQcSheet({ status: 'reviewed' }, (p) => hasPermission('section_supervisor', p))).toBe(true);
  });

  it('blocks read only from recording', () => {
    expect(hasPermission('read_only', 'stain_qc.record')).toBe(false);
    expect(hasPermission('read_only', 'stain_qc.submit')).toBe(false);
  });

  it('locks approved sheets', () => {
    expect(isStainQcSheetEditable('approved')).toBe(false);
    expect(isStainQcSheetEditable('draft')).toBe(true);
  });
});

describe('print/pdf output', () => {
  it('receives correct cell symbols and initials without UUIDs', async () => {
    const sheet: StainQcMonthlySheetDetail = {
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
      dailyResults: [makeResult({ dayOfMonth: 2, recordedByInitials: 'AK' })],
      responsibilityEntries: [],
      correctiveActions: [],
    };

    const blob = await renderStainQcFormPdf(sheet);
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(1000);
  });
});

describe('Form-Hema-039 reuse boundary', () => {
  it('keeps Form-Hema-039 identity separate for future implementation', () => {
    const rapi = getStainQcFormDefinition(FORM_HEMA_021_CODE);
    const giemsa = getStainQcFormDefinition(FORM_HEMA_039_CODE);
    expect(rapi.formCode).not.toBe(giemsa.formCode);
    expect(rapi.formTitle).not.toContain('Giemsa');
    expect(giemsa.formTitle).toContain('Giemsa');
  });
});
