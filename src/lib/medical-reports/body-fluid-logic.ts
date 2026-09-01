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

export function squareNumbersForCellType(cellType: BodyFluidCellType): number[] {
  const count = cellType === 'wbc' ? WBC_SQUARE_COUNT : RBC_SQUARE_COUNT;
  return Array.from({ length: count }, (_, index) => index + 1);
}

export function getCountValue(
  counts: BodyFluidCountEntry[],
  techNumber: 1 | 2,
  cellType: BodyFluidCellType,
  squareNumber: number,
): number | undefined {
  return counts.find(
    (entry) => entry.techNumber === techNumber
      && entry.cellType === cellType
      && entry.squareNumber === squareNumber,
  )?.countValue;
}

export function getSquareValues(
  counts: BodyFluidCountEntry[],
  techNumber: 1 | 2,
  cellType: BodyFluidCellType,
): Array<number | undefined> {
  return squareNumbersForCellType(cellType).map((square) => getCountValue(counts, techNumber, cellType, square));
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

/** Percent difference relative to the mean of both averages. */
export function percentDifference(a: number, b: number): number {
  const mean = (a + b) / 2;
  if (mean === 0) return a === b ? 0 : 100;
  return (Math.abs(a - b) / mean) * 100;
}

export function evaluateAgreement(
  avg1?: number,
  avg2?: number,
  secondTechEnabled = false,
): BodyFluidAgreementResult {
  if (!secondTechEnabled || avg1 == null || avg2 == null) return 'not_performed';
  return percentDifference(avg1, avg2) <= AGREEMENT_THRESHOLD_PERCENT ? 'acceptable' : 'discrepancy';
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

export interface BodyFluidDerivedCounts {
  tech1TotalWbc?: number;
  tech1AvgWbc?: number;
  tech1TotalRbc?: number;
  tech1AvgRbc?: number;
  tech2TotalWbc?: number;
  tech2AvgWbc?: number;
  tech2TotalRbc?: number;
  tech2AvgRbc?: number;
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
  const tech1Wbc = getSquareValues(input.counts, 1, 'wbc');
  const tech1Rbc = getSquareValues(input.counts, 1, 'rbc');
  const tech2Wbc = getSquareValues(input.counts, 2, 'wbc');
  const tech2Rbc = getSquareValues(input.counts, 2, 'rbc');

  const tech1AvgWbc = averageSquareCounts(tech1Wbc);
  const tech1AvgRbc = averageSquareCounts(tech1Rbc);
  const tech2AvgWbc = input.secondTechEnabled ? averageSquareCounts(tech2Wbc) : undefined;
  const tech2AvgRbc = input.secondTechEnabled ? averageSquareCounts(tech2Rbc) : undefined;

  const wbcAgreement = evaluateAgreement(tech1AvgWbc, tech2AvgWbc, input.secondTechEnabled);
  const rbcAgreement = evaluateAgreement(tech1AvgRbc, tech2AvgRbc, input.secondTechEnabled);
  const hasDiscrepancy = wbcAgreement === 'discrepancy' || rbcAgreement === 'discrepancy';

  let finalAverageWbc = tech1AvgWbc;
  let finalAverageRbc = tech1AvgRbc;

  if (input.secondTechEnabled && tech2AvgWbc != null && wbcAgreement === 'acceptable') {
    finalAverageWbc = (tech1AvgWbc! + tech2AvgWbc) / 2;
  }
  if (input.secondTechEnabled && tech2AvgRbc != null && rbcAgreement === 'acceptable') {
    finalAverageRbc = (tech1AvgRbc! + tech2AvgRbc) / 2;
  }

  const canFinalize = !hasDiscrepancy;
  const finalWbc = canFinalize
    ? calculateFinalCellCount(finalAverageWbc, input.dilutionUsed, input.dilutionFactor, WBC_FORMULA_DIVISOR)
    : undefined;
  const finalRbc = canFinalize
    ? calculateFinalCellCount(finalAverageRbc, input.dilutionUsed, input.dilutionFactor, RBC_FORMULA_DIVISOR)
    : undefined;

  return {
    tech1TotalWbc: sumSquareCounts(tech1Wbc),
    tech1AvgWbc,
    tech1TotalRbc: sumSquareCounts(tech1Rbc),
    tech1AvgRbc,
    tech2TotalWbc: input.secondTechEnabled ? sumSquareCounts(tech2Wbc) : undefined,
    tech2AvgWbc,
    tech2TotalRbc: input.secondTechEnabled ? sumSquareCounts(tech2Rbc) : undefined,
    tech2AvgRbc,
    wbcAgreement,
    rbcAgreement,
    finalAverageWbc,
    finalAverageRbc,
    finalWbc,
    finalRbc,
    hasDiscrepancy,
  };
}

export function hasCompleteTechCounts(
  counts: BodyFluidCountEntry[],
  techNumber: 1 | 2,
): boolean {
  const wbcComplete = squareNumbersForCellType('wbc').every(
    (square) => getCountValue(counts, techNumber, 'wbc', square) != null,
  );
  const rbcComplete = squareNumbersForCellType('rbc').every(
    (square) => getCountValue(counts, techNumber, 'rbc', square) != null,
  );
  return wbcComplete && rbcComplete;
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
  if (!hasCompleteTechCounts(input.counts, 1)) {
    return { ok: false, reason: 'Tech #1 WBC and RBC square counts are required.' };
  }
  if (input.secondTechEnabled && !hasCompleteTechCounts(input.counts, 2)) {
    return { ok: false, reason: 'Complete all Tech #2 square counts or disable second tech.' };
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
