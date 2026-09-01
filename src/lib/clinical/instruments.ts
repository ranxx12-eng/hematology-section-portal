import { createClient } from '@/lib/supabase/client';
import type { ExtendedInstrumentFormData } from '@/lib/ppm-calibration/schema';
import { mapOperationalStatusToInstrumentFields } from '@/lib/ppm-calibration/schema';
import { normalizeMaintenanceFrequency } from '@/lib/ppm-calibration/constants';
import type { InstrumentFormData } from '@/lib/instruments/schema';
import type { Instrument } from '@/types';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface InstrumentRow {
  id: string;
  name: string;
  item_type: Instrument['itemType'];
  asset_code: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  location: string | null;
  section: string | null;
  installation_date: string | null;
  status: Instrument['status'];
  last_maintenance: string | null;
  next_maintenance: string | null;
  calibration_due_date: string | null;
  warranty_expiry: string | null;
  service_provider: string | null;
  contact_info: string | null;
  ppm_frequency: string | null;
  calibration_frequency: string | null;
  equipment_category: string | null;
  technical_specification: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapInstrument(row: InstrumentRow): Instrument {
  return {
    id: row.id,
    name: row.name,
    itemType: row.item_type ?? 'instrument',
    assetCode: row.asset_code ?? undefined,
    manufacturer: row.manufacturer ?? '',
    model: row.model ?? '',
    serialNumber: row.serial_number ?? '',
    location: row.location ?? '',
    section: row.section ?? undefined,
    installationDate: row.installation_date ?? '',
    status: row.status,
    lastMaintenance: row.last_maintenance ?? undefined,
    nextMaintenance: row.next_maintenance ?? undefined,
    calibrationDueDate: row.calibration_due_date ?? undefined,
    warrantyExpiry: row.warranty_expiry ?? undefined,
    serviceProvider: row.service_provider ?? undefined,
    contactInfo: row.contact_info ?? undefined,
    ppmFrequency: row.ppm_frequency ?? undefined,
    calibrationFrequency: row.calibration_frequency ?? undefined,
    equipmentCategory: (row.equipment_category as Instrument['equipmentCategory']) ?? undefined,
    technicalSpecification: row.technical_specification ?? undefined,
    active: row.active,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formToInsertRow(form: InstrumentFormData | ExtendedInstrumentFormData, userId: string) {
  const extended = form as ExtendedInstrumentFormData;
  const operational = extended.operationalStatus
    ? mapOperationalStatusToInstrumentFields(extended.operationalStatus)
    : {
        active: true,
        status: ('status' in form ? form.status : 'operational') as Instrument['status'],
      };

  return {
    name: form.name.trim(),
    item_type: extended.itemType ?? 'instrument',
    asset_code: extended.assetCode?.trim() || null,
    manufacturer: form.manufacturer?.trim() || null,
    model: form.model?.trim() || null,
    serial_number: form.serialNumber?.trim() || null,
    location: form.location?.trim() || null,
    section: extended.section?.trim() || null,
    installation_date: form.installationDate || null,
    status: operational.status,
    service_provider: extended.serviceProvider?.trim() || null,
    ppm_frequency: normalizeMaintenanceFrequency(extended.ppmFrequency) ?? null,
    calibration_frequency: normalizeMaintenanceFrequency(extended.calibrationFrequency) ?? null,
    equipment_category: extended.equipmentCategory?.trim() || null,
    technical_specification: extended.technicalSpecification?.trim() || null,
    active: operational.active,
    notes: extended.notes?.trim() || null,
    created_by: userId,
    updated_by: userId,
  };
}

function formToUpdateRow(form: InstrumentFormData | ExtendedInstrumentFormData, userId?: string) {
  const base = formToInsertRow(form, userId ?? '');
  const { created_by: _createdBy, ...rest } = base;
  return { ...rest, updated_by: userId ?? null };
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
  form: InstrumentFormData | ExtendedInstrumentFormData,
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
  form: InstrumentFormData | ExtendedInstrumentFormData,
  userId?: string,
): Promise<ClinicalResult<Instrument>> {
  return runClinicalMutation('Failed to update instrument', async () => {
    const supabase = createClient();
    return supabase
      .from('instruments')
      .update(formToUpdateRow(form, userId))
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
