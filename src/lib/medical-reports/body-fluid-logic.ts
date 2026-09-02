import type {
  BodyFluidAgreementResult,
  BodyFluidCellType,
  BodyFluidCountEntry,
} from '@/types/body-fluid-worksheet';

export const FORM_HEMA_010_TITLE = 'BODY FLUID WORKSHEET';
export const FORM_HEMA_010_FOOTER = 'Form-Hema-010-Cell Count of Body Fluid & CSF Work Sheet';
export const FORM_HEMA_010_QID = 'HMG/SAH/QID/9162';

export const WBC_SQUARE_COUNT = 4;
export const RBC_SQUARE_COUNT = 5;
export const WBC_FORMULA_DIVISOR = 0.4;
export const RBC_FORMULA_DIVISOR = 0.02;
export const AGREEMENT_THRESHOLD_PERCENT = 30;

export const CLOTTED_NOTE =
  'If clotted, the cell count and differential results may be inaccurate because the specimen is partially clotted or has cell clumps/debris.';

export const AGREEMENT_NOTE =
  'Agreement between two counts should not exceed more than ±30%.';

export const SPECIMEN_TYPE_LABELS: Record<string, string> = {
  csf: 'CSF',
  pleural: 'Pleural',
  peritoneal: 'Peritoneal',
  synovial: 'Synovial',
  pericardial: 'Pericardial',
  other: 'Other',
};

export const CLOT_STATUS_LABELS: Record<string, string> = {
  clotted: 'Clotted',
  not_clotted: 'Not Clotted',
};

export type BodyFluidSideNumber = 1 | 2;

export function normalizeSideNumber(sideNumber?: number): BodyFluidSideNumber {
  return sideNumber === 2 ? 2 : 1;
}

export function squareNumbersForCellType(cellType: BodyFluidCellType): number[] {
  const count = cellType === 'wbc' ? WBC_SQUARE_COUNT : RBC_SQUARE_COUNT;
  return Array.from({ length: count }, (_, index) => index + 1);
}

export function getCountValue(
  counts: BodyFluidCountEntry[],
  techNumber: 1 | 2,
  cellType: BodyFluidCellType,
  squareNumber: number,
  sideNumber: BodyFluidSideNumber = 1,
): number | undefined {
  return counts.find(
    (entry) => entry.techNumber === techNumber
      && normalizeSideNumber(entry.sideNumber) === sideNumber
      && entry.cellType === cellType
      && entry.squareNumber === squareNumber,
  )?.countValue;
}

export function getSquareValues(
  counts: BodyFluidCountEntry[],
  techNumber: 1 | 2,
  cellType: BodyFluidCellType,
  sideNumber: BodyFluidSideNumber = 1,
): Array<number | undefined> {
  return squareNumbersForCellType(cellType).map(
    (square) => getCountValue(counts, techNumber, cellType, square, sideNumber),
  );
}

export function sumSquareCounts(values: Array<number | undefined>): number | undefined {
  const numeric = values.filter((value): value is number => value != null && !Number.isNaN(value));
  if (numeric.length === 0) return undefined;
  return numeric.reduce((sum, value) => sum + value, 0);
}

export function averageSquareCounts(values: Array<number | undefined>): number | undefined {
  const numeric = values.filter((value): value is number => value != null && !Number.isNaN(value));
  if (numeric.length === 0) return undefined;
  return sumSquareCounts(numeric)! / numeric.length;
}

export function hasAnySideCounts(
  counts: BodyFluidCountEntry[],
  techNumber: 1 | 2,
  sideNumber: BodyFluidSideNumber,
): boolean {
  return ['wbc', 'rbc'].some((cellType) =>
    getSquareValues(counts, techNumber, cellType as BodyFluidCellType, sideNumber)
      .some((value) => value != null));
}

export function hasCompleteSideCounts(
  counts: BodyFluidCountEntry[],
  techNumber: 1 | 2,
  sideNumber: BodyFluidSideNumber,
): boolean {
  const wbcComplete = squareNumbersForCellType('wbc').every(
    (square) => getCountValue(counts, techNumber, 'wbc', square, sideNumber) != null,
  );
  const rbcComplete = squareNumbersForCellType('rbc').every(
    (square) => getCountValue(counts, techNumber, 'rbc', square, sideNumber) != null,
  );
  return wbcComplete && rbcComplete;
}

/** Percent difference relative to the mean of both values. */
export function percentDifference(a: number, b: number): number {
  const mean = (a + b) / 2;
  if (mean === 0) return a === b ? 0 : 100;
  return (Math.abs(a - b) / mean) * 100;
}

export function evaluateAgreement(
  value1?: number,
  value2?: number,
  secondTechEnabled = false,
): BodyFluidAgreementResult {
  if (!secondTechEnabled || value1 == null || value2 == null) return 'not_performed';
  return percentDifference(value1, value2) <= AGREEMENT_THRESHOLD_PERCENT ? 'acceptable' : 'discrepancy';
}

export function agreementDisplay(result: BodyFluidAgreementResult): string {
  switch (result) {
    case 'acceptable':
      return 'AGREEMENT ACCEPTABLE';
    case 'discrepancy':
      return 'COUNT DISCREPANCY >30%';
    default:
      return 'Second Tech Count: Not Performed';
  }
}

export function resolveDilutionFactor(dilutionUsed: boolean, dilutionFactor?: number | null): number {
  if (!dilutionUsed) return 1;
  return dilutionFactor ?? 1;
}

export function calculateFinalCellCount(
  average?: number,
  dilutionUsed = false,
  dilutionFactor?: number | null,
  divisor = WBC_FORMULA_DIVISOR,
): number | undefined {
  if (average == null) return undefined;
  const factor = resolveDilutionFactor(dilutionUsed, dilutionFactor);
  return (average * factor) / divisor;
}

function calculateSideCellResult(
  counts: BodyFluidCountEntry[],
  techNumber: 1 | 2,
  sideNumber: BodyFluidSideNumber,
  cellType: BodyFluidCellType,
  dilutionUsed: boolean,
  dilutionFactor?: number | null,
): number | undefined {
  if (!hasCompleteSideCounts(counts, techNumber, sideNumber)) return undefined;
  const average = averageSquareCounts(getSquareValues(counts, techNumber, cellType, sideNumber));
  const divisor = cellType === 'wbc' ? WBC_FORMULA_DIVISOR : RBC_FORMULA_DIVISOR;
  return calculateFinalCellCount(average, dilutionUsed, dilutionFactor, divisor);
}

function techFinalCellResult(
  counts: BodyFluidCountEntry[],
  techNumber: 1 | 2,
  cellType: BodyFluidCellType,
  dilutionUsed: boolean,
  dilutionFactor?: number | null,
): number | undefined {
  const side1Result = calculateSideCellResult(counts, techNumber, 1, cellType, dilutionUsed, dilutionFactor);
  if (side1Result == null) return undefined;
  if (!hasAnySideCounts(counts, techNumber, 2)) return side1Result;
  if (!hasCompleteSideCounts(counts, techNumber, 2)) return side1Result;
  const side2Result = calculateSideCellResult(counts, techNumber, 2, cellType, dilutionUsed, dilutionFactor);
  if (side2Result == null) return side1Result;
  return (side1Result + side2Result) / 2;
}

export interface BodyFluidDerivedCounts {
  tech1TotalWbc?: number;
  tech1AvgWbc?: number;
  tech1TotalRbc?: number;
  tech1AvgRbc?: number;
  tech1Side1Wbc?: number;
  tech1Side2Wbc?: number;
  tech1Side1Rbc?: number;
  tech1Side2Rbc?: number;
  tech1FinalWbc?: number;
  tech1FinalRbc?: number;
  tech2TotalWbc?: number;
  tech2AvgWbc?: number;
  tech2TotalRbc?: number;
  tech2AvgRbc?: number;
  tech2Side1Wbc?: number;
  tech2Side2Wbc?: number;
  tech2Side1Rbc?: number;
  tech2Side2Rbc?: number;
  tech2FinalWbc?: number;
  tech2FinalRbc?: number;
  wbcAgreement: BodyFluidAgreementResult;
  rbcAgreement: BodyFluidAgreementResult;
  finalAverageWbc?: number;
  finalAverageRbc?: number;
  finalWbc?: number;
  finalRbc?: number;
  hasDiscrepancy: boolean;
}

export function deriveBodyFluidCounts(input: {
  counts: BodyFluidCountEntry[];
  secondTechEnabled: boolean;
  dilutionUsed: boolean;
  dilutionFactor?: number | null;
}): BodyFluidDerivedCounts {
  const tech1WbcSide1 = getSquareValues(input.counts, 1, 'wbc', 1);
  const tech1RbcSide1 = getSquareValues(input.counts, 1, 'rbc', 1);
  const tech2WbcSide1 = getSquareValues(input.counts, 2, 'wbc', 1);
  const tech2RbcSide1 = getSquareValues(input.counts, 2, 'rbc', 1);

  const tech1Side1Wbc = calculateSideCellResult(input.counts, 1, 1, 'wbc', input.dilutionUsed, input.dilutionFactor);
  const tech1Side2Wbc = calculateSideCellResult(input.counts, 1, 2, 'wbc', input.dilutionUsed, input.dilutionFactor);
  const tech1Side1Rbc = calculateSideCellResult(input.counts, 1, 1, 'rbc', input.dilutionUsed, input.dilutionFactor);
  const tech1Side2Rbc = calculateSideCellResult(input.counts, 1, 2, 'rbc', input.dilutionUsed, input.dilutionFactor);
  const tech2Side1Wbc = input.secondTechEnabled
    ? calculateSideCellResult(input.counts, 2, 1, 'wbc', input.dilutionUsed, input.dilutionFactor)
    : undefined;
  const tech2Side2Wbc = input.secondTechEnabled
    ? calculateSideCellResult(input.counts, 2, 2, 'wbc', input.dilutionUsed, input.dilutionFactor)
    : undefined;
  const tech2Side1Rbc = input.secondTechEnabled
    ? calculateSideCellResult(input.counts, 2, 1, 'rbc', input.dilutionUsed, input.dilutionFactor)
    : undefined;
  const tech2Side2Rbc = input.secondTechEnabled
    ? calculateSideCellResult(input.counts, 2, 2, 'rbc', input.dilutionUsed, input.dilutionFactor)
    : undefined;

  const tech1FinalWbc = techFinalCellResult(input.counts, 1, 'wbc', input.dilutionUsed, input.dilutionFactor);
  const tech1FinalRbc = techFinalCellResult(input.counts, 1, 'rbc', input.dilutionUsed, input.dilutionFactor);
  const tech2FinalWbc = input.secondTechEnabled
    ? techFinalCellResult(input.counts, 2, 'wbc', input.dilutionUsed, input.dilutionFactor)
    : undefined;
  const tech2FinalRbc = input.secondTechEnabled
    ? techFinalCellResult(input.counts, 2, 'rbc', input.dilutionUsed, input.dilutionFactor)
    : undefined;

  const wbcAgreement = evaluateAgreement(tech1FinalWbc, tech2FinalWbc, input.secondTechEnabled);
  const rbcAgreement = evaluateAgreement(tech1FinalRbc, tech2FinalRbc, input.secondTechEnabled);
  const hasDiscrepancy = wbcAgreement === 'discrepancy' || rbcAgreement === 'discrepancy';

  let finalWbc = tech1FinalWbc;
  let finalRbc = tech1FinalRbc;

  if (input.secondTechEnabled && !hasDiscrepancy) {
    if (tech2FinalWbc != null && wbcAgreement === 'acceptable') {
      finalWbc = tech1FinalWbc != null ? (tech1FinalWbc + tech2FinalWbc) / 2 : tech2FinalWbc;
    }
    if (tech2FinalRbc != null && rbcAgreement === 'acceptable') {
      finalRbc = tech1FinalRbc != null ? (tech1FinalRbc + tech2FinalRbc) / 2 : tech2FinalRbc;
    }
  }

  if (hasDiscrepancy) {
    finalWbc = undefined;
    finalRbc = undefined;
  }

  return {
    tech1TotalWbc: sumSquareCounts(tech1WbcSide1),
    tech1AvgWbc: averageSquareCounts(tech1WbcSide1),
    tech1TotalRbc: sumSquareCounts(tech1RbcSide1),
    tech1AvgRbc: averageSquareCounts(tech1RbcSide1),
    tech1Side1Wbc,
    tech1Side2Wbc,
    tech1Side1Rbc,
    tech1Side2Rbc,
    tech1FinalWbc,
    tech1FinalRbc,
    tech2TotalWbc: input.secondTechEnabled ? sumSquareCounts(tech2WbcSide1) : undefined,
    tech2AvgWbc: input.secondTechEnabled ? averageSquareCounts(tech2WbcSide1) : undefined,
    tech2TotalRbc: input.secondTechEnabled ? sumSquareCounts(tech2RbcSide1) : undefined,
    tech2AvgRbc: input.secondTechEnabled ? averageSquareCounts(tech2RbcSide1) : undefined,
    tech2Side1Wbc,
    tech2Side2Wbc,
    tech2Side1Rbc,
    tech2Side2Rbc,
    tech2FinalWbc,
    tech2FinalRbc,
    wbcAgreement,
    rbcAgreement,
    finalAverageWbc: finalWbc,
    finalAverageRbc: finalRbc,
    finalWbc,
    finalRbc,
    hasDiscrepancy,
  };
}

export function hasCompleteTechCounts(
  counts: BodyFluidCountEntry[],
  techNumber: 1 | 2,
): boolean {
  return hasCompleteSideCounts(counts, techNumber, 1);
}

export function validateBodyFluidSubmit(input: {
  specimenType?: string;
  specimenTypeOther?: string;
  timeReceived?: string;
  counts: BodyFluidCountEntry[];
  secondTechEnabled: boolean;
  secondTechUserId?: string;
  dilutionUsed: boolean;
  dilutionFactor?: number | null;
  comments?: string;
  derived: BodyFluidDerivedCounts;
}): { ok: boolean; reason?: string } {
  if (!input.specimenType) return { ok: false, reason: 'Specimen type is required.' };
  if (input.specimenType === 'other' && !input.specimenTypeOther?.trim()) {
    return { ok: false, reason: 'Other specimen type description is required.' };
  }
  if (!input.timeReceived) return { ok: false, reason: 'Time received is required.' };
  if (!hasCompleteSideCounts(input.counts, 1, 1)) {
    return { ok: false, reason: 'Tech #1 Side 1 WBC and RBC square counts are required.' };
  }
  if (input.secondTechEnabled && !hasCompleteSideCounts(input.counts, 2, 1)) {
    return { ok: false, reason: 'Complete Tech #2 Side 1 counts or disable second technologist.' };
  }
  if (input.secondTechEnabled && !input.secondTechUserId) {
    return { ok: false, reason: 'Select the second tech when second tech count is enabled.' };
  }
  if (input.dilutionUsed && (input.dilutionFactor == null || input.dilutionFactor <= 0)) {
    return { ok: false, reason: 'Dilution factor is required when dilution is used.' };
  }
  if (input.derived.hasDiscrepancy && !input.comments?.trim()) {
    return { ok: false, reason: 'Comment is required when count discrepancy exceeds 30%.' };
  }
  return { ok: true };
}

export function formatCellsPerMm3(value?: number | null): string {
  if (value == null) return '—';
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} Cells/mm³`;
}

export function side2IsActive(
  counts: BodyFluidCountEntry[],
  techNumber: 1 | 2,
): boolean {
  return hasAnySideCounts(counts, techNumber, 2);
}
