import { createClient } from '@/lib/supabase/client';
import type { QCRecord } from '@/types';
import { runClinicalListQuery, type ClinicalListResult } from './result';

interface QCRecordRow {
  id: string;
  instrument_id: string;
  test_name: string;
  control_level: string;
  lot_number: string;
  expiry_date: string;
  recorded_at: string;
  result_value: number;
  mean_value: number;
  standard_deviation: number;
  cv_percent: number;
  range_min: number;
  range_max: number;
  status: QCRecord['status'];
  corrective_action: string | null;
  reviewed_by: string | null;
  created_at: string;
}

function mapQCRecord(row: QCRecordRow): QCRecord {
  return {
    id: row.id,
    instrumentId: row.instrument_id,
    test: row.test_name,
    controlLevel: row.control_level,
    lotNumber: row.lot_number,
    expiryDate: row.expiry_date,
    recordedAt: row.recorded_at,
    result: Number(row.result_value),
    mean: Number(row.mean_value),
    standardDeviation: Number(row.standard_deviation),
    cvPercent: Number(row.cv_percent),
    rangeMin: Number(row.range_min),
    rangeMax: Number(row.range_max),
    status: row.status,
    correctiveAction: row.corrective_action ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    createdAt: row.created_at,
  };
}

export async function fetchQCRecords(): Promise<ClinicalListResult<QCRecord>> {
  const result = await runClinicalListQuery('Failed to load QC records', async () => {
    const supabase = createClient();
    return supabase
      .from('qc_records')
      .select('*')
      .is('deleted_at', null)
      .order('recorded_at', { ascending: false });
  });

  return {
    data: (result.data as unknown as QCRecordRow[]).map(mapQCRecord),
    error: result.error,
  };
}

export async function fetchInstrumentNameMap(): Promise<Record<string, string>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('instruments')
      .select('id, name')
      .is('deleted_at', null);

    if (error || !data) return {};
    return Object.fromEntries(data.map((row) => [row.id, row.name]));
  } catch {
    return {};
  }
}
