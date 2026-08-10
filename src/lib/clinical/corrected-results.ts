import { createClient } from '@/lib/supabase/client';
import type { CorrectedResultFormData, CorrectedResultUpdateFormData } from '@/lib/corrected-results/schema';
import type { CorrectedResult } from '@/types';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface CorrectedResultRow {
  id: string;
  correction_date: string;
  patient_id: string;
  test_name: string;
  original_result: string;
  corrected_result: string;
  reason: string;
  corrected_by: string;
  physician_notified: boolean;
  notification_time: string | null;
  approved_by: string | null;
  notes: string | null;
  created_at: string;
}

function mapCorrectedResult(row: CorrectedResultRow): CorrectedResult {
  return {
    id: row.id,
    date: row.correction_date,
    patientId: row.patient_id,
    test: row.test_name,
    originalResult: row.original_result,
    correctedResult: row.corrected_result,
    reason: row.reason,
    correctedBy: row.corrected_by,
    physicianNotified: row.physician_notified,
    notificationTime: row.notification_time ?? undefined,
    approvedBy: row.approved_by ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

function formToCreateRow(form: CorrectedResultFormData, userId: string) {
  return {
    correction_date: form.date,
    patient_id: form.patientId,
    test_name: form.test,
    original_result: form.originalResult,
    corrected_result: form.correctedResult,
    reason: form.reason,
    corrected_by: userId,
    physician_notified: form.physicianNotified,
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
    patient_id: form.patientId,
    test_name: form.test,
    corrected_result: form.correctedResult,
    reason: form.reason,
    physician_notified: form.physicianNotified,
    notification_time: form.physicianNotified && form.notificationTime
      ? new Date(form.notificationTime).toISOString()
      : null,
    notes: form.notes?.trim() || null,
  };
}

export async function fetchCorrectedResults(): Promise<ClinicalListResult<CorrectedResult>> {
  const result = await runClinicalListQuery('Failed to load corrected results', async () => {
    const supabase = createClient();
    return supabase
      .from('corrected_results')
      .select('*')
      .is('deleted_at', null)
      .order('correction_date', { ascending: false })
      .order('created_at', { ascending: false });
  });

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
    return supabase
      .from('corrected_results')
      .insert(formToCreateRow(form, userId))
      .select('*')
      .single();
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
    return supabase
      .from('corrected_results')
      .update(formToUpdateRow(form))
      .eq('id', id)
      .is('deleted_at', null)
      .select('*')
      .single();
  }).then((result) => ({
    data: result.data ? mapCorrectedResult(result.data as unknown as CorrectedResultRow) : null,
    error: result.error,
  }));
}
