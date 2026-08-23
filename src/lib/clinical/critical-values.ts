import { createClient } from '@/lib/supabase/client';
import type { CriticalValueFormData } from '@/lib/critical-values/schema';
import { displayEscalationTo, escalationToDbValue } from '@/lib/critical-values/schema';
import type { CriticalValue } from '@/types';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface CriticalValueRow {
  id: string;
  record_date: string;
  patient_id: string;
  patient_name: string;
  patient_acc_number: string;
  test_name: string;
  critical_value: string;
  department: string;
  informed_to_dr: string;
  dr_id: string;
  verify_time: string;
  informed_time: string;
  comment: string | null;
  escalation_to: string | null;
  initial: string;
  reported_by: string;
  created_at: string;
  updated_at: string;
}

function mapCriticalValue(row: CriticalValueRow): CriticalValue {
  return {
    id: row.id,
    date: row.record_date,
    patientId: row.patient_id,
    patientName: row.patient_name,
    patientAccNumber: row.patient_acc_number,
    test: row.test_name,
    criticalValue: row.critical_value,
    informedToDr: row.informed_to_dr,
    drId: row.dr_id,
    verifyTime: row.verify_time.slice(0, 5),
    informedTime: row.informed_time.slice(0, 5),
    department: row.department,
    escalationTo: displayEscalationTo(row.escalation_to),
    comment: row.comment ?? undefined,
    initial: row.initial,
    reportedBy: row.reported_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formToRow(form: CriticalValueFormData, userId: string) {
  const { sampleTube: _sampleTube, ...persisted } = form;
  return {
    record_date: persisted.date,
    patient_id: persisted.patientId,
    patient_name: persisted.patientName,
    patient_acc_number: persisted.patientAccNumber,
    test_name: persisted.test,
    critical_value: persisted.criticalValue,
    department: persisted.department,
    informed_to_dr: persisted.informedToDr,
    dr_id: persisted.drId,
    verify_time: persisted.verifyTime,
    informed_time: persisted.informedTime,
    comment: persisted.comment || null,
    escalation_to: escalationToDbValue(persisted.escalationTo),
    initial: persisted.initial,
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
      .insert({ ...formToRow(form, userId), created_by: userId })
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

export async function deleteCriticalValue(id: string): Promise<{ error: string | null }> {
  const result = await runClinicalMutation('Failed to delete critical value', async () => {
    const supabase = createClient();
    return supabase
      .from('critical_values')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .single();
  });
  return { error: result.error };
}
