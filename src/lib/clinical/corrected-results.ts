import { createClient } from '@/lib/supabase/client';
import type { CorrectedResultFormData, CorrectedResultUpdateFormData } from '@/lib/corrected-results/schema';
import type { CorrectedResult, CorrectedResultStatus } from '@/types';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface ProfileNameRow {
  full_name: string | null;
}

interface CorrectedResultRow {
  id: string;
  correction_date: string;
  patient_name: string | null;
  patient_id: string;
  lab_accession: string | null;
  test_name: string;
  original_result: string;
  corrected_result: string;
  reason: string;
  status: string | null;
  corrected_by: string;
  physician_notified: boolean;
  notified_to: string | null;
  notification_time: string | null;
  approved_by: string | null;
  notes: string | null;
  created_at: string;
  corrector?: ProfileNameRow | ProfileNameRow[] | null;
  approver?: ProfileNameRow | ProfileNameRow[] | null;
}

function profileName(value: ProfileNameRow | ProfileNameRow[] | null | undefined): string | undefined {
  if (!value) return undefined;
  const row = Array.isArray(value) ? value[0] : value;
  return row?.full_name?.trim() || undefined;
}

function mapStatus(value: string | null | undefined): CorrectedResultStatus {
  if (value === 'Completed' || value === 'Pending Review') return value;
  return 'Open';
}

function mapCorrectedResult(row: CorrectedResultRow): CorrectedResult {
  return {
    id: row.id,
    date: row.correction_date,
    patientName: row.patient_name?.trim() || undefined,
    patientId: row.patient_id ?? '',
    labAccession: row.lab_accession?.trim() || undefined,
    test: row.test_name ?? '',
    originalResult: row.original_result ?? '',
    correctedResult: row.corrected_result ?? '',
    reason: row.reason ?? '',
    status: mapStatus(row.status),
    correctedBy: row.corrected_by,
    correctedByName: profileName(row.corrector),
    physicianNotified: row.physician_notified ?? false,
    notifiedTo: row.notified_to?.trim() || undefined,
    notificationTime: row.notification_time ?? undefined,
    approvedBy: row.approved_by ?? undefined,
    approvedByName: profileName(row.approver),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

const CORRECTED_RESULT_SELECT = `
  *,
  corrector:profiles!corrected_results_corrected_by_fkey(full_name),
  approver:profiles!corrected_results_approved_by_fkey(full_name)
`;

function formToCreateRow(form: CorrectedResultFormData, userId: string) {
  return {
    correction_date: form.date,
    patient_name: form.patientName?.trim() || null,
    patient_id: form.patientId.trim(),
    lab_accession: form.labAccession?.trim() || null,
    test_name: form.test,
    original_result: form.originalResult,
    corrected_result: form.correctedResult,
    reason: form.reason.trim(),
    status: form.status,
    corrected_by: userId,
    physician_notified: form.physicianNotified,
    notified_to: form.physicianNotified ? form.notifiedTo?.trim() || null : null,
    notification_time: form.physicianNotified && form.notificationTime
      ? new Date(form.notificationTime).toISOString()
      : null,
    notes: form.notes?.trim() || null,
    created_by: userId,
  };
}

function formToUpdateRow(form: CorrectedResultUpdateFormData) {
  return {
    correction_date: form.date,
    patient_name: form.patientName?.trim() || null,
    patient_id: form.patientId.trim(),
    lab_accession: form.labAccession?.trim() || null,
    test_name: form.test,
    corrected_result: form.correctedResult,
    reason: form.reason.trim(),
    status: form.status,
    physician_notified: form.physicianNotified,
    notified_to: form.physicianNotified ? form.notifiedTo?.trim() || null : null,
    notification_time: form.physicianNotified && form.notificationTime
      ? new Date(form.notificationTime).toISOString()
      : null,
    notes: form.notes?.trim() || null,
  };
}

async function queryCorrectedResults() {
  const supabase = createClient();
  const joined = await supabase
    .from('corrected_results')
    .select(CORRECTED_RESULT_SELECT)
    .is('deleted_at', null)
    .order('correction_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (!joined.error) return joined;

  return supabase
    .from('corrected_results')
    .select('*')
    .is('deleted_at', null)
    .order('correction_date', { ascending: false })
    .order('created_at', { ascending: false });
}

async function queryCorrectedResultById(id: string) {
  const supabase = createClient();
  const joined = await supabase
    .from('corrected_results')
    .select(CORRECTED_RESULT_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!joined.error) return joined;

  return supabase
    .from('corrected_results')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
}

export async function fetchCorrectedResults(): Promise<ClinicalListResult<CorrectedResult>> {
  const result = await runClinicalListQuery('Failed to load corrected results', queryCorrectedResults);

  return {
    data: (result.data as unknown as CorrectedResultRow[]).map(mapCorrectedResult),
    error: result.error,
  };
}

export async function createCorrectedResult(
  userId: string,
  form: CorrectedResultFormData,
): Promise<ClinicalResult<CorrectedResult>> {
  return runClinicalMutation('Failed to create corrected result', async () => {
    const supabase = createClient();
    const inserted = await supabase
      .from('corrected_results')
      .insert(formToCreateRow(form, userId))
      .select('id')
      .single();

    if (inserted.error || !inserted.data?.id) return inserted;

    return queryCorrectedResultById(inserted.data.id);
  }).then((result) => ({
    data: result.data ? mapCorrectedResult(result.data as unknown as CorrectedResultRow) : null,
    error: result.error,
  }));
}

export async function updateCorrectedResult(
  id: string,
  form: CorrectedResultUpdateFormData,
): Promise<ClinicalResult<CorrectedResult>> {
  return runClinicalMutation('Failed to update corrected result', async () => {
    const supabase = createClient();
    const updated = await supabase
      .from('corrected_results')
      .update(formToUpdateRow(form))
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .single();

    if (updated.error || !updated.data?.id) return updated;

    return queryCorrectedResultById(updated.data.id);
  }).then((result) => ({
    data: result.data ? mapCorrectedResult(result.data as unknown as CorrectedResultRow) : null,
    error: result.error,
  }));
}
