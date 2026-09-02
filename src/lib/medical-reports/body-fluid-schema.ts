import { z } from 'zod';
import type { BodyFluidWorksheet } from '@/types/body-fluid-worksheet';
import { normalizeSideNumber } from '@/lib/medical-reports/body-fluid-logic';

const countEntrySchema = z.object({
  techNumber: z.union([z.literal(1), z.literal(2)]),
  sideNumber: z.union([z.literal(1), z.literal(2)]).optional(),
  cellType: z.enum(['wbc', 'rbc']),
  squareNumber: z.number().int().positive(),
  countValue: z.coerce.number().min(0).optional().nullable(),
});

export const bodyFluidWorksheetFormSchema = z.object({
  patientLabelReference: z.string().optional(),
  timeReceived: z.string().optional(),
  specimenType: z.enum(['csf', 'pleural', 'peritoneal', 'synovial', 'pericardial', 'other']).optional(),
  specimenTypeOther: z.string().optional(),
  tubeNumber: z.string().optional(),
  clotStatus: z.enum(['clotted', 'not_clotted']).optional(),
  colorAppearance: z.string().optional(),
  chamberBackground: z.string().optional(),
  dilutionUsed: z.boolean(),
  dilutionBackgroundOk: z.boolean().optional(),
  dilutionFactor: z.coerce.number().positive().optional().nullable(),
  secondTechEnabled: z.boolean(),
  secondTechUserId: z.string().optional(),
  differentialNeutrophils: z.coerce.number().min(0).optional().nullable(),
  differentialLymphocytes: z.coerce.number().min(0).optional().nullable(),
  differentialMonocytes: z.coerce.number().min(0).optional().nullable(),
  differentialOtherType: z.string().optional(),
  differentialOtherQuantity: z.coerce.number().min(0).optional().nullable(),
  comments: z.string().optional(),
  pathologistName: z.string().optional(),
  pathologistStaffId: z.string().optional(),
  pathologistReviewedAt: z.string().optional(),
  pathologistComment: z.string().optional(),
  counts: z.array(countEntrySchema),
});

export type BodyFluidWorksheetFormData = z.infer<typeof bodyFluidWorksheetFormSchema>;

export function toLocalDatetimeInput(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function buildSideCountEntries(
  techNumber: 1 | 2,
  sideNumber: 1 | 2,
): BodyFluidWorksheetFormData['counts'] {
  const entries: BodyFluidWorksheetFormData['counts'] = [];
  for (const cellType of ['wbc', 'rbc'] as const) {
    const squareCount = cellType === 'wbc' ? 4 : 5;
    for (let square = 1; square <= squareCount; square += 1) {
      entries.push({ techNumber, sideNumber, cellType, squareNumber: square, countValue: undefined });
    }
  }
  return entries;
}

export function buildEmptyCountEntries(): BodyFluidWorksheetFormData['counts'] {
  return [
    ...buildSideCountEntries(1, 1),
    ...buildSideCountEntries(2, 1),
  ];
}

export function appendSide2Counts(
  counts: BodyFluidWorksheetFormData['counts'],
  techNumber: 1 | 2,
): BodyFluidWorksheetFormData['counts'] {
  const existing = counts.filter(
    (entry) => entry.techNumber === techNumber && normalizeSideNumber(entry.sideNumber) === 2,
  );
  if (existing.length > 0) return counts;
  return [...counts, ...buildSideCountEntries(techNumber, 2)];
}

export function removeSide2Counts(
  counts: BodyFluidWorksheetFormData['counts'],
  techNumber: 1 | 2,
): BodyFluidWorksheetFormData['counts'] {
  return counts.filter(
    (entry) => !(entry.techNumber === techNumber && normalizeSideNumber(entry.sideNumber) === 2),
  );
}

export function worksheetToFormData(worksheet: BodyFluidWorksheet): BodyFluidWorksheetFormData {
  const counts = buildEmptyCountEntries().map((empty) => {
    const existing = worksheet.counts.find(
      (entry) => entry.techNumber === empty.techNumber
        && normalizeSideNumber(entry.sideNumber) === normalizeSideNumber(empty.sideNumber)
        && entry.cellType === empty.cellType
        && entry.squareNumber === empty.squareNumber,
    );
    return {
      ...empty,
      countValue: existing?.countValue ?? undefined,
    };
  });

  for (const entry of worksheet.counts) {
    if (normalizeSideNumber(entry.sideNumber) === 2) {
      const exists = counts.some(
        (count) => count.techNumber === entry.techNumber
          && normalizeSideNumber(count.sideNumber) === 2
          && count.cellType === entry.cellType
          && count.squareNumber === entry.squareNumber,
      );
      if (!exists) {
        counts.push({
          techNumber: entry.techNumber,
          sideNumber: 2,
          cellType: entry.cellType,
          squareNumber: entry.squareNumber,
          countValue: entry.countValue,
        });
      }
    }
  }

  return {
    patientLabelReference: worksheet.patientLabelReference,
    timeReceived: toLocalDatetimeInput(worksheet.timeReceived),
    specimenType: worksheet.specimenType,
    specimenTypeOther: worksheet.specimenTypeOther,
    tubeNumber: worksheet.tubeNumber,
    clotStatus: worksheet.clotStatus,
    colorAppearance: worksheet.colorAppearance,
    chamberBackground: worksheet.chamberBackground,
    dilutionUsed: worksheet.dilutionUsed,
    dilutionBackgroundOk: worksheet.dilutionBackgroundOk,
    dilutionFactor: worksheet.dilutionFactor,
    secondTechEnabled: worksheet.secondTechEnabled,
    secondTechUserId: worksheet.secondTechUserId,
    differentialNeutrophils: worksheet.differentialNeutrophils,
    differentialLymphocytes: worksheet.differentialLymphocytes,
    differentialMonocytes: worksheet.differentialMonocytes,
    differentialOtherType: worksheet.differentialOtherType,
    differentialOtherQuantity: worksheet.differentialOtherQuantity,
    comments: worksheet.comments,
    pathologistName: worksheet.pathologistName,
    pathologistStaffId: worksheet.pathologistStaffId,
    pathologistReviewedAt: toLocalDatetimeInput(worksheet.pathologistReviewedAt),
    pathologistComment: worksheet.pathologistComment,
    counts,
  };
}
