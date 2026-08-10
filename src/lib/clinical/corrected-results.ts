import { createClient } from '@/lib/supabase/client';
import type { CorrectedResult } from '@/types';
import { runClinicalListQuery, type ClinicalListResult } from './result';

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
