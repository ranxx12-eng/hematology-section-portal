import { createClient } from '@/lib/supabase/client';
import { deriveTATFields, type TATRecordFormData } from '@/lib/tat-records/schema';
import type { TATRecord } from '@/types';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface TATRecordRow {
  id: string;
  sample_received_time: string;
  result_released_time: string;
  calculated_tat_minutes: number;
  target_tat_minutes: number;
  test_type: string;
  priority: TATRecord['priority'];
  department: string;
  shift: string;
  instrument_id: string | null;
  status: TATRecord['status'];
  delay_reason: string | null;
  created_at: string;
}

function mapTATRecord(row: TATRecordRow): TATRecord {
  return {
    id: row.id,
    sampleReceivedTime: row.sample_received_time,
    resultReleasedTime: row.result_released_time,
    calculatedTat: row.calculated_tat_minutes,
    targetTat: row.target_tat_minutes,
    testType: row.test_type,
    priority: row.priority,
    department: row.department,
    shift: row.shift,
    instrumentId: row.instrument_id ?? undefined,
    status: row.status,
    delayReason: row.delay_reason ?? undefined,
    createdAt: row.created_at,
  };
}

function formToRow(form: TATRecordFormData, userId?: string) {
  const { calculatedTatMinutes, status } = deriveTATFields(form);
  return {
    sample_received_time: new Date(form.sampleReceivedTime).toISOString(),
    result_released_time: new Date(form.resultReleasedTime).toISOString(),
    calculated_tat_minutes: calculatedTatMinutes,
    target_tat_minutes: form.targetTatMinutes,
    test_type: form.testType,
    priority: form.priority,
    department: form.department,
    shift: form.shift,
    instrument_id: form.instrumentId?.trim() || null,
    status,
    delay_reason: form.delayReason?.trim() || null,
    ...(userId ? { created_by: userId } : {}),
  };
}

export async function fetchTATRecords(): Promise<ClinicalListResult<TATRecord>> {
  const result = await runClinicalListQuery('Failed to load TAT records', async () => {
    const supabase = createClient();
    return supabase
      .from('tat_records')
      .select('*')
      .is('deleted_at', null)
      .order('sample_received_time', { ascending: false });
  });

  return {
    data: (result.data as unknown as TATRecordRow[]).map(mapTATRecord),
    error: result.error,
  };
}

export async function createTATRecord(
  userId: string,
  form: TATRecordFormData,
): Promise<ClinicalResult<TATRecord>> {
  return runClinicalMutation('Failed to create TAT record', async () => {
    const supabase = createClient();
    return supabase
      .from('tat_records')
      .insert(formToRow(form, userId))
      .select('*')
      .single();
  }).then((result) => ({
    data: result.data ? mapTATRecord(result.data as unknown as TATRecordRow) : null,
    error: result.error,
  }));
}

export async function updateTATRecord(
  id: string,
  form: TATRecordFormData,
): Promise<ClinicalResult<TATRecord>> {
  return runClinicalMutation('Failed to update TAT record', async () => {
    const supabase = createClient();
    return supabase
      .from('tat_records')
      .update(formToRow(form))
      .eq('id', id)
      .is('deleted_at', null)
      .select('*')
      .single();
  }).then((result) => ({
    data: result.data ? mapTATRecord(result.data as unknown as TATRecordRow) : null,
    error: result.error,
  }));
}
