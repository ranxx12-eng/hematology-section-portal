import { createClient } from '@/lib/supabase/client';
import {
  buildCorrectiveActionSnapshot,
  buildMonthSummary,
  canApproveMonth,
  canMarkMonthReadyForReview,
  deriveActionStatus,
  deriveFailedValueDisplay,
  formatCorrectedValueDisplay,
  formatOriginalQcStatusLabel,
  isCorrectiveActionComplete,
  mergeExistingQcNotes,
  parseCorrectedValue,
  qualifiesForCorrectiveAction,
  repeatedFailureKey,
  validateCorrectiveActionInput,
} from '@/lib/qc-corrective-actions/calculation';
import {
  DEFAULT_ALINITY_QC_MATERIAL,
  FORM_HEMA_016_CODE,
  FORM_HEMA_016_QID,
  formatCorrectiveActionDisplay,
  isAlinityHqInstrumentName,
  monthName,
} from '@/lib/qc-corrective-actions/constants';
import type {
  QcCorrectiveActionExtension,
  QcCorrectiveActionFormInput,
  QcCorrectiveAuditEvent,
  QcCorrectiveMonthSummary,
  QcCorrectiveMonthlyReview,
  QcCorrectiveWorklistItem,
} from '@/types/qc-corrective-action';
import type { StaffContext } from './staff-context';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface QcRecordRow {
  id: string;
  instrument_id: string;
  test_name: string;
  control_level: string;
  lot_number: string | null;
  expiry_date: string | null;
  recorded_at: string;
  result_value: number | null;
  range_min: number | null;
  range_max: number | null;
  qc_status: 'IN' | 'OUT';
  corrective_actions: string[] | null;
  corrective_action_comment: string | null;
  corrective_action_other: string | null;
  resolution_status: string | null;
  review_decision: 'accept' | 'not_accept' | 'need_follow_up' | null;
  approval_decision: 'accept' | 'not_accept' | 'need_follow_up' | null;
  performed_by_name: string | null;
  performed_by_staff_id: string | null;
  comment: string | null;
}

interface ExtensionRow {
  id: string;
  qc_record_id: string;
  corrected_value: number | null;
  corrected_value_text: string | null;
  corrective_action_code: string | null;
  corrective_action_text_snapshot: string | null;
  explanation: string | null;
  remarks: string | null;
  result_after_action: string | null;
  action_status: string;
  completed_by: string | null;
  completed_by_name: string | null;
  completed_by_staff_id: string | null;
  completed_at: string | null;
  prepared_by: string | null;
  prepared_by_name: string | null;
  prepared_by_staff_id: string | null;
  prepared_at: string | null;
  instrument_id_snapshot: string | null;
  instrument_name_snapshot: string | null;
  qc_material_snapshot: string | null;
  analyte_snapshot: string | null;
  qc_level_snapshot: string | null;
  failed_value_snapshot: string | null;
  operator_name_snapshot: string | null;
  operator_staff_id_snapshot: string | null;
  recorded_at_snapshot: string | null;
  lot_number_snapshot: string | null;
  expiry_date_snapshot: string | null;
  original_qc_status_snapshot: string | null;
  created_at: string;
  updated_at: string;
}

interface MonthlyReviewRow {
  id: string;
  year: number;
  month: number;
  instrument_id: string;
  form_code: string;
  qid: string;
  status: QcCorrectiveMonthlyReview['status'];
  version_number: number;
  parent_review_id: string | null;
  amendment_reason: string | null;
  prepared_by: string | null;
  prepared_by_name: string | null;
  prepared_by_staff_id: string | null;
  prepared_at: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_by_staff_id: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_by_staff_id: string | null;
  approved_at: string | null;
  approval_comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface QcCorrectiveWorklistFilters {
  year: number;
  month: number;
  dateFrom?: string;
  dateTo?: string;
  instrumentId?: string;
  qcMaterial?: string;
  analyte?: string;
  qcLevel?: string;
  originalQcStatus?: string;
  actionStatus?: string;
  reviewerId?: string;
  approverId?: string;
  search?: string;
  alinityOnly?: boolean;
}

function mapExtension(row: ExtensionRow): QcCorrectiveActionExtension {
  return {
    id: row.id,
    qcRecordId: row.qc_record_id,
    correctedValue: row.corrected_value ?? undefined,
    correctedValueText: row.corrected_value_text ?? undefined,
    correctiveActionCode: (row.corrective_action_code as QcCorrectiveActionExtension['correctiveActionCode']) ?? undefined,
    correctiveActionTextSnapshot: row.corrective_action_text_snapshot ?? undefined,
    explanation: row.explanation ?? undefined,
    remarks: row.remarks ?? undefined,
    resultAfterAction: (row.result_after_action as QcCorrectiveActionExtension['resultAfterAction']) ?? undefined,
    actionStatus: row.action_status as QcCorrectiveActionExtension['actionStatus'],
    completedByUserId: row.completed_by ?? undefined,
    completedByName: row.completed_by_name ?? undefined,
    completedByStaffId: row.completed_by_staff_id ?? undefined,
    completedAt: row.completed_at ?? undefined,
    preparedByUserId: row.prepared_by ?? undefined,
    preparedByName: row.prepared_by_name ?? undefined,
    preparedByStaffId: row.prepared_by_staff_id ?? undefined,
    preparedAt: row.prepared_at ?? undefined,
    instrumentIdSnapshot: row.instrument_id_snapshot ?? undefined,
    instrumentNameSnapshot: row.instrument_name_snapshot ?? undefined,
    qcMaterialSnapshot: row.qc_material_snapshot ?? undefined,
    analyteSnapshot: row.analyte_snapshot ?? undefined,
    qcLevelSnapshot: row.qc_level_snapshot ?? undefined,
    failedValueSnapshot: row.failed_value_snapshot ?? undefined,
    operatorNameSnapshot: row.operator_name_snapshot ?? undefined,
    operatorStaffIdSnapshot: row.operator_staff_id_snapshot ?? undefined,
    recordedAtSnapshot: row.recorded_at_snapshot ?? undefined,
    lotNumberSnapshot: row.lot_number_snapshot ?? undefined,
    expiryDateSnapshot: row.expiry_date_snapshot ?? undefined,
    originalQcStatusSnapshot: row.original_qc_status_snapshot ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMonthlyReview(row: MonthlyReviewRow, instrumentName?: string): QcCorrectiveMonthlyReview {
  return {
    id: row.id,
    year: row.year,
    month: row.month,
    instrumentId: row.instrument_id,
    instrumentName,
    formCode: row.form_code,
    qid: row.qid,
    status: row.status,
    versionNumber: row.version_number,
    parentReviewId: row.parent_review_id ?? undefined,
    amendmentReason: row.amendment_reason ?? undefined,
    preparedByUserId: row.prepared_by ?? undefined,
    preparedByName: row.prepared_by_name ?? undefined,
    preparedByStaffId: row.prepared_by_staff_id ?? undefined,
    preparedAt: row.prepared_at ?? undefined,
    reviewedByUserId: row.reviewed_by ?? undefined,
    reviewedByName: row.reviewed_by_name ?? undefined,
    reviewedByStaffId: row.reviewed_by_staff_id ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    reviewComment: row.review_comment ?? undefined,
    approvedByUserId: row.approved_by ?? undefined,
    approvedByName: row.approved_by_name ?? undefined,
    approvedByStaffId: row.approved_by_staff_id ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    approvalComment: row.approval_comment ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function monthBounds(year: number, month: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start: start.toISOString(), end: end.toISOString() };
}

function buildQcMaterialLabel(lotNumber?: string | null): string {
  if (lotNumber?.trim()) return `${DEFAULT_ALINITY_QC_MATERIAL} (Lot ${lotNumber.trim()})`;
  return DEFAULT_ALINITY_QC_MATERIAL;
}

async function logAudit(
  staff: StaffContext,
  action: string,
  opts?: {
    qcRecordId?: string;
    monthlyReviewId?: string;
    oldStatus?: string;
    newStatus?: string;
    comment?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const supabase = createClient();
  await supabase.from('qc_corrective_action_audit_events').insert({
    qc_record_id: opts?.qcRecordId ?? null,
    monthly_review_id: opts?.monthlyReviewId ?? null,
    user_id: staff.userId,
    user_name: staff.fullName,
    staff_id: staff.staffId,
    action,
    old_status: opts?.oldStatus ?? null,
    new_status: opts?.newStatus ?? null,
    comment: opts?.comment ?? null,
    metadata: opts?.metadata ?? null,
  });
}

function mapWorklistItem(
  record: QcRecordRow,
  extension: ExtensionRow | undefined,
  instrumentName: string,
  repeatedCount: number,
  monthlyReview?: MonthlyReviewRow,
): QcCorrectiveWorklistItem {
  const isAlinityHq = isAlinityHqInstrumentName(instrumentName);
  const failedValue = deriveFailedValueDisplay(record.result_value, record.qc_status);
  const formInput: QcCorrectiveActionFormInput = {
    correctedValue: formatCorrectedValueDisplay(extension?.corrected_value, extension?.corrected_value_text),
    correctiveActionCode: extension?.corrective_action_code as QcCorrectiveActionFormInput['correctiveActionCode'],
    explanation: extension?.explanation ?? undefined,
    remarks: extension?.remarks ?? undefined,
    resultAfterAction: extension?.result_after_action as QcCorrectiveActionFormInput['resultAfterAction'],
  };
  const actionStatus = extension?.action_status as QcCorrectiveWorklistItem['actionStatus']
    ?? deriveActionStatus(formInput);
  const isIncomplete = !isCorrectiveActionComplete(formInput);

  return {
    qcRecordId: record.id,
    recordedAt: record.recorded_at,
    instrumentId: record.instrument_id,
    instrumentName,
    qcMaterial: buildQcMaterialLabel(record.lot_number),
    analyte: record.test_name,
    qcLevel: record.control_level,
    failedValue,
    correctedValue: formatCorrectedValueDisplay(extension?.corrected_value, extension?.corrected_value_text),
    correctiveActionCode: extension?.corrective_action_code as QcCorrectiveWorklistItem['correctiveActionCode'],
    correctiveActionLabel: extension?.corrective_action_code
      ? formatCorrectiveActionDisplay(extension.corrective_action_code as QcCorrectiveWorklistItem['correctiveActionCode'])
      : undefined,
    explanation: extension?.explanation ?? undefined,
    remarks: extension?.remarks ?? undefined,
    operatorName: record.performed_by_name ?? undefined,
    operatorStaffId: record.performed_by_staff_id ?? undefined,
    lotNumber: record.lot_number ?? undefined,
    expiryDate: record.expiry_date ?? undefined,
    originalQcStatus: formatOriginalQcStatusLabel({
      qcStatus: record.qc_status,
      reviewDecision: record.review_decision,
      approvalDecision: record.approval_decision,
    }),
    originalReviewDecision: record.review_decision ?? undefined,
    originalApprovalDecision: record.approval_decision ?? undefined,
    existingQcCorrectiveNotes: mergeExistingQcNotes({
      correctiveActions: record.corrective_actions ?? undefined,
      correctiveActionComment: record.corrective_action_comment ?? undefined,
      correctiveActionOther: record.corrective_action_other ?? undefined,
    }),
    actionStatus,
    resultAfterAction: extension?.result_after_action as QcCorrectiveWorklistItem['resultAfterAction'],
    extensionId: extension?.id,
    repeatedFailureCount: repeatedCount,
    monthlyReviewStatus: monthlyReview?.status,
    monthlyReviewId: monthlyReview?.id,
    isAlinityHq,
    isIncomplete,
  };
}

export async function fetchAlinityHqInstruments(): Promise<ClinicalListResult<{ id: string; name: string }>> {
  return runClinicalListQuery('Failed to load Alinity HQ instruments', async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('instruments')
      .select('id, name')
      .is('deleted_at', null)
      .order('name');
    if (error) return { data: null, error };
    const filtered = (data ?? []).filter((row) => isAlinityHqInstrumentName(String(row.name)));
    return { data: filtered, error: null };
  });
}

export async function fetchQcCorrectiveWorklist(
  filters: QcCorrectiveWorklistFilters,
): Promise<ClinicalListResult<QcCorrectiveWorklistItem>> {
  return runClinicalListQuery('Failed to load QC corrective action worklist', async () => {
    const supabase = createClient();
    const bounds = monthBounds(filters.year, filters.month);

    let query = supabase
      .from('qc_records')
      .select(`
        id, instrument_id, test_name, control_level, lot_number, expiry_date, recorded_at,
        result_value, range_min, range_max, qc_status, corrective_actions, corrective_action_comment,
        corrective_action_other, resolution_status, review_decision, approval_decision,
        performed_by_name, performed_by_staff_id, comment
      `)
      .is('deleted_at', null)
      .gte('recorded_at', filters.dateFrom ? new Date(filters.dateFrom).toISOString() : bounds.start)
      .lte('recorded_at', filters.dateTo ? new Date(filters.dateTo).toISOString() : bounds.end)
      .order('recorded_at', { ascending: false });

    if (filters.instrumentId) query = query.eq('instrument_id', filters.instrumentId);

    const { data: qcRows, error: qcError } = await query;
    if (qcError) return { data: null, error: { message: qcError.message } };

    const qualifying = (qcRows as QcRecordRow[]).filter((row) =>
      qualifiesForCorrectiveAction({
        qcStatus: row.qc_status,
        reviewDecision: row.review_decision,
        approvalDecision: row.approval_decision,
      }));

    const recordIds = qualifying.map((row) => row.id);
    const instrumentIds = [...new Set(qualifying.map((row) => row.instrument_id))];

    const [{ data: instruments }, { data: extensions }, { data: monthlyReviews }] = await Promise.all([
      supabase.from('instruments').select('id, name').in('id', instrumentIds.length ? instrumentIds : ['00000000-0000-0000-0000-000000000000']),
      recordIds.length
        ? supabase.from('qc_corrective_actions').select('*').in('qc_record_id', recordIds).is('archived_at', null)
        : Promise.resolve({ data: [], error: null }),
      instrumentIds.length
        ? supabase
          .from('qc_corrective_action_monthly_reviews')
          .select('*')
          .eq('year', filters.year)
          .eq('month', filters.month)
          .in('instrument_id', instrumentIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const nameById = Object.fromEntries((instruments ?? []).map((i) => [i.id, i.name as string]));
    const extensionByRecord = Object.fromEntries(
      ((extensions ?? []) as ExtensionRow[]).map((row) => [row.qc_record_id, row]),
    );

    const latestMonthlyByInstrument = new Map<string, MonthlyReviewRow>();
    for (const review of (monthlyReviews ?? []) as MonthlyReviewRow[]) {
      const existing = latestMonthlyByInstrument.get(review.instrument_id);
      if (!existing || review.version_number > existing.version_number) {
        latestMonthlyByInstrument.set(review.instrument_id, review);
      }
    }

    const repeatedCounts = new Map<string, number>();
    for (const row of qualifying) {
      const key = repeatedFailureKey(row.instrument_id, row.test_name, row.control_level);
      repeatedCounts.set(key, (repeatedCounts.get(key) ?? 0) + 1);
    }

    let items = qualifying.map((row) => {
      const instrumentName = nameById[row.instrument_id] ?? 'Unknown Instrument';
      const repeatedCount = repeatedCounts.get(
        repeatedFailureKey(row.instrument_id, row.test_name, row.control_level),
      ) ?? 1;
      return mapWorklistItem(
        row,
        extensionByRecord[row.id],
        instrumentName,
        repeatedCount,
        latestMonthlyByInstrument.get(row.instrument_id),
      );
    });

    if (filters.alinityOnly) items = items.filter((item) => item.isAlinityHq);
    if (filters.qcMaterial) {
      const term = filters.qcMaterial.toLowerCase();
      items = items.filter((item) => item.qcMaterial.toLowerCase().includes(term));
    }
    if (filters.analyte) items = items.filter((item) => item.analyte === filters.analyte);
    if (filters.qcLevel) items = items.filter((item) => item.qcLevel === filters.qcLevel);
    if (filters.originalQcStatus) {
      items = items.filter((item) => item.originalQcStatus === filters.originalQcStatus);
    }
    if (filters.actionStatus) items = items.filter((item) => item.actionStatus === filters.actionStatus);
    if (filters.reviewerId) {
      items = items.filter((item) => {
        const review = latestMonthlyByInstrument.get(item.instrumentId);
        return review?.reviewed_by === filters.reviewerId;
      });
    }
    if (filters.approverId) {
      items = items.filter((item) => {
        const review = latestMonthlyByInstrument.get(item.instrumentId);
        return review?.approved_by === filters.approverId;
      });
    }
    if (filters.search?.trim()) {
      const term = filters.search.trim().toLowerCase();
      items = items.filter((item) =>
        item.instrumentName.toLowerCase().includes(term)
        || item.analyte.toLowerCase().includes(term)
        || item.qcMaterial.toLowerCase().includes(term)
        || item.operatorName?.toLowerCase().includes(term)
        || item.lotNumber?.toLowerCase().includes(term)
        || item.qcRecordId.toLowerCase().includes(term));
    }

    return { data: items, error: null };
  });
}

export async function fetchQcCorrectiveExtension(
  qcRecordId: string,
): Promise<ClinicalResult<QcCorrectiveActionExtension | null>> {
  return runClinicalMutation('Failed to load corrective action', async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('qc_corrective_actions')
      .select('*')
      .eq('qc_record_id', qcRecordId)
      .is('archived_at', null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { data: data ? mapExtension(data as ExtensionRow) : null, error: null };
  });
}

export async function saveQcCorrectiveAction(
  staff: StaffContext,
  qcRecordId: string,
  input: QcCorrectiveActionFormInput,
  context: {
    instrumentId: string;
    instrumentName: string;
    analyte: string;
    qcLevel: string;
    failedValue: string;
    operatorName?: string;
    operatorStaffId?: string;
    recordedAt: string;
    lotNumber?: string;
    expiryDate?: string;
    originalQcStatus: string;
    rangeMin?: number | null;
    rangeMax?: number | null;
    existingNotes?: string;
  },
): Promise<ClinicalResult<QcCorrectiveActionExtension>> {
  const validationError = validateCorrectiveActionInput(input);
  if (validationError) return { data: null, error: validationError };

  const parsed = parseCorrectedValue(input.correctedValue);
  const actionStatus = deriveActionStatus(input);
  const resultAfter = input.resultAfterAction
    ?? (parsed.numeric != null && context.rangeMin != null && context.rangeMax != null
      ? (parsed.numeric >= context.rangeMin && parsed.numeric <= context.rangeMax
        ? 'resolved_within_range'
        : 'still_out_of_range')
      : undefined);

  const remarks = [input.remarks?.trim(), context.existingNotes?.trim()].filter(Boolean).join('\n\n') || null;

  return runClinicalMutation('Failed to save corrective action', async () => {
    const supabase = createClient();
    const payload = {
      qc_record_id: qcRecordId,
      corrected_value: parsed.numeric ?? null,
      corrected_value_text: parsed.text ?? null,
      corrective_action_code: input.correctiveActionCode ?? null,
      corrective_action_text_snapshot: input.correctiveActionCode
        ? buildCorrectiveActionSnapshot(input.correctiveActionCode)
        : null,
      explanation: input.explanation?.trim() || null,
      remarks,
      result_after_action: resultAfter ?? null,
      action_status: actionStatus,
      completed_by: actionStatus === 'completed' ? staff.userId : null,
      completed_by_name: actionStatus === 'completed' ? staff.fullName : null,
      completed_by_staff_id: actionStatus === 'completed' ? (staff.staffId ?? null) : null,
      completed_at: actionStatus === 'completed' ? new Date().toISOString() : null,
    };

    const { data: existing } = await supabase
      .from('qc_corrective_actions')
      .select('id, action_status')
      .eq('qc_record_id', qcRecordId)
      .maybeSingle();

    let result;
    if (existing?.id) {
      result = await supabase
        .from('qc_corrective_actions')
        .update(payload)
        .eq('id', existing.id)
        .select('*')
        .single();
    } else {
      result = await supabase
        .from('qc_corrective_actions')
        .insert(payload)
        .select('*')
        .single();
    }

    if (result.error) throw new Error(result.error.message);

    await logAudit(staff, existing?.id ? 'CORRECTIVE_ACTION_UPDATED' : 'CORRECTIVE_ACTION_STARTED', {
      qcRecordId,
      oldStatus: existing?.action_status,
      newStatus: actionStatus,
      metadata: { correctiveActionCode: input.correctiveActionCode },
    });

    if (actionStatus === 'completed') {
      await logAudit(staff, 'CORRECTIVE_ACTION_COMPLETED', {
        qcRecordId,
        newStatus: actionStatus,
      });
    }

    return { data: mapExtension(result.data as ExtensionRow), error: null };
  });
}

export async function fetchMonthlyCorrectiveReview(
  year: number,
  month: number,
  instrumentId: string,
): Promise<ClinicalResult<QcCorrectiveMonthlyReview | null>> {
  return runClinicalMutation('Failed to load monthly review', async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('qc_corrective_action_monthly_reviews')
      .select('*')
      .eq('year', year)
      .eq('month', month)
      .eq('instrument_id', instrumentId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);

    let instrumentName: string | undefined;
    if (data) {
      const { data: instrument } = await supabase
        .from('instruments')
        .select('name')
        .eq('id', instrumentId)
        .maybeSingle();
      instrumentName = instrument?.name as string | undefined;
    }

    return {
      data: data ? mapMonthlyReview(data as MonthlyReviewRow, instrumentName) : null,
      error: null,
    };
  });
}

async function ensureMonthlyReview(
  year: number,
  month: number,
  instrumentId: string,
): Promise<MonthlyReviewRow> {
  const supabase = createClient();
  const existing = await supabase
    .from('qc_corrective_action_monthly_reviews')
    .select('*')
    .eq('year', year)
    .eq('month', month)
    .eq('instrument_id', instrumentId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.data) return existing.data as MonthlyReviewRow;

  const { data, error } = await supabase
    .from('qc_corrective_action_monthly_reviews')
    .insert({
      year,
      month,
      instrument_id: instrumentId,
      form_code: FORM_HEMA_016_CODE,
      qid: FORM_HEMA_016_QID,
      status: 'open',
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to create monthly review');
  return data as MonthlyReviewRow;
}

export async function markMonthlyCorrectiveReadyForReview(
  staff: StaffContext,
  year: number,
  month: number,
  instrumentId: string,
  items: QcCorrectiveWorklistItem[],
): Promise<ClinicalResult<QcCorrectiveMonthlyReview>> {
  if (!canMarkMonthReadyForReview(items)) {
    return { data: null, error: 'All qualifying QC OUT rows must have complete corrective actions before review.' };
  }

  return runClinicalMutation('Failed to mark month ready for review', async () => {
    const review = await ensureMonthlyReview(year, month, instrumentId);
    if (review.status === 'approved') {
      throw new Error(`An approved Form-Hema-016 already exists for ${monthName(month)} ${year}. Create an amendment instead.`);
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from('qc_corrective_action_monthly_reviews')
      .update({
        status: 'ready_for_review',
        prepared_by: staff.userId,
        prepared_by_name: staff.fullName,
        prepared_by_staff_id: staff.staffId ?? null,
        prepared_at: new Date().toISOString(),
      })
      .eq('id', review.id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    await logAudit(staff, 'MONTH_READY_FOR_REVIEW', {
      monthlyReviewId: review.id,
      oldStatus: review.status,
      newStatus: 'ready_for_review',
      metadata: { year, month, instrumentId },
    });

    return { data: mapMonthlyReview(data as MonthlyReviewRow), error: null };
  });
}

export async function reviewMonthlyCorrectiveAction(
  staff: StaffContext,
  reviewId: string,
  comment?: string,
): Promise<ClinicalResult<QcCorrectiveMonthlyReview>> {
  return runClinicalMutation('Failed to review monthly corrective action report', async () => {
    const supabase = createClient();
    const { data: existing, error: loadError } = await supabase
      .from('qc_corrective_action_monthly_reviews')
      .select('*')
      .eq('id', reviewId)
      .single();
    if (loadError || !existing) throw new Error(loadError?.message ?? 'Review not found');
    if (existing.status !== 'ready_for_review' && existing.status !== 'returned') {
      throw new Error('Monthly report is not ready for review.');
    }
    if (existing.prepared_by === staff.userId) {
      throw new Error('Prepared by and reviewer must be different users.');
    }

    const { data, error } = await supabase
      .from('qc_corrective_action_monthly_reviews')
      .update({
        status: 'reviewed',
        reviewed_by: staff.userId,
        reviewed_by_name: staff.fullName,
        reviewed_by_staff_id: staff.staffId ?? null,
        reviewed_at: new Date().toISOString(),
        review_comment: comment?.trim() || null,
      })
      .eq('id', reviewId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    await logAudit(staff, 'MONTH_REVIEWED', {
      monthlyReviewId: reviewId,
      oldStatus: existing.status as string,
      newStatus: 'reviewed',
      comment,
    });

    return { data: mapMonthlyReview(data as MonthlyReviewRow), error: null };
  });
}

export async function returnMonthlyCorrectiveAction(
  staff: StaffContext,
  reviewId: string,
  comment: string,
): Promise<ClinicalResult<QcCorrectiveMonthlyReview>> {
  if (!comment.trim()) return { data: null, error: 'Return comment is required.' };

  return runClinicalMutation('Failed to return monthly corrective action report', async () => {
    const supabase = createClient();
    const { data: existing } = await supabase
      .from('qc_corrective_action_monthly_reviews')
      .select('*')
      .eq('id', reviewId)
      .single();

    const { data, error } = await supabase
      .from('qc_corrective_action_monthly_reviews')
      .update({
        status: 'returned',
        review_comment: comment.trim(),
      })
      .eq('id', reviewId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    await logAudit(staff, 'MONTH_RETURNED', {
      monthlyReviewId: reviewId,
      oldStatus: existing?.status as string,
      newStatus: 'returned',
      comment,
    });

    return { data: mapMonthlyReview(data as MonthlyReviewRow), error: null };
  });
}

export async function approveMonthlyCorrectiveAction(
  staff: StaffContext,
  reviewId: string,
  items: QcCorrectiveWorklistItem[],
  comment?: string,
): Promise<ClinicalResult<QcCorrectiveMonthlyReview>> {
  const reviewResult = await fetchMonthlyCorrectiveReviewById(reviewId);
  if (reviewResult.error || !reviewResult.data) return { data: null, error: reviewResult.error ?? 'Review not found' };
  if (!canApproveMonth(items, reviewResult.data.status)) {
    return { data: null, error: 'Monthly approval blocked: incomplete rows or review step incomplete.' };
  }
  if (reviewResult.data.reviewedByUserId === staff.userId) {
    return { data: null, error: 'Reviewer and approver must be different users.' };
  }

  return runClinicalMutation('Failed to approve monthly corrective action report', async () => {
    const supabase = createClient();
    const review = reviewResult.data!;

    for (const item of items) {
      if (!item.extensionId) continue;
      await supabase
        .from('qc_corrective_actions')
        .update({
          instrument_id_snapshot: item.instrumentId,
          instrument_name_snapshot: item.instrumentName,
          qc_material_snapshot: item.qcMaterial,
          analyte_snapshot: item.analyte,
          qc_level_snapshot: item.qcLevel,
          failed_value_snapshot: item.failedValue,
          operator_name_snapshot: item.operatorName ?? null,
          operator_staff_id_snapshot: item.operatorStaffId ?? null,
          recorded_at_snapshot: item.recordedAt,
          lot_number_snapshot: item.lotNumber ?? null,
          expiry_date_snapshot: item.expiryDate ?? null,
          original_qc_status_snapshot: item.originalQcStatus,
          prepared_by: review.preparedByUserId ?? staff.userId,
          prepared_by_name: review.preparedByName ?? staff.fullName,
          prepared_by_staff_id: review.preparedByStaffId ?? staff.staffId ?? null,
          prepared_at: review.preparedAt ?? new Date().toISOString(),
        })
        .eq('id', item.extensionId);
    }

    const { data, error } = await supabase
      .from('qc_corrective_action_monthly_reviews')
      .update({
        status: 'approved',
        approved_by: staff.userId,
        approved_by_name: staff.fullName,
        approved_by_staff_id: staff.staffId ?? null,
        approved_at: new Date().toISOString(),
        approval_comment: comment?.trim() || null,
      })
      .eq('id', reviewId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    await logAudit(staff, 'MONTH_APPROVED', {
      monthlyReviewId: reviewId,
      oldStatus: review.status,
      newStatus: 'approved',
      comment,
      metadata: { year: review.year, month: review.month },
    });

    return { data: mapMonthlyReview(data as MonthlyReviewRow), error: null };
  });
}

async function fetchMonthlyCorrectiveReviewById(
  reviewId: string,
): Promise<ClinicalResult<QcCorrectiveMonthlyReview>> {
  return runClinicalMutation('Failed to load monthly review', async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('qc_corrective_action_monthly_reviews')
      .select('*')
      .eq('id', reviewId)
      .single();
    if (error) throw new Error(error.message);
    return { data: mapMonthlyReview(data as MonthlyReviewRow), error: null };
  });
}

export async function createMonthlyCorrectiveAmendment(
  staff: StaffContext,
  year: number,
  month: number,
  instrumentId: string,
  reason: string,
): Promise<ClinicalResult<QcCorrectiveMonthlyReview>> {
  if (!reason.trim()) return { data: null, error: 'Amendment reason is required.' };

  return runClinicalMutation('Failed to create monthly amendment', async () => {
    const supabase = createClient();
    const { data: latest } = await supabase
      .from('qc_corrective_action_monthly_reviews')
      .select('*')
      .eq('year', year)
      .eq('month', month)
      .eq('instrument_id', instrumentId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (latest?.version_number ?? 0) + 1;
    const { data, error } = await supabase
      .from('qc_corrective_action_monthly_reviews')
      .insert({
        year,
        month,
        instrument_id: instrumentId,
        form_code: FORM_HEMA_016_CODE,
        qid: FORM_HEMA_016_QID,
        status: 'open',
        version_number: nextVersion,
        parent_review_id: latest?.id ?? null,
        amendment_reason: reason.trim(),
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    await logAudit(staff, 'MONTH_AMENDMENT_CREATED', {
      monthlyReviewId: data.id as string,
      comment: reason,
      metadata: { parentReviewId: latest?.id, versionNumber: nextVersion },
    });

    return { data: mapMonthlyReview(data as MonthlyReviewRow), error: null };
  });
}

export function summarizeCorrectiveWorklist(items: QcCorrectiveWorklistItem[]): QcCorrectiveMonthSummary {
  return buildMonthSummary(items);
}

export async function fetchQcCorrectiveAuditEvents(opts?: {
  qcRecordId?: string;
  monthlyReviewId?: string;
  year?: number;
  month?: number;
}): Promise<ClinicalListResult<QcCorrectiveAuditEvent>> {
  return runClinicalListQuery('Failed to load audit trail', async () => {
    const supabase = createClient();
    let query = supabase
      .from('qc_corrective_action_audit_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (opts?.qcRecordId) query = query.eq('qc_record_id', opts.qcRecordId);
    if (opts?.monthlyReviewId) query = query.eq('monthly_review_id', opts.monthlyReviewId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const events = (data ?? []).map((row) => ({
      id: row.id as string,
      qcRecordId: row.qc_record_id as string | undefined,
      monthlyReviewId: row.monthly_review_id as string | undefined,
      userId: row.user_id as string | undefined,
      userName: row.user_name as string | undefined,
      staffId: row.staff_id as string | undefined,
      action: row.action as string,
      oldStatus: row.old_status as string | undefined,
      newStatus: row.new_status as string | undefined,
      comment: row.comment as string | undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdAt: row.created_at as string,
    }));

    return { data: events, error: null };
  });
}

export async function logForm016Printed(
  staff: StaffContext,
  opts: { year: number; month: number; instrumentId: string; monthlyReviewId?: string },
): Promise<void> {
  await logAudit(staff, 'FORM_016_PRINTED', {
    monthlyReviewId: opts.monthlyReviewId,
    metadata: opts,
  });
}

export async function logForm016Exported(
  staff: StaffContext,
  opts: { year: number; month: number; instrumentId: string; format: 'pdf' | 'excel' },
): Promise<void> {
  await logAudit(staff, 'FORM_016_EXPORTED', {
    metadata: opts,
  });
}

export function getCorrectiveActionStatusForQcRecord(
  extension: QcCorrectiveActionExtension | null | undefined,
  monthlyStatus?: QcCorrectiveMonthlyReview['status'],
): string {
  if (monthlyStatus === 'approved') return 'Approved';
  if (monthlyStatus === 'reviewed') return 'Reviewed';
  if (!extension) return 'Required';
  if (extension.actionStatus === 'completed') return 'Completed';
  if (extension.actionStatus === 'in_progress') return 'In Progress';
  return 'Required';
}
