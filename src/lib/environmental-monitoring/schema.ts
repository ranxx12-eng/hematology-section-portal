import { z } from 'zod';
import { ENVIRONMENTAL_ASSET_TYPES } from './constants';
import { computeOutOfRangeParameters } from './compliance';
import type {
  EnvironmentalAsset,
  EnvironmentalMonitoringWindow,
  EnvironmentalOutOfRangeParameters,
  EnvironmentalReading,
} from '@/types/environmental-monitoring';

export const environmentalReadingFormSchema = z.object({
  assetId: z.string().uuid(),
  monitoringWindowId: z.string().uuid().optional(),
  temperature: z.coerce.number(),
  humidity: z.coerce.number().optional(),
  comment: z.string().optional(),
  source: z.enum(['qr', 'portal']).default('portal'),
}).superRefine((data, ctx) => {
  // Humidity requirement is validated again server-side; asset context is checked in the UI layer.
  if (data.humidity != null && Number.isNaN(data.humidity)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Humidity must be a number', path: ['humidity'] });
  }
});

export type EnvironmentalReadingFormData = z.infer<typeof environmentalReadingFormSchema>;

export const environmentalCorrectionFormSchema = z.object({
  newTemperature: z.coerce.number(),
  newHumidity: z.coerce.number().optional(),
  correctionReason: z.string().trim().min(1, 'Correction reason is required'),
});

export type EnvironmentalCorrectionFormData = z.infer<typeof environmentalCorrectionFormSchema>;

export const environmentalAdminEditFormSchema = z.object({
  newTemperature: z.coerce.number(),
  newHumidity: z.coerce.number().optional(),
  adminChangeReason: z.string().trim().min(1, 'Reason for administrative change is required'),
});

export type EnvironmentalAdminEditFormData = z.infer<typeof environmentalAdminEditFormSchema>;

export const environmentalVoidFormSchema = z.object({
  voidReason: z.string().trim().min(1, 'Void reason is required'),
});

export type EnvironmentalVoidFormData = z.infer<typeof environmentalVoidFormSchema>;

export const environmentalAssetFormSchema = z.object({
  assetCode: z.string().trim().min(1),
  assetName: z.string().trim().min(1),
  assetType: z.enum(ENVIRONMENTAL_ASSET_TYPES as [string, ...string[]]),
  location: z.string().optional(),
  serialNumber: z.string().optional(),
  description: z.string().optional(),
  minTemperature: z.coerce.number(),
  maxTemperature: z.coerce.number(),
  humidityMin: z.coerce.number().optional(),
  humidityMax: z.coerce.number().optional(),
  humidityRequired: z.boolean().default(false),
  monitoringFrequency: z.string().default('daily'),
  active: z.boolean().default(true),
}).superRefine((data, ctx) => {
  if (data.minTemperature > data.maxTemperature) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Minimum temperature must be less than or equal to maximum', path: ['maxTemperature'] });
  }
});

export type EnvironmentalAssetFormData = z.infer<typeof environmentalAssetFormSchema>;

export const environmentalWindowFormSchema = z.object({
  windowName: z.string().trim().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  required: z.boolean().default(true),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  active: z.boolean().default(true),
});

export type EnvironmentalWindowFormData = z.infer<typeof environmentalWindowFormSchema>;

export const environmentalExcursionActionSchema = z.object({
  immediateAction: z.string().trim().min(1, 'Immediate action is required'),
  affectedMaterial: z.string().optional(),
  maintenanceTicketNumber: z.string().optional(),
  additionalComment: z.string().optional(),
});

export type EnvironmentalExcursionActionFormData = z.infer<typeof environmentalExcursionActionSchema>;

export const environmentalExcursionRecheckSchema = z.object({
  recheckTemperature: z.coerce.number(),
  recheckHumidity: z.coerce.number().optional(),
  recheckAt: z.string().min(1),
});

export type EnvironmentalExcursionRecheckFormData = z.infer<typeof environmentalExcursionRecheckSchema>;

export const environmentalExcursionResolutionSchema = z.object({
  resolutionStatus: z.string().trim().min(1, 'Resolution status is required'),
  resolutionComment: z.string().trim().min(1, 'Resolution comment is required'),
});

export type EnvironmentalExcursionResolutionFormData = z.infer<typeof environmentalExcursionResolutionSchema>;

export const environmentalExcursionReviewSchema = z.object({
  reviewDecision: z.enum(['accept', 'not_accept', 'need_follow_up']),
  reviewComment: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.reviewDecision !== 'accept' && !data.reviewComment?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Review comment is required for this decision', path: ['reviewComment'] });
  }
});

export type EnvironmentalExcursionReviewFormData = z.infer<typeof environmentalExcursionReviewSchema>;

export function emptyEnvironmentalReadingForm(assetId = ''): EnvironmentalReadingFormData {
  return { assetId, temperature: '' as unknown as number, source: 'portal' };
}

export function assetToForm(asset: EnvironmentalAsset): EnvironmentalAssetFormData {
  return {
    assetCode: asset.assetCode,
    assetName: asset.assetName,
    assetType: asset.assetType,
    location: asset.location ?? '',
    serialNumber: asset.serialNumber ?? '',
    description: asset.description ?? '',
    minTemperature: asset.minTemperature,
    maxTemperature: asset.maxTemperature,
    humidityMin: asset.humidityMin,
    humidityMax: asset.humidityMax,
    humidityRequired: asset.humidityRequired,
    monitoringFrequency: asset.monitoringFrequency,
    active: asset.active,
  };
}

export function windowToForm(window: EnvironmentalMonitoringWindow): EnvironmentalWindowFormData {
  return {
    windowName: window.windowName,
    startTime: window.startTime.slice(0, 5),
    endTime: window.endTime.slice(0, 5),
    required: window.required,
    daysOfWeek: window.daysOfWeek,
    active: window.active,
  };
}

export function previewReadingStatus(
  temperature: number,
  humidity: number | undefined,
  asset: Pick<EnvironmentalAsset, 'minTemperature' | 'maxTemperature' | 'humidityMin' | 'humidityMax' | 'humidityRequired'>,
): 'in_range' | 'out_of_range' {
  return computeOutOfRangeParameters(temperature, humidity, asset) ? 'out_of_range' : 'in_range';
}

export function previewOutOfRangeParameters(
  temperature: number,
  humidity: number | undefined,
  asset: Pick<EnvironmentalAsset, 'minTemperature' | 'maxTemperature' | 'humidityMin' | 'humidityMax' | 'humidityRequired'>,
): EnvironmentalOutOfRangeParameters | null {
  return computeOutOfRangeParameters(temperature, humidity, asset);
}

export function getLatestEffectiveReading(readings: EnvironmentalReading[]): EnvironmentalReading | undefined {
  return readings
    .filter((reading) => !reading.voidedAt)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
}
