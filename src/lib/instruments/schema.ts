import { z } from 'zod';
import type { Instrument } from '@/types';

export const INSTRUMENT_STATUSES = [
  'operational',
  'warning',
  'under_maintenance',
  'out_of_service',
  'decommissioned',
] as const;

export const instrumentFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  manufacturer: z.string().min(1, 'Manufacturer is required'),
  model: z.string().min(1, 'Model is required'),
  serialNumber: z.string().min(1, 'Serial number is required'),
  location: z.string().min(1, 'Location is required'),
  status: z.enum(INSTRUMENT_STATUSES),
  installationDate: z.string().min(1, 'Installation date is required'),
});

export type InstrumentFormData = z.infer<typeof instrumentFormSchema>;

export function emptyInstrumentForm(): InstrumentFormData {
  return {
    name: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    location: '',
    status: 'operational',
    installationDate: new Date().toISOString().slice(0, 10),
  };
}

export function instrumentToForm(instrument: Instrument): InstrumentFormData {
  return {
    name: instrument.name,
    manufacturer: instrument.manufacturer,
    model: instrument.model,
    serialNumber: instrument.serialNumber,
    location: instrument.location,
    status: instrument.status,
    installationDate: instrument.installationDate.slice(0, 10),
  };
}
