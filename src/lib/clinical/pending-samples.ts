import { createClient } from '@/lib/supabase/client';
import type { PendingSampleFormData } from '@/lib/pending-samples/schema';
import { calculateElapsedMinutes } from '@/lib/pending-samples/schema';
import { syncRejectionWorkflowState } from '@/lib/clinical/sample-rejections';
import type { PendingSample } from '@/types';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface PendingSampleRow {
  id: string;
  source_type: PendingSample['sourceType'];
  sample_rejection_id: string | null;
  patient_id: string;
  patient_name: string | null;
  patient_lab_accession: string | null;
  department_name: string | null;
  rejected_tests: string[] | null;
  rejected_tube: string | null;
  rejection_reasons: string[] | null;
  rejection_date: string | null;
  rejection_time: string | null;
  test_name: string;
  priority: PendingSample['priority'];
  received_time: string;
  elapsed_minutes: number;
  instrument_id: string | null;
  assigned_staff_id: string | null;
  assigned_staff_name: string | null;
  replacement_sample_status: PendingSample['replacementSampleStatus'];
  is_active: boolean;
  current_status: string;
  delay_reason: string | null;
  created_at: string;
  updated_at: string;
}

function mapPendingSample(row: PendingSampleRow): PendingSample {
  return {
    id: row.id,
    sourceType: row.source_type,
    sampleRejectionId: row.sample_rejection_id ?? undefined,
    patientId: row.patient_id,
    patientName: row.patient_name ?? undefined,
    patientLabAccNumber: row.patient_lab_accession ?? undefined,
    department: row.department_name ?? undefined,
    rejectedTests: row.rejected_tests ?? undefined,
    rejectedTube: row.rejected_tube ?? undefined,
    rejectionReasons: row.rejection_reasons ?? undefined,
    rejectionDate: row.rejection_date ?? undefined,
    rejectionTime: row.rejection_time?.slice(0, 5),
    test: row.test_name,
    priority: row.priority,
    receivedTime: row.received_time,
    elapsedMinutes: row.elapsed_minutes,
    instrumentId: row.instrument_id ?? undefined,
    assignedStaffId: row.assigned_staff_id ?? undefined,
    assignedStaffName: row.assigned_staff_name ?? undefined,
    currentStatus: row.current_status,
    replacementSampleStatus: row.replacement_sample_status ?? undefined,
    isActive: row.is_active,
    delayReason: row.delay_reason ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formToRow(form: PendingSampleFormData, userId?: string) {
  const receivedIso = new Date(form.receivedTime).toISOString();
  return {
    source_type: form.sourceType,
    patient_id: form.patientId,
    patient_name: form.patientName?.trim() || null,
    patient_lab_accession: form.patientLabAccNumber?.trim() || null,
    department_name: form.department?.trim() || null,
    test_name: form.test,
    priority: form.priority,
    received_time: receivedIso,
    elapsed_minutes: calculateElapsedMinutes(receivedIso),
    assigned_staff_name: form.assignedStaffName?.trim() || null,
    current_status: form.currentStatus,
    is_active: form.isActive,
    delay_reason: form.delayReason?.trim() || null,
    ...(userId ? { created_by: userId } : {}),
  };
}

export async function fetchPendingSamples(): Promise<ClinicalListResult<PendingSample>> {
  await syncRejectionWorkflowState();

  const result = await runClinicalListQuery('Failed to load pending samples', async () => {
    const supabase = createClient();
    return supabase
      .from('pending_samples')
      .select('*')
      .is('deleted_at', null)
      .order('received_time', { ascending: false });
  });

  return {
    data: (result.data as unknown as PendingSampleRow[]).map(mapPendingSample),
    error: result.error,
  };
}

export async function createPendingSample(
  userId: string,
  form: PendingSampleFormData,
): Promise<ClinicalResult<PendingSample>> {
  return runClinicalMutation('Failed to create pending sample', async () => {
    const supabase = createClient();
    return supabase
      .from('pending_samples')
      .insert(formToRow(form, userId))
      .select('*')
      .single();
  }).then((result) => ({
    data: result.data ? mapPendingSample(result.data as unknown as PendingSampleRow) : null,
    error: result.error,
  }));
}

export async function updatePendingSample(
  id: string,
  form: PendingSampleFormData,
): Promise<ClinicalResult<PendingSample>> {
  return runClinicalMutation('Failed to update pending sample', async () => {
    const supabase = createClient();
    return supabase
      .from('pending_samples')
      .update(formToRow(form))
      .eq('id', id)
      .is('deleted_at', null)
      .select('*')
      .single();
  }).then((result) => ({
    data: result.data ? mapPendingSample(result.data as unknown as PendingSampleRow) : null,
    error: result.error,
  }));
}
