import { z } from 'zod';
import { EQUIPMENT_MAINTENANCE_RESULTS, INSTRUMENT_ITEM_TYPES } from './constants';

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
  certificateNumber: z.string().optional(),
  serviceProvider: z.string().optional(),
  engineerName: z.string().optional(),
  result: z.enum(EQUIPMENT_MAINTENANCE_RESULTS),
  comment: z.string().optional(),
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
  status: z.enum(['operational', 'warning', 'under_maintenance', 'out_of_service', 'decommissioned']),
  installationDate: z.string().optional(),
  serviceProvider: z.string().optional(),
  ppmFrequency: z.string().optional(),
  calibrationFrequency: z.string().optional(),
  active: z.boolean().default(true),
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
    status: 'operational',
    installationDate: new Date().toISOString().slice(0, 10),
    serviceProvider: '',
    ppmFrequency: '',
    calibrationFrequency: '',
    active: true,
    notes: '',
  };
}
