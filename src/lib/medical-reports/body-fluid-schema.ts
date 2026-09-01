import { z } from 'zod';
import type { BodyFluidWorksheet } from '@/types/body-fluid-worksheet';

const countEntrySchema = z.object({
  techNumber: z.union([z.literal(1), z.literal(2)]),
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

export function buildEmptyCountEntries(): BodyFluidWorksheetFormData['counts'] {
  const entries: BodyFluidWorksheetFormData['counts'] = [];
  for (const techNumber of [1, 2] as const) {
    for (const cellType of ['wbc', 'rbc'] as const) {
      const squareCount = cellType === 'wbc' ? 4 : 5;
      for (let square = 1; square <= squareCount; square += 1) {
        entries.push({ techNumber, cellType, squareNumber: square, countValue: undefined });
      }
    }
  }
  return entries;
}

export function worksheetToFormData(worksheet: BodyFluidWorksheet): BodyFluidWorksheetFormData {
  const counts = buildEmptyCountEntries().map((empty) => {
    const existing = worksheet.counts.find(
      (entry) => entry.techNumber === empty.techNumber
        && entry.cellType === empty.cellType
        && entry.squareNumber === empty.squareNumber,
    );
    return {
      ...empty,
      countValue: existing?.countValue ?? undefined,
    };
  });

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
