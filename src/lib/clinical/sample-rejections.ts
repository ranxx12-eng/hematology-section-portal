import { createClient } from '@/lib/supabase/client';
import type { SampleRejectionFormData } from '@/lib/sample-rejections/schema';
import type { SampleRejection } from '@/types';
import type { StaffContext } from './staff-context';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface SampleRejectionRow {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_lab_accession: string;
  department_name: string;
  rejection_date: string;
  rejection_time: string;
  rejected_tests: string[];
  rejected_tube: string;
  rejection_reasons: string[];
  other_rejection_reason: string | null;
  informed_nurse_name: string;
  nurse_id: string;
  nurse_notification_date: string;
  nurse_notification_time: string;
  doctor_notification_required: boolean;
  doctor_name: string | null;
  doctor_id: string | null;
  doctor_notification_date: string | null;
  doctor_notification_time: string | null;
  created_by: string | null;
  created_by_staff_name: string;
  created_by_staff_id: string;
  record_created_date: string;
  record_created_time: string;
  supervisor_review_status: SampleRejection['supervisorReviewStatus'];
  reviewed_by_user_id: string | null;
  reviewed_by_name: string | null;
  reviewed_by_staff_id: string | null;
  reviewed_date: string | null;
  reviewed_time: string | null;
  replacement_sample_status: SampleRejection['replacementSampleStatus'];
  replacement_received_date: string | null;
  replacement_received_time: string | null;
  replacement_received_by_user_id: string | null;
  replacement_received_by_name: string | null;
  replacement_received_by_staff_id: string | null;
  completion_date: string | null;
  completion_time: string | null;
  completed_by_user_id: string | null;
  completed_by_name: string | null;
  completed_by_staff_id: string | null;
  discard_due_at: string | null;
  discard_status: SampleRejection['discardStatus'];
  discard_date: string | null;
  discard_time: string | null;
  discarded_by_user_id: string | null;
  discarded_by_name: string | null;
  discarded_by_staff_id: string | null;
  comments: string | null;
  pending_sample_id: string | null;
  created_at: string;
  updated_at: string;
}

function mapSampleRejection(row: SampleRejectionRow): SampleRejection {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    patientLabAccNumber: row.patient_lab_accession,
    department: row.department_name,
    rejectionDate: row.rejection_date,
    rejectionTime: row.rejection_time.slice(0, 5),
    rejectedTests: row.rejected_tests ?? [],
    rejectedTube: row.rejected_tube,
    rejectionReasons: row.rejection_reasons ?? [],
    otherRejectionReason: row.other_rejection_reason ?? undefined,
    informedNurseName: row.informed_nurse_name,
    nurseId: row.nurse_id,
    nurseNotificationDate: row.nurse_notification_date,
    nurseNotificationTime: row.nurse_notification_time.slice(0, 5),
    doctorNotificationRequired: row.doctor_notification_required,
    doctorName: row.doctor_name ?? undefined,
    doctorId: row.doctor_id ?? undefined,
    doctorNotificationDate: row.doctor_notification_date ?? undefined,
    doctorNotificationTime: row.doctor_notification_time?.slice(0, 5),
    createdByUserId: row.created_by ?? '',
    createdByStaffName: row.created_by_staff_name,
    createdByStaffId: row.created_by_staff_id,
    recordCreatedDate: row.record_created_date,
    recordCreatedTime: row.record_created_time.slice(0, 5),
    supervisorReviewStatus: row.supervisor_review_status,
    reviewedByUserId: row.reviewed_by_user_id ?? undefined,
    reviewedByName: row.reviewed_by_name ?? undefined,
    reviewedByStaffId: row.reviewed_by_staff_id ?? undefined,
    reviewedDate: row.reviewed_date ?? undefined,
    reviewedTime: row.reviewed_time?.slice(0, 5),
    replacementSampleStatus: row.replacement_sample_status,
    replacementReceivedDate: row.replacement_received_date ?? undefined,
    replacementReceivedTime: row.replacement_received_time?.slice(0, 5),
    replacementReceivedByUserId: row.replacement_received_by_user_id ?? undefined,
    replacementReceivedByName: row.replacement_received_by_name ?? undefined,
    replacementReceivedByStaffId: row.replacement_received_by_staff_id ?? undefined,
    completionDate: row.completion_date ?? undefined,
    completionTime: row.completion_time?.slice(0, 5),
    completedByUserId: row.completed_by_user_id ?? undefined,
    completedByName: row.completed_by_name ?? undefined,
    completedByStaffId: row.completed_by_staff_id ?? undefined,
    discardDueAt: row.discard_due_at ?? '',
    discardStatus: row.discard_status,
    discardDate: row.discard_date ?? undefined,
    discardTime: row.discard_time?.slice(0, 5),
    discardedByUserId: row.discarded_by_user_id ?? undefined,
    discardedByName: row.discarded_by_name ?? undefined,
    discardedByStaffId: row.discarded_by_staff_id ?? undefined,
    comments: row.comments ?? undefined,
    pendingSampleId: row.pending_sample_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formToRow(form: SampleRejectionFormData) {
  return {
    patient_id: form.patientId,
    patient_name: form.patientName,
    patient_lab_accession: form.patientLabAccNumber,
    department_name: form.department,
    rejection_date: form.rejectionDate,
    rejection_time: form.rejectionTime,
    rejected_tests: form.rejectedTests,
    rejected_tube: form.rejectedTube,
    rejection_reasons: form.rejectionReasons,
    other_rejection_reason: form.otherRejectionReason?.trim() || null,
    informed_nurse_name: form.informedNurseName,
    nurse_id: form.nurseId,
    nurse_notification_date: form.nurseNotificationDate,
    nurse_notification_time: form.nurseNotificationTime,
    doctor_notification_required: form.doctorNotificationRequired,
    doctor_name: form.doctorNotificationRequired ? form.doctorName ?? null : null,
    doctor_id: form.doctorNotificationRequired ? form.doctorId ?? null : null,
    doctor_notification_date: form.doctorNotificationRequired ? form.doctorNotificationDate ?? null : null,
    doctor_notification_time: form.doctorNotificationRequired ? form.doctorNotificationTime ?? null : null,
    comments: form.comments?.trim() || null,
  };
}

function buildCreateRow(form: SampleRejectionFormData, staff: StaffContext) {
  const now = new Date();
  return {
    ...formToRow(form),
    created_by: staff.userId,
    created_by_staff_name: staff.fullName,
    created_by_staff_id: staff.staffId,
    record_created_date: now.toISOString().slice(0, 10),
    record_created_time: now.toTimeString().slice(0, 8),
  };
}

export async function fetchSampleRejections(): Promise<ClinicalListResult<SampleRejection>> {
  const result = await runClinicalListQuery('Failed to load sample rejections', async () => {
    const supabase = createClient();
    return supabase
      .from('sample_rejections')
      .select('*')
      .is('deleted_at', null)
      .order('rejection_date', { ascending: false })
      .order('created_at', { ascending: false });
  });

  return {
    data: (result.data as unknown as SampleRejectionRow[]).map(mapSampleRejection),
    error: result.error,
  };
}

export async function createSampleRejection(
  staff: StaffContext,
  form: SampleRejectionFormData,
): Promise<ClinicalResult<SampleRejection>> {
  return runClinicalMutation('Failed to create sample rejection', async () => {
    const supabase = createClient();
    return supabase
      .from('sample_rejections')
      .insert(buildCreateRow(form, staff))
      .select('*')
      .single();
  }).then((result) => ({
    data: result.data ? mapSampleRejection(result.data as unknown as SampleRejectionRow) : null,
    error: result.error,
  }));
}

export async function updateSampleRejection(
  id: string,
  form: SampleRejectionFormData,
): Promise<ClinicalResult<SampleRejection>> {
  return runClinicalMutation('Failed to update sample rejection', async () => {
    const supabase = createClient();
    return supabase
      .from('sample_rejections')
      .update(formToRow(form))
      .eq('id', id)
      .is('deleted_at', null)
      .select('*')
      .single();
  }).then((result) => ({
    data: result.data ? mapSampleRejection(result.data as unknown as SampleRejectionRow) : null,
    error: result.error,
  }));
}
