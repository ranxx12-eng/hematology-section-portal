import { createClient } from '@/lib/supabase/client';
import { fetchInstrumentById } from '@/lib/clinical/instruments';
import {
  calculateOverallResult,
  calculatePltSampleResult,
  canSubmitCentrifugePppCalibration,
  CENTRIFUGE_PPP_SAMPLE_COUNT,
} from '@/lib/ppm-calibration/centrifuge-ppp-logic';
import type {
  CentrifugePppApprovalFormData,
  CentrifugePppDraftFormData,
  CentrifugePppReviewFormData,
} from '@/lib/ppm-calibration/centrifuge-ppp-schema';
import { PPM_CALIBRATION_BUCKET, PPM_CALIBRATION_STORAGE_PREFIX } from '@/lib/ppm-calibration/constants';
import type {
  CentrifugePppCalibration,
  CentrifugePppCalibrationListItem,
  CentrifugePppCalibrationSample,
} from '@/types/centrifuge-ppp-calibration';
import type { StaffContext } from './staff-context';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

const EVIDENCE_PREFIX = `${PPM_CALIBRATION_STORAGE_PREFIX}/centrifuge-ppp`;

interface CalibrationRow {
  id: string;
  instrument_equipment_id: string;
  calibration_date: string;
  next_due_date: string | null;
  performed_by_type: CentrifugePppCalibration['performedByType'];
  performed_by_user_id: string;
  performed_by_name: string;
  performed_by_staff_id: string | null;
  overall_result: CentrifugePppCalibration['overallResult'] | null;
  status: CentrifugePppCalibration['status'];
  problem: string | null;
  corrective_action: string | null;
  comment: string | null;
  review_status: string;
  review_decision: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_by_staff_id: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  approval_status: string;
  approval_decision: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_by_staff_id: string | null;
  approved_at: string | null;
  approval_comment: string | null;
  final_pdf_path: string | null;
  final_pdf_name: string | null;
  created_at: string;
  updated_at: string;
}

interface SampleRow {
  id: string;
  calibration_id: string;
  sample_number: number;
  plt_result: number | null;
  centrifuge_speed_rpm: number | null;
  centrifuge_time_minutes: number | null;
  calculated_result: CentrifugePppCalibrationSample['calculatedResult'] | null;
  evidence_path: string | null;
  evidence_name: string | null;
  evidence_uploaded_by: string | null;
  evidence_uploaded_by_name: string | null;
  evidence_uploaded_by_staff_id: string | null;
  evidence_uploaded_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapSample(row: SampleRow): CentrifugePppCalibrationSample {
  return {
    id: row.id,
    calibrationId: row.calibration_id,
    sampleNumber: row.sample_number,
    pltResult: row.plt_result ?? undefined,
    centrifugeSpeedRpm: row.centrifuge_speed_rpm ?? undefined,
    centrifugeTimeMinutes: row.centrifuge_time_minutes ?? undefined,
    calculatedResult: row.calculated_result ?? undefined,
    evidencePath: row.evidence_path ?? undefined,
    evidenceName: row.evidence_name ?? undefined,
    evidenceUploadedBy: row.evidence_uploaded_by ?? undefined,
    evidenceUploadedByName: row.evidence_uploaded_by_name ?? undefined,
    evidenceUploadedByStaffId: row.evidence_uploaded_by_staff_id ?? undefined,
    evidenceUploadedAt: row.evidence_uploaded_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCalibration(row: CalibrationRow, samples: CentrifugePppCalibrationSample[]): CentrifugePppCalibration {
  return {
    id: row.id,
    instrumentEquipmentId: row.instrument_equipment_id,
    calibrationDate: row.calibration_date,
    nextDueDate: row.next_due_date ?? undefined,
    performedByType: row.performed_by_type,
    performedByUserId: row.performed_by_user_id,
    performedByName: row.performed_by_name,
    performedByStaffId: row.performed_by_staff_id ?? undefined,
    overallResult: row.overall_result ?? undefined,
    status: row.status,
    problem: row.problem ?? undefined,
    correctiveAction: row.corrective_action ?? undefined,
    comment: row.comment ?? undefined,
    reviewStatus: row.review_status,
    reviewDecision: row.review_decision ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedByName: row.reviewed_by_name ?? undefined,
    reviewedByStaffId: row.reviewed_by_staff_id ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    reviewComment: row.review_comment ?? undefined,
    approvalStatus: row.approval_status,
    approvalDecision: row.approval_decision ?? undefined,
    approvedBy: row.approved_by ?? undefined,
    approvedByName: row.approved_by_name ?? undefined,
    approvedByStaffId: row.approved_by_staff_id ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    approvalComment: row.approval_comment ?? undefined,
    finalPdfPath: row.final_pdf_path ?? undefined,
    finalPdfName: row.final_pdf_name ?? undefined,
    samples: samples.sort((a, b) => a.sampleNumber - b.sampleNumber),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchSamplesForCalibrations(calibrationIds: string[]): Promise<Record<string, CentrifugePppCalibrationSample[]>> {
  if (calibrationIds.length === 0) return {};
  const supabase = createClient();
  const { data, error } = await supabase
    .from('centrifuge_ppp_calibration_samples')
    .select('*')
    .in('calibration_id', calibrationIds)
    .order('sample_number', { ascending: true });
  if (error || !data) return {};

  return (data as SampleRow[]).reduce<Record<string, CentrifugePppCalibrationSample[]>>((acc, row) => {
    const sample = mapSample(row);
    acc[row.calibration_id] = [...(acc[row.calibration_id] ?? []), sample];
    return acc;
  }, {});
}

async function logAuditEvent(
  calibrationId: string,
  staff: StaffContext,
  eventType: string,
  eventData?: Record<string, unknown>,
): Promise<void> {
  const supabase = createClient();
  await supabase.from('centrifuge_ppp_audit_events').insert({
    calibration_id: calibrationId,
    event_type: eventType,
    event_data: eventData ?? null,
    performed_by: staff.userId,
    performed_by_name: staff.fullName,
    performed_by_staff_id: staff.staffId,
  });
}

function evidenceStoragePath(calibrationId: string, sampleNumber: number, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${EVIDENCE_PREFIX}/${calibrationId}/sample-${String(sampleNumber).padStart(2, '0')}/${crypto.randomUUID()}-${safeName}`;
}

export async function fetchCentrifugePppCalibrations(): Promise<ClinicalListResult<CentrifugePppCalibrationListItem>> {
  const result = await runClinicalListQuery('Failed to load Centrifuge PPP calibrations', async () => {
    const supabase = createClient();
    return supabase
      .from('centrifuge_ppp_calibrations')
      .select('*')
      .is('deleted_at', null)
      .order('calibration_date', { ascending: false });
  });

  const rows = (result.data ?? []) as CalibrationRow[];
  const sampleMap = await fetchSamplesForCalibrations(rows.map((r) => r.id));

  return {
    data: rows.map((row) => {
      const samples = sampleMap[row.id] ?? [];
      return {
        id: row.id,
        calibrationDate: row.calibration_date,
        overallResult: row.overall_result ?? undefined,
        status: row.status,
        performedByName: row.performed_by_name,
        reviewStatus: row.review_status,
        approvalStatus: row.approval_status,
        hasFinalPdf: Boolean(row.final_pdf_path),
        evidenceComplete: samples.length === CENTRIFUGE_PPP_SAMPLE_COUNT && samples.every((s) => Boolean(s.evidencePath)),
      };
    }),
    error: result.error,
  };
}

export async function fetchCentrifugePppCalibrationById(id: string): Promise<ClinicalResult<CentrifugePppCalibration>> {
  const result = await runClinicalMutation('Failed to load Centrifuge PPP calibration', async () => {
    const supabase = createClient();
    return supabase
      .from('centrifuge_ppp_calibrations')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();
  });

  if (!result.data) return { data: null, error: result.error };
  const row = result.data as CalibrationRow;
  const sampleMap = await fetchSamplesForCalibrations([row.id]);
  return { data: mapCalibration(row, sampleMap[row.id] ?? []), error: null };
}

export async function createCentrifugePppCalibrationDraft(
  staff: StaffContext,
  instrumentEquipmentId: string,
): Promise<ClinicalResult<CentrifugePppCalibration>> {
  const insertResult = await runClinicalMutation('Failed to create Centrifuge PPP calibration', async () => {
    const supabase = createClient();
    return supabase
      .from('centrifuge_ppp_calibrations')
      .insert({
        instrument_equipment_id: instrumentEquipmentId,
        calibration_date: new Date().toISOString().slice(0, 10),
        performed_by_type: 'internal_staff',
        performed_by_user_id: staff.userId,
        performed_by_name: staff.fullName,
        performed_by_staff_id: staff.staffId,
        status: 'draft',
        created_by: staff.userId,
        updated_by: staff.userId,
      })
      .select('*')
      .single();
  });

  if (!insertResult.data) return { data: null, error: insertResult.error };
  const calibrationId = (insertResult.data as CalibrationRow).id;

  const sampleRows = Array.from({ length: CENTRIFUGE_PPP_SAMPLE_COUNT }, (_, index) => ({
    calibration_id: calibrationId,
    sample_number: index + 1,
  }));

  const supabase = createClient();
  const { error: sampleError } = await supabase.from('centrifuge_ppp_calibration_samples').insert(sampleRows);
  if (sampleError) return { data: null, error: sampleError.message };

  await logAuditEvent(calibrationId, staff, 'calibration_created');
  return fetchCentrifugePppCalibrationById(calibrationId);
}

export async function saveCentrifugePppCalibrationDraft(
  calibrationId: string,
  staff: StaffContext,
  form: CentrifugePppDraftFormData,
): Promise<ClinicalResult<CentrifugePppCalibration>> {
  const current = await fetchCentrifugePppCalibrationById(calibrationId);
  if (!current.data) return { data: null, error: current.error ?? 'Calibration not found' };
  if (current.data.status !== 'draft' && current.data.status !== 'failed') {
    return { data: null, error: 'This calibration can no longer be edited.' };
  }

  const samplesWithResults = form.samples.map((sample) => ({
    ...sample,
    calculatedResult: calculatePltSampleResult(sample.pltResult),
  }));
  const overallResult = calculateOverallResult(samplesWithResults.map((s) => ({ calculatedResult: s.calculatedResult })));

  const updateResult = await runClinicalMutation('Failed to save Centrifuge PPP calibration', async () => {
    const supabase = createClient();
    return supabase
      .from('centrifuge_ppp_calibrations')
      .update({
        calibration_date: form.calibrationDate,
        next_due_date: form.nextDueDate || null,
        comment: form.comment?.trim() || null,
        problem: form.problem?.trim() || null,
        corrective_action: form.correctiveAction?.trim() || null,
        overall_result: overallResult ?? null,
        updated_by: staff.userId,
      })
      .eq('id', calibrationId)
      .select('*')
      .single();
  });

  if (!updateResult.data) return { data: null, error: updateResult.error };

  const supabase = createClient();
  for (const sample of samplesWithResults) {
    const existing = current.data.samples.find((s) => s.sampleNumber === sample.sampleNumber);
    const { error } = await supabase
      .from('centrifuge_ppp_calibration_samples')
      .update({
        plt_result: sample.pltResult,
        centrifuge_speed_rpm: sample.centrifugeSpeedRpm,
        centrifuge_time_minutes: sample.centrifugeTimeMinutes,
        calculated_result: sample.calculatedResult,
      })
      .eq('calibration_id', calibrationId)
      .eq('sample_number', sample.sampleNumber);
    if (error) return { data: null, error: error.message };
    if (existing?.pltResult !== sample.pltResult) {
      await logAuditEvent(calibrationId, staff, 'sample_result_changed', {
        sampleNumber: sample.sampleNumber,
        pltResult: sample.pltResult,
        calculatedResult: sample.calculatedResult,
      });
    }
  }

  await logAuditEvent(calibrationId, staff, 'calibration_saved');
  return fetchCentrifugePppCalibrationById(calibrationId);
}

export async function uploadCentrifugePppEvidence(
  calibrationId: string,
  sampleNumber: number,
  staff: StaffContext,
  file: File,
  replacementReason?: string,
): Promise<ClinicalResult<CentrifugePppCalibration>> {
  const current = await fetchCentrifugePppCalibrationById(calibrationId);
  if (!current.data) return { data: null, error: current.error ?? 'Calibration not found' };
  if (current.data.status !== 'draft' && current.data.status !== 'failed') {
    return { data: null, error: 'Evidence cannot be changed after submission.' };
  }

  const sample = current.data.samples.find((s) => s.sampleNumber === sampleNumber);
  if (!sample) return { data: null, error: 'Sample not found' };

  const path = evidenceStoragePath(calibrationId, sampleNumber, file.name);
  const supabase = createClient();
  const { error: uploadError } = await supabase.storage.from(PPM_CALIBRATION_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (uploadError) return { data: null, error: uploadError.message };

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('centrifuge_ppp_calibration_samples')
    .update({
      evidence_path: path,
      evidence_name: file.name,
      evidence_uploaded_by: staff.userId,
      evidence_uploaded_by_name: staff.fullName,
      evidence_uploaded_by_staff_id: staff.staffId,
      evidence_uploaded_at: now,
    })
    .eq('id', sample.id);

  if (updateError) return { data: null, error: updateError.message };

  if (sample.evidencePath) {
    await supabase.from('centrifuge_ppp_evidence_history').insert({
      calibration_id: calibrationId,
      sample_id: sample.id,
      sample_number: sampleNumber,
      previous_path: sample.evidencePath,
      previous_name: sample.evidenceName ?? 'unknown',
      new_path: path,
      new_name: file.name,
      replacement_reason: replacementReason?.trim() || null,
      replaced_by: staff.userId,
      replaced_by_name: staff.fullName,
      replaced_by_staff_id: staff.staffId,
    });
    await logAuditEvent(calibrationId, staff, 'evidence_replaced', { sampleNumber, replacementReason });
  } else {
    await logAuditEvent(calibrationId, staff, 'evidence_uploaded', { sampleNumber, fileName: file.name });
  }

  return fetchCentrifugePppCalibrationById(calibrationId);
}

export async function submitCentrifugePppCalibration(
  calibrationId: string,
  staff: StaffContext,
): Promise<ClinicalResult<CentrifugePppCalibration>> {
  const current = await fetchCentrifugePppCalibrationById(calibrationId);
  if (!current.data) return { data: null, error: current.error ?? 'Calibration not found' };

  const submitCheck = canSubmitCentrifugePppCalibration(current.data);
  if (!submitCheck.ok) return { data: null, error: submitCheck.reason ?? 'Cannot submit calibration' };

  const nextStatus = current.data.overallResult === 'fail' ? 'failed' : 'pending_review';
  const result = await runClinicalMutation('Failed to submit Centrifuge PPP calibration', async () => {
    const supabase = createClient();
    return supabase
      .from('centrifuge_ppp_calibrations')
      .update({
        status: nextStatus === 'failed' ? 'failed' : 'pending_review',
        review_status: 'Pending Review',
        approval_status: 'Pending Approval',
        updated_by: staff.userId,
      })
      .eq('id', calibrationId)
      .select('*')
      .single();
  });

  if (!result.data) return { data: null, error: result.error };
  await logAuditEvent(calibrationId, staff, 'calibration_submitted', { status: nextStatus });
  return fetchCentrifugePppCalibrationById(calibrationId);
}

export async function submitFailedCentrifugePppForReview(
  calibrationId: string,
  staff: StaffContext,
): Promise<ClinicalResult<CentrifugePppCalibration>> {
  const current = await fetchCentrifugePppCalibrationById(calibrationId);
  if (!current.data) return { data: null, error: current.error ?? 'Calibration not found' };
  if (current.data.status !== 'failed') return { data: null, error: 'Only failed calibrations can be submitted for review from this action.' };
  if (!current.data.problem?.trim() || !current.data.correctiveAction?.trim()) {
    return { data: null, error: 'Problem and Corrective Action are required.' };
  }

  const result = await runClinicalMutation('Failed to submit for review', async () => {
    const supabase = createClient();
    return supabase
      .from('centrifuge_ppp_calibrations')
      .update({
        status: 'pending_review',
        review_status: 'Pending Review',
        updated_by: staff.userId,
      })
      .eq('id', calibrationId)
      .select('*')
      .single();
  });

  if (!result.data) return { data: null, error: result.error };
  await logAuditEvent(calibrationId, staff, 'failed_calibration_submitted_for_review');
  return fetchCentrifugePppCalibrationById(calibrationId);
}

export async function reviewCentrifugePppCalibration(
  calibrationId: string,
  staff: StaffContext,
  form: CentrifugePppReviewFormData,
): Promise<ClinicalResult<CentrifugePppCalibration>> {
  const now = new Date().toISOString();
  const isApproved = form.reviewDecision === 'Reviewed';

  const result = await runClinicalMutation('Failed to review Centrifuge PPP calibration', async () => {
    const supabase = createClient();
    return supabase
      .from('centrifuge_ppp_calibrations')
      .update({
        review_decision: form.reviewDecision,
        review_status: isApproved ? 'Reviewed' : 'Pending Review',
        review_comment: form.reviewComment?.trim() || null,
        reviewed_by: staff.userId,
        reviewed_by_name: staff.fullName,
        reviewed_by_staff_id: staff.staffId,
        reviewed_at: now,
        status: isApproved ? 'pending_approval' : 'failed',
        updated_by: staff.userId,
      })
      .eq('id', calibrationId)
      .select('*')
      .single();
  });

  if (!result.data) return { data: null, error: result.error };
  await logAuditEvent(calibrationId, staff, 'calibration_reviewed', { decision: form.reviewDecision });
  return fetchCentrifugePppCalibrationById(calibrationId);
}

export async function approveCentrifugePppCalibration(
  calibrationId: string,
  staff: StaffContext,
  form: CentrifugePppApprovalFormData,
): Promise<ClinicalResult<CentrifugePppCalibration>> {
  const now = new Date().toISOString();
  const isApproved = form.approvalDecision === 'Approved';

  const result = await runClinicalMutation('Failed to approve Centrifuge PPP calibration', async () => {
    const supabase = createClient();
    return supabase
      .from('centrifuge_ppp_calibrations')
      .update({
        approval_decision: form.approvalDecision,
        approval_status: isApproved ? 'Approved' : 'Pending Approval',
        approval_comment: form.approvalComment?.trim() || null,
        approved_by: staff.userId,
        approved_by_name: staff.fullName,
        approved_by_staff_id: staff.staffId,
        approved_at: now,
        status: isApproved ? 'approved' : 'pending_review',
        updated_by: staff.userId,
      })
      .eq('id', calibrationId)
      .select('*')
      .single();
  });

  if (!result.data) return { data: null, error: result.error };
  await logAuditEvent(calibrationId, staff, 'calibration_approved', { decision: form.approvalDecision });
  return fetchCentrifugePppCalibrationById(calibrationId);
}

export async function saveCentrifugePppFinalPdf(
  calibrationId: string,
  staff: StaffContext,
  pdfBytes: Uint8Array,
  fileName: string,
): Promise<ClinicalResult<CentrifugePppCalibration>> {
  const path = `${EVIDENCE_PREFIX}/${calibrationId}/final/${crypto.randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const supabase = createClient();
  const { error: uploadError } = await supabase.storage.from(PPM_CALIBRATION_BUCKET).upload(path, pdfBytes, {
    upsert: false,
    contentType: 'application/pdf',
  });
  if (uploadError) return { data: null, error: uploadError.message };

  const result = await runClinicalMutation('Failed to save final PDF reference', async () => {
    return supabase
      .from('centrifuge_ppp_calibrations')
      .update({
        final_pdf_path: path,
        final_pdf_name: fileName,
        updated_by: staff.userId,
      })
      .eq('id', calibrationId)
      .select('*')
      .single();
  });

  if (!result.data) return { data: null, error: result.error };
  await logAuditEvent(calibrationId, staff, 'final_pdf_generated', { fileName });
  return fetchCentrifugePppCalibrationById(calibrationId);
}

export async function getCentrifugePppSignedUrl(path: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(PPM_CALIBRATION_BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function fetchCentrifugePppCalibrationWithInstrument(id: string) {
  const calibrationResult = await fetchCentrifugePppCalibrationById(id);
  if (!calibrationResult.data) return { calibration: null, instrument: null, error: calibrationResult.error };
  const instrumentResult = await fetchInstrumentById(calibrationResult.data.instrumentEquipmentId);
  return {
    calibration: calibrationResult.data,
    instrument: instrumentResult.data,
    error: instrumentResult.error,
  };
}
