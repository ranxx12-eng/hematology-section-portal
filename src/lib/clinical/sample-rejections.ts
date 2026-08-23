import { createClient } from '@/lib/supabase/client';
import type { SampleRejectionDiscardData, SampleRejectionFormData, SampleRejectionReviewData } from '@/lib/sample-rejections/schema';
import { calculateDiscardDueAt, calculateElapsedMinutes } from '@/lib/sample-rejections/workflow';
import type { SampleRejection } from '@/types';
import type { StaffContext } from './staff-context';
import { fetchSystemSettings } from './system-settings';
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
  supervisor_review_comment: string | null;
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
  discard_comment: string | null;
  comments: string | null;
  pending_sample_id: string | null;
  created_at: string;
  updated_at: string;
}

const CLOSED_REPLACEMENT_STATUSES = new Set<SampleRejection['replacementSampleStatus']>([
  'Completed',
  'Discarded',
  'Cancelled',
]);

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
    supervisorReviewComment: row.supervisor_review_comment ?? undefined,
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
    discardComment: row.discard_comment ?? undefined,
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

function buildCreateRow(
  form: SampleRejectionFormData,
  staff: StaffContext,
  retentionDays: number,
) {
  const now = new Date();
  return {
    ...formToRow(form),
    created_by: staff.userId,
    created_by_staff_name: staff.fullName,
    created_by_staff_id: staff.staffId,
    record_created_date: now.toISOString().slice(0, 10),
    record_created_time: now.toTimeString().slice(0, 8),
    discard_due_at: calculateDiscardDueAt(form.rejectionDate, form.rejectionTime, retentionDays),
    discard_status: 'not_due' as const,
    supervisor_review_status: 'pending_supervisor_review' as const,
    replacement_sample_status: 'Awaiting Replacement Sample' as const,
  };
}

function pendingStatusForRejection(rejection: SampleRejectionRow): string {
  if (rejection.discard_status === 'discard_due' && rejection.replacement_sample_status !== 'Discarded') {
    return 'Discard Due';
  }
  return rejection.replacement_sample_status;
}

function pendingSampleRowFromRejection(rejection: SampleRejectionRow, userId?: string) {
  const receivedIso = `${rejection.rejection_date}T${rejection.rejection_time}`;
  const isActive = !CLOSED_REPLACEMENT_STATUSES.has(rejection.replacement_sample_status);
  return {
    source_type: 'rejection' as const,
    sample_rejection_id: rejection.id,
    patient_id: rejection.patient_id,
    patient_name: rejection.patient_name,
    patient_lab_accession: rejection.patient_lab_accession,
    department_name: rejection.department_name,
    rejected_tests: rejection.rejected_tests,
    rejected_tube: rejection.rejected_tube,
    rejection_reasons: rejection.rejection_reasons,
    rejection_date: rejection.rejection_date,
    rejection_time: rejection.rejection_time,
    test_name: (rejection.rejected_tests ?? []).join(', ') || 'Rejected Sample',
    priority: 'routine' as const,
    received_time: receivedIso,
    elapsed_minutes: calculateElapsedMinutes(rejection.rejection_date, rejection.rejection_time),
    replacement_sample_status: rejection.replacement_sample_status,
    current_status: pendingStatusForRejection(rejection),
    is_active: isActive,
    ...(userId ? { created_by: userId } : {}),
  };
}

async function upsertPendingSampleForRejection(
  rejection: SampleRejectionRow,
  userId?: string,
): Promise<string | null> {
  if (CLOSED_REPLACEMENT_STATUSES.has(rejection.replacement_sample_status)) {
    if (rejection.pending_sample_id) {
      const supabase = createClient();
      await supabase
        .from('pending_samples')
        .update({
          is_active: false,
          current_status: rejection.replacement_sample_status,
          replacement_sample_status: rejection.replacement_sample_status,
          elapsed_minutes: calculateElapsedMinutes(rejection.rejection_date, rejection.rejection_time),
        })
        .eq('id', rejection.pending_sample_id)
        .is('deleted_at', null);
    }
    return rejection.pending_sample_id;
  }

  const supabase = createClient();
  const row = pendingSampleRowFromRejection(rejection, userId);

  if (rejection.pending_sample_id) {
    const { data, error } = await supabase
      .from('pending_samples')
      .update(row)
      .eq('id', rejection.pending_sample_id)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();
    if (!error && data?.id) return data.id;
  }

  const { data: linked } = await supabase
    .from('pending_samples')
    .select('id')
    .eq('sample_rejection_id', rejection.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (linked?.id) {
    await supabase
      .from('pending_samples')
      .update(row)
      .eq('id', linked.id)
      .is('deleted_at', null);
    return linked.id;
  }

  const { data: created, error } = await supabase
    .from('pending_samples')
    .insert(row)
    .select('id')
    .single();

  if (error || !created?.id) return rejection.pending_sample_id;

  await supabase
    .from('sample_rejections')
    .update({ pending_sample_id: created.id })
    .eq('id', rejection.id)
    .is('deleted_at', null);

  return created.id;
}

export async function syncRejectionWorkflowState(): Promise<{ error: string | null }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('sample_rejections')
      .select('*')
      .is('deleted_at', null);

    if (error) return { error: error.message };

    const rows = (data ?? []) as SampleRejectionRow[];
    const now = Date.now();

    for (const rejection of rows) {
      let discardStatus = rejection.discard_status;
      if (
        rejection.discard_due_at
        && !CLOSED_REPLACEMENT_STATUSES.has(rejection.replacement_sample_status)
        && rejection.discard_status !== 'discarded'
        && now >= new Date(rejection.discard_due_at).getTime()
      ) {
        discardStatus = 'discard_due';
      }

      if (discardStatus !== rejection.discard_status) {
        await supabase
          .from('sample_rejections')
          .update({ discard_status: discardStatus })
          .eq('id', rejection.id)
          .is('deleted_at', null);
        rejection.discard_status = discardStatus;
      }

      if (
        rejection.replacement_sample_status === 'Awaiting Replacement Sample'
        || rejection.replacement_sample_status === 'Replacement Sample Received'
        || rejection.discard_status === 'discard_due'
      ) {
        await upsertPendingSampleForRejection(rejection);
      } else if (rejection.pending_sample_id) {
        await upsertPendingSampleForRejection(rejection);
      }
    }

    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to sync rejection workflow' };
  }
}

export async function fetchSampleRejections(): Promise<ClinicalListResult<SampleRejection>> {
  await syncRejectionWorkflowState();

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
  const { settings } = await fetchSystemSettings();
  const retentionDays = settings.rejectedSampleRetentionDays;

  const result = await runClinicalMutation('Failed to create sample rejection', async () => {
    const supabase = createClient();
    return supabase
      .from('sample_rejections')
      .insert(buildCreateRow(form, staff, retentionDays))
      .select('*')
      .single();
  });

  if (result.data) {
    const row = result.data as unknown as SampleRejectionRow;
    await upsertPendingSampleForRejection(row, staff.userId);
  }

  return {
    data: result.data ? mapSampleRejection(result.data as unknown as SampleRejectionRow) : null,
    error: result.error,
  };
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

export async function reviewSampleRejection(
  id: string,
  staff: StaffContext,
  review: SampleRejectionReviewData,
): Promise<ClinicalResult<SampleRejection>> {
  const now = new Date();
  const result = await runClinicalMutation('Failed to review sample rejection', async () => {
    const supabase = createClient();
    return supabase
      .from('sample_rejections')
      .update({
        supervisor_review_status: review.supervisorReviewStatus,
        supervisor_review_comment: review.supervisorReviewComment?.trim() || null,
        reviewed_by_user_id: staff.userId,
        reviewed_by_name: staff.fullName,
        reviewed_by_staff_id: staff.staffId,
        reviewed_date: now.toISOString().slice(0, 10),
        reviewed_time: now.toTimeString().slice(0, 8),
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select('*')
      .single();
  });

  return {
    data: result.data ? mapSampleRejection(result.data as unknown as SampleRejectionRow) : null,
    error: result.error,
  };
}

export async function markReplacementReceived(
  id: string,
  staff: StaffContext,
): Promise<ClinicalResult<SampleRejection>> {
  const now = new Date();
  const result = await runClinicalMutation('Failed to mark replacement received', async () => {
    const supabase = createClient();
    return supabase
      .from('sample_rejections')
      .update({
        replacement_sample_status: 'Replacement Sample Received',
        replacement_received_date: now.toISOString().slice(0, 10),
        replacement_received_time: now.toTimeString().slice(0, 8),
        replacement_received_by_user_id: staff.userId,
        replacement_received_by_name: staff.fullName,
        replacement_received_by_staff_id: staff.staffId,
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select('*')
      .single();
  });

  if (result.data) {
    await upsertPendingSampleForRejection(result.data as unknown as SampleRejectionRow, staff.userId);
  }

  return {
    data: result.data ? mapSampleRejection(result.data as unknown as SampleRejectionRow) : null,
    error: result.error,
  };
}

export async function markRejectionCompleted(
  id: string,
  staff: StaffContext,
): Promise<ClinicalResult<SampleRejection>> {
  const now = new Date();
  const result = await runClinicalMutation('Failed to complete sample rejection', async () => {
    const supabase = createClient();
    return supabase
      .from('sample_rejections')
      .update({
        replacement_sample_status: 'Completed',
        completion_date: now.toISOString().slice(0, 10),
        completion_time: now.toTimeString().slice(0, 8),
        completed_by_user_id: staff.userId,
        completed_by_name: staff.fullName,
        completed_by_staff_id: staff.staffId,
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select('*')
      .single();
  });

  if (result.data) {
    await upsertPendingSampleForRejection(result.data as unknown as SampleRejectionRow, staff.userId);
  }

  return {
    data: result.data ? mapSampleRejection(result.data as unknown as SampleRejectionRow) : null,
    error: result.error,
  };
}

export async function markRejectionDiscarded(
  id: string,
  staff: StaffContext,
  discard: SampleRejectionDiscardData,
): Promise<ClinicalResult<SampleRejection>> {
  const now = new Date();
  const result = await runClinicalMutation('Failed to mark sample discarded', async () => {
    const supabase = createClient();
    return supabase
      .from('sample_rejections')
      .update({
        replacement_sample_status: 'Discarded',
        discard_status: 'discarded',
        discard_date: now.toISOString().slice(0, 10),
        discard_time: now.toTimeString().slice(0, 8),
        discarded_by_user_id: staff.userId,
        discarded_by_name: staff.fullName,
        discarded_by_staff_id: staff.staffId,
        discard_comment: discard.discardComment?.trim() || null,
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select('*')
      .single();
  });

  if (result.data) {
    await upsertPendingSampleForRejection(result.data as unknown as SampleRejectionRow, staff.userId);
  }

  return {
    data: result.data ? mapSampleRejection(result.data as unknown as SampleRejectionRow) : null,
    error: result.error,
  };
}
