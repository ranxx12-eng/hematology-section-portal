import { z } from 'zod';
import {
  CALIBRATION_PERFORMER_TYPES,
  EQUIPMENT_CATEGORY_VALUES,
  EQUIPMENT_MAINTENANCE_RESULTS,
  INSTRUMENT_ITEM_TYPES,
  OPERATIONAL_STATUS_VALUES,
  PPM_FREQUENCY_VALUES,
} from './constants';

export const ppmRecordFormSchema = z.object({
  instrumentEquipmentId: z.string().uuid(),
  performedDate: z.string().min(1, 'Performed date is required'),
  nextDueDate: z.string().optional(),
  serviceProvider: z.string().optional(),
  engineerName: z.string().optional(),
  workOrderNumber: z.string().optional(),
  ticketNumber: z.string().optional(),
  result: z.enum(EQUIPMENT_MAINTENANCE_RESULTS),
  comment: z.string().optional(),
});

export const calibrationRecordFormSchema = z.object({
  instrumentEquipmentId: z.string().uuid(),
  performedDate: z.string().min(1, 'Calibration date is required'),
  nextDueDate: z.string().optional(),
  performedByType: z.enum(CALIBRATION_PERFORMER_TYPES),
  certificateNumber: z.string().optional(),
  serviceProvider: z.string().optional(),
  engineerName: z.string().optional(),
  workOrderNumber: z.string().optional(),
  ticketNumber: z.string().optional(),
  result: z.enum(EQUIPMENT_MAINTENANCE_RESULTS),
  comment: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.performedByType === 'external_engineer') {
    if (!data.engineerName?.trim() && !data.serviceProvider?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Engineer name or service provider is required for external calibration',
        path: ['engineerName'],
      });
    }
  }
});

export const ppmReviewFormSchema = z.object({
  reviewComment: z.string().optional(),
});

export type PpmRecordFormData = z.infer<typeof ppmRecordFormSchema>;
export type CalibrationRecordFormData = z.infer<typeof calibrationRecordFormSchema>;
export type PpmReviewFormData = z.infer<typeof ppmReviewFormSchema>;

export const extendedInstrumentFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  itemType: z.enum(INSTRUMENT_ITEM_TYPES),
  assetCode: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  location: z.string().optional(),
  section: z.string().optional(),
  operationalStatus: z.enum(OPERATIONAL_STATUS_VALUES).default('active'),
  installationDate: z.string().optional(),
  serviceProvider: z.string().optional(),
  ppmFrequency: z.preprocess((val) => (val === '' ? undefined : val), z.enum(PPM_FREQUENCY_VALUES).optional()),
  calibrationFrequency: z.preprocess((val) => (val === '' ? undefined : val), z.enum(PPM_FREQUENCY_VALUES).optional()),
  equipmentCategory: z.preprocess((val) => (val === '' ? undefined : val), z.enum(EQUIPMENT_CATEGORY_VALUES).optional()),
  technicalSpecification: z.string().optional(),
  notes: z.string().optional(),
});

export type ExtendedInstrumentFormData = z.infer<typeof extendedInstrumentFormSchema>;

export function emptyExtendedInstrumentForm(): ExtendedInstrumentFormData {
  return {
    name: '',
    itemType: 'instrument',
    assetCode: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    location: '',
    section: '',
    operationalStatus: 'active',
    installationDate: '',
    serviceProvider: '',
    ppmFrequency: undefined,
    calibrationFrequency: undefined,
    equipmentCategory: undefined,
    technicalSpecification: '',
    notes: '',
  };
}

export function mapOperationalStatusToInstrumentFields(
  operationalStatus: ExtendedInstrumentFormData['operationalStatus'],
): { active: boolean; status: 'operational' | 'out_of_service' | 'decommissioned' } {
  switch (operationalStatus) {
    case 'inactive':
      return { active: false, status: 'operational' };
    case 'out_of_service':
      return { active: false, status: 'out_of_service' };
    default:
      return { active: true, status: 'operational' };
  }
}

export function mapInstrumentToOperationalStatus(instrument: {
  active?: boolean;
  status: string;
}): ExtendedInstrumentFormData['operationalStatus'] {
  if (instrument.status === 'out_of_service' || instrument.status === 'decommissioned') return 'out_of_service';
  if (instrument.active === false) return 'inactive';
  return 'active';
}
