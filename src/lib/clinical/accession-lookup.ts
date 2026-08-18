import { createClient } from '@/lib/supabase/client';

export interface AccessionLookupResult {
  patientId: string;
  patientName: string;
  accession: string;
}

/**
 * Looks up patient details from prior authenticated clinical records (RLS-protected).
 * No external LIS integration — searches critical_values, sample_rejections, pending_samples.
 */
export async function lookupPatientByAccession(
  accession: string,
): Promise<{ data: AccessionLookupResult | null; error: string | null }> {
  const trimmed = accession.trim();
  if (!trimmed) {
    return { data: null, error: null };
  }

  const supabase = createClient();

  const [criticalResult, rejectionResult, pendingResult] = await Promise.all([
    supabase
      .from('critical_values')
      .select('patient_id, patient_name, patient_acc_number')
      .eq('patient_acc_number', trimmed)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('sample_rejections')
      .select('patient_id, patient_name, patient_lab_accession')
      .eq('patient_lab_accession', trimmed)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('pending_samples')
      .select('patient_id, patient_name, patient_lab_accession')
      .eq('patient_lab_accession', trimmed)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const errors = [criticalResult.error, rejectionResult.error, pendingResult.error].filter(Boolean);
  if (errors.length > 0) {
    return { data: null, error: errors[0]?.message ?? 'Accession lookup failed' };
  }

  const match =
    criticalResult.data ??
    rejectionResult.data ??
    pendingResult.data;

  if (!match || !match.patient_id || !match.patient_name) {
    return { data: null, error: null };
  }

  const accessionValue =
    'patient_acc_number' in match
      ? match.patient_acc_number
      : match.patient_lab_accession ?? trimmed;

  return {
    data: {
      patientId: match.patient_id,
      patientName: match.patient_name,
      accession: accessionValue ?? trimmed,
    },
    error: null,
  };
}
