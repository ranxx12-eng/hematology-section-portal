import { createClient } from '@/lib/supabase/client';
import type { InstrumentFormData } from '@/lib/instruments/schema';
import type { Instrument } from '@/types';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface InstrumentRow {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  location: string;
  installation_date: string;
  status: Instrument['status'];
  last_maintenance: string | null;
  next_maintenance: string | null;
  calibration_due_date: string | null;
  warranty_expiry: string | null;
  service_provider: string | null;
  contact_info: string | null;
  created_at: string;
  updated_at: string;
}

function mapInstrument(row: InstrumentRow): Instrument {
  return {
    id: row.id,
    name: row.name,
    manufacturer: row.manufacturer,
    model: row.model,
    serialNumber: row.serial_number,
    location: row.location,
    installationDate: row.installation_date,
    status: row.status,
    lastMaintenance: row.last_maintenance ?? undefined,
    nextMaintenance: row.next_maintenance ?? undefined,
    calibrationDueDate: row.calibration_due_date ?? undefined,
    warrantyExpiry: row.warranty_expiry ?? undefined,
    serviceProvider: row.service_provider ?? undefined,
    contactInfo: row.contact_info ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formToInsertRow(form: InstrumentFormData, userId: string) {
  return {
    name: form.name.trim(),
    manufacturer: form.manufacturer.trim(),
    model: form.model.trim(),
    serial_number: form.serialNumber.trim(),
    location: form.location.trim(),
    installation_date: form.installationDate,
    status: form.status,
    created_by: userId,
  };
}

function formToUpdateRow(form: InstrumentFormData) {
  return {
    name: form.name.trim(),
    manufacturer: form.manufacturer.trim(),
    model: form.model.trim(),
    serial_number: form.serialNumber.trim(),
    location: form.location.trim(),
    installation_date: form.installationDate,
    status: form.status,
  };
}

const INSTRUMENT_SELECT = '*';

export async function fetchInstruments(): Promise<ClinicalListResult<Instrument>> {
  return runClinicalListQuery('Failed to load instruments', async () => {
    const supabase = createClient();
    return supabase
      .from('instruments')
      .select(INSTRUMENT_SELECT)
      .is('deleted_at', null)
      .order('name');
  }).then((result) => ({
    data: (result.data as unknown as InstrumentRow[]).map(mapInstrument),
    error: result.error,
  }));
}

export async function fetchInstrumentById(id: string): Promise<ClinicalResult<Instrument>> {
  return runClinicalMutation('Failed to load instrument', async () => {
    const supabase = createClient();
    return supabase
      .from('instruments')
      .select(INSTRUMENT_SELECT)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
  }).then((result) => ({
    data: result.data ? mapInstrument(result.data as unknown as InstrumentRow) : null,
    error: result.error,
  }));
}

export async function createInstrument(
  userId: string,
  form: InstrumentFormData,
): Promise<ClinicalResult<Instrument>> {
  return runClinicalMutation('Failed to create instrument', async () => {
    const supabase = createClient();
    return supabase
      .from('instruments')
      .insert(formToInsertRow(form, userId))
      .select(INSTRUMENT_SELECT)
      .single();
  }).then((result) => ({
    data: result.data ? mapInstrument(result.data as unknown as InstrumentRow) : null,
    error: result.error,
  }));
}

export async function updateInstrument(
  id: string,
  form: InstrumentFormData,
): Promise<ClinicalResult<Instrument>> {
  return runClinicalMutation('Failed to update instrument', async () => {
    const supabase = createClient();
    return supabase
      .from('instruments')
      .update(formToUpdateRow(form))
      .eq('id', id)
      .is('deleted_at', null)
      .select(INSTRUMENT_SELECT)
      .single();
  }).then((result) => ({
    data: result.data ? mapInstrument(result.data as unknown as InstrumentRow) : null,
    error: result.error,
  }));
}

export async function softDeleteInstrument(id: string): Promise<{ error: string | null }> {
  const result = await runClinicalMutation('Failed to delete instrument', async () => {
    const supabase = createClient();
    return supabase
      .from('instruments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .single();
  });
  return { error: result.error };
}
