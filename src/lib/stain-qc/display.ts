import { cellStatusSymbol, daysInMonth } from '@/lib/stain-qc/calendar';
import { formatQcCorrectionCellDisplay } from '@/lib/stain-qc/change-stain';
import { STAIN_QC_RESPONSIBILITY_LABELS } from '@/lib/stain-qc/constants';
import type {
  StainQcCellStatus,
  StainQcCriterion,
  StainQcMonthlySheetDetail,
  StainQcResponsibilityEntry,
  StainQcResponsibilityType,
} from '@/types/stain-qc';

const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

export const STAIN_QC_PDF_RESPONSIBILITY_TYPES: StainQcResponsibilityType[] = [
  'slide_prepared',
  'slide_checked',
  'qc_correction_change_stain',
];

export function stainQcDailyResultCellDisplay(status: StainQcCellStatus | null | undefined): string {
  return cellStatusSymbol(status ?? null);
}

export function formatStainQcEmployeeDisplay(
  fullName?: string | null,
  staffId?: string | null,
): string {
  const name = fullName?.trim() ?? '';
  const id = staffId?.trim() ?? '';
  if (name && id) return `${name} · Staff ID: ${id}`;
  if (name) return name;
  if (id) return `Staff ID: ${id}`;
  return '';
}

export function formatStainQcResponsibilityCellDisplay(
  responsibilityType: StainQcResponsibilityType,
  entry?: StainQcResponsibilityEntry,
): string {
  if (!entry) return '';
  if (responsibilityType === 'qc_correction_change_stain') {
    return formatQcCorrectionCellDisplay(entry);
  }
  return formatStainQcEmployeeDisplay(entry.recordedByName, entry.recordedByStaffId);
}

export function groupStainQcCriteriaBySection(criteria: StainQcCriterion[]): {
  sectionKey: string;
  sectionLabel: string;
  rows: StainQcCriterion[];
}[] {
  const grouped = new Map<string, StainQcCriterion[]>();
  for (const criterion of criteria) {
    const list = grouped.get(criterion.sectionKey) ?? [];
    list.push(criterion);
    grouped.set(criterion.sectionKey, list);
  }
  return Array.from(grouped.entries()).map(([sectionKey, rows]) => ({
    sectionKey,
    sectionLabel: rows[0]?.sectionLabel ?? sectionKey,
    rows,
  }));
}

export type StainQcPdfGridCell =
  | string
  | {
      content: string;
      colSpan?: number;
      styles?: Record<string, unknown>;
    };

export function buildStainQcPdfDayCells(input: {
  month: number;
  year: number;
  getDayValue: (day: number) => string;
}): string[] {
  const totalDays = daysInMonth(input.month, input.year);
  return Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    if (day > totalDays) return '';
    return input.getDayValue(day);
  });
}

export function buildStainQcPdfGrid(sheet: StainQcMonthlySheetDetail): {
  head: string[][];
  body: StainQcPdfGridCell[][];
} {
  const dayHeaders = Array.from({ length: 31 }, (_, index) => String(index + 1));
  const head = [['Criterion', 'Component', 'Ideal Color', ...dayHeaders]];

  const resultMap = new Map<string, string>();
  for (const result of sheet.dailyResults) {
    resultMap.set(
      `${result.criterionKey}:${result.dayOfMonth}`,
      stainQcDailyResultCellDisplay(result.resultStatus),
    );
  }

  const body: StainQcPdfGridCell[][] = [];

  for (const section of groupStainQcCriteriaBySection(sheet.criteria)) {
    body.push([{
      content: section.sectionLabel,
      colSpan: 34,
      styles: { fontStyle: 'bold', fillColor: [245, 245, 245] },
    }]);

    for (const criterion of section.rows) {
      body.push([
        criterion.rowLabel,
        criterion.componentLabel ?? '',
        criterion.idealColor ?? '',
        ...buildStainQcPdfDayCells({
          month: sheet.sheetMonth,
          year: sheet.sheetYear,
          getDayValue: (day) => resultMap.get(`${criterion.criterionKey}:${day}`) ?? '',
        }),
      ]);
    }
  }

  for (const responsibilityType of STAIN_QC_PDF_RESPONSIBILITY_TYPES) {
    const entriesByDay = Object.fromEntries(
      sheet.responsibilityEntries
        .filter((entry) => entry.responsibilityType === responsibilityType)
        .map((entry) => [entry.dayOfMonth, entry]),
    ) as Record<number, StainQcResponsibilityEntry | undefined>;

    body.push([
      {
        content: STAIN_QC_RESPONSIBILITY_LABELS[responsibilityType],
        colSpan: 3,
        styles: { fontStyle: 'bold', fillColor: [250, 250, 250] },
      },
      ...buildStainQcPdfDayCells({
        month: sheet.sheetMonth,
        year: sheet.sheetYear,
        getDayValue: (day) => formatStainQcResponsibilityCellDisplay(
          responsibilityType,
          entriesByDay[day],
        ),
      }),
    ]);
  }

  return { head, body };
}

export function stainQcPdfGridContainsUuid(grid: StainQcPdfGridCell[][]): boolean {
  return grid.some((row) => row.some((cell) => {
    const text = typeof cell === 'string' ? cell : cell.content;
    return UUID_PATTERN.test(text);
  }));
}

export function stainQcPdfCriterionCells(grid: StainQcPdfGridCell[][]): string[] {
  const values: string[] = [];
  for (const row of grid) {
    if (row.length !== 34) continue;
    if (typeof row[0] !== 'string') continue;
    for (let index = 3; index < row.length; index += 1) {
      const cell = row[index];
      if (typeof cell === 'string') values.push(cell);
    }
  }
  return values;
}
