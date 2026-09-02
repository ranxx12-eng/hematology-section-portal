import { createClient } from '@/lib/supabase/client';
import type { CriticalValueReviewData } from '@/lib/critical-values/review-schema';
import type { CriticalValueFormData } from '@/lib/critical-values/schema';
import {
  displayEscalationTo,
  escalationToDbValue,
  normalizeCriticalValueTests,
  parseReadBack,
} from '@/lib/critical-values/schema';
import type { CriticalValue } from '@/types';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface CriticalValueRow {
  id: string;
  record_date: string;
  patient_id: string;
  patient_name: string;
  patient_acc_number: string;
  test_name: string;
  test_names: string[] | null;
  critical_value: string;
  department: string;
  informed_to_dr: string;
  dr_id: string;
  verify_time: string;
  informed_time: string;
  comment: string | null;
  escalation_to: string | null;
  read_back: boolean;
  initial: string;
  reported_by: string;
  review_status: CriticalValue['reviewStatus'];
  review_comment: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapCriticalValue(row: CriticalValueRow): CriticalValue {
  const tests = normalizeCriticalValueTests(row);

  return {
    id: row.id,
    date: row.record_date,
    patientId: row.patient_id,
    patientName: row.patient_name,
    patientAccNumber: row.patient_acc_number,
    tests,
    criticalValue: row.critical_value,
    informedToDr: row.informed_to_dr,
    drId: row.dr_id,
    verifyTime: row.verify_time.slice(0, 5),
    informedTime: row.informed_time.slice(0, 5),
    department: row.department,
    escalationTo: displayEscalationTo(row.escalation_to),
    readBack: row.read_back,
    comment: row.comment ?? undefined,
    initial: row.initial,
    reportedBy: row.reported_by,
    reviewStatus: row.review_status ?? 'Pending Review',
    reviewComment: row.review_comment ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formToRow(form: CriticalValueFormData, userId: string) {
  return {
    record_date: form.date,
    patient_id: form.patientId,
    patient_name: form.patientName,
    patient_acc_number: form.patientAccNumber,
    test_names: form.tests,
    test_name: form.tests[0] ?? '',
    critical_value: form.criticalValue,
    department: form.department,
    informed_to_dr: form.informedToDr,
    dr_id: form.drId,
    verify_time: form.verifyTime,
    informed_time: form.informedTime,
    comment: form.comment || null,
    escalation_to: escalationToDbValue(form.escalationTo),
    read_back: parseReadBack(form.readBack),
    initial: form.initial,
    reported_by: userId,
  };
}

export async function fetchCriticalValues(): Promise<ClinicalListResult<CriticalValue>> {
  return runClinicalListQuery('Failed to load critical values', async () => {
    const supabase = createClient();
    return supabase
      .from('critical_values')
      .select('*')
      .is('deleted_at', null)
      .order('record_date', { ascending: false })
      .order('created_at', { ascending: false });
  }).then((result) => ({
    data: (result.data as unknown as CriticalValueRow[]).map(mapCriticalValue),
    error: result.error,
  }));
}

export async function createCriticalValue(
  userId: string,
  form: CriticalValueFormData,
): Promise<ClinicalResult<CriticalValue>> {
  return runClinicalMutation('Failed to create critical value', async () => {
    const supabase = createClient();
    return supabase
      .from('critical_values')
      .insert({
        ...formToRow(form, userId),
        created_by: userId,
        review_status: 'Pending Review',
      })
      .select('*')
      .single();
  }).then((result) => ({
    data: result.data ? mapCriticalValue(result.data as unknown as CriticalValueRow) : null,
    error: result.error,
  }));
}

export async function updateCriticalValue(
  id: string,
  userId: string,
  form: CriticalValueFormData,
): Promise<ClinicalResult<CriticalValue>> {
  return runClinicalMutation('Failed to update critical value', async () => {
    const supabase = createClient();
    return supabase
      .from('critical_values')
      .update(formToRow(form, userId))
      .eq('id', id)
      .is('deleted_at', null)
      .select('*')
      .single();
  }).then((result) => ({
    data: result.data ? mapCriticalValue(result.data as unknown as CriticalValueRow) : null,
    error: result.error,
  }));
}

export async function reviewCriticalValue(
  id: string,
  userId: string,
  review: CriticalValueReviewData,
): Promise<ClinicalResult<CriticalValue>> {
  return runClinicalMutation('Failed to review critical value', async () => {
    const supabase = createClient();
    return supabase
      .from('critical_values')
      .update({
        review_status: review.reviewStatus,
        review_comment: review.reviewComment?.trim() || null,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select('*')
      .single();
  }).then((result) => ({
    data: result.data ? mapCriticalValue(result.data as unknown as CriticalValueRow) : null,
    error: result.error,
  }));
}

export async function deleteCriticalValue(
  id: string,
  staff?: import('./staff-context').StaffContext,
  deleteReason?: string,
): Promise<{ error: string | null }> {
  if (staff) {
    const { softDeleteOperationalRecord } = await import('@/lib/records/soft-delete');
    return softDeleteOperationalRecord('critical_values', id, staff, deleteReason);
  }

  const result = await runClinicalMutation('Failed to delete critical value', async () => {
    const supabase = createClient();
    return supabase
      .from('critical_values')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .single();
  });
  return { error: result.error };
}
