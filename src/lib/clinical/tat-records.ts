import { createClient } from '@/lib/supabase/client';
import type { TATRecord } from '@/types';
import { runClinicalListQuery, type ClinicalListResult } from './result';

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
