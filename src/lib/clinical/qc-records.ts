import { createClient } from '@/lib/supabase/client';
import type { QCRecordFormData } from '@/lib/qc-records/schema';
import {
  getParametersForInstrument,
  isAllParametersSelection,
  QC_INSTRUMENT_NAMES,
} from '@/lib/qc-records/config';
import type { QCRecord } from '@/types';
import type { StaffContext } from './staff-context';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface QCRecordRow {
  id: string;
  instrument_id: string;
  test_name: string;
  control_level: string;
  recorded_at: string;
  qc_status: QCRecord['qcStatus'];
  corrective_actions: string[];
  corrective_action_comment: string | null;
  corrective_action_other: string | null;
  resolution_status: QCRecord['resolutionStatus'] | null;
  action_at: string | null;
  action_by: string | null;
  action_by_name: string | null;
  action_by_staff_id: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolved_by_name: string | null;
  performed_by_user_id: string | null;
  performed_by_name: string | null;
  performed_by_staff_id: string | null;
  comment: string | null;
  qc_batch_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapQCRecord(row: QCRecordRow): QCRecord {
  return {
    id: row.id,
    instrumentId: row.instrument_id,
    parameter: row.test_name,
    level: row.control_level,
    recordedAt: row.recorded_at,
    qcStatus: row.qc_status,
    correctiveActions: row.corrective_actions ?? [],
    correctiveActionComment: row.corrective_action_comment ?? undefined,
    correctiveActionOther: row.corrective_action_other ?? undefined,
    resolutionStatus: row.resolution_status ?? undefined,
    actionAt: row.action_at ?? undefined,
    actionByUserId: row.action_by ?? undefined,
    actionByName: row.action_by_name ?? undefined,
    actionByStaffId: row.action_by_staff_id ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    resolvedByUserId: row.resolved_by ?? undefined,
    resolvedByName: row.resolved_by_name ?? undefined,
    performedByUserId: row.performed_by_user_id ?? undefined,
    performedByName: row.performed_by_name ?? undefined,
    performedByStaffId: row.performed_by_staff_id ?? undefined,
    comment: row.comment ?? undefined,
    qcBatchId: row.qc_batch_id ?? undefined,
    createdByUserId: row.created_by ?? undefined,
    updatedByUserId: row.updated_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formToInsertRow(form: QCRecordFormData, staff: StaffContext, options?: {
  parameter?: string;
  qcStatus?: QCRecord['qcStatus'];
  qcBatchId?: string;
}) {
  const parameter = options?.parameter ?? form.parameter;
  const qcStatus = options?.qcStatus ?? form.qcStatus;
  const isOut = qcStatus === 'OUT';
  const isResolved = isOut && form.repeatQcStatus === 'IN';

  return {
    instrument_id: form.instrumentId,
    test_name: parameter,
    control_level: form.level || '',
    recorded_at: new Date(form.recordedAt).toISOString(),
    qc_status: qcStatus,
    qc_batch_id: options?.qcBatchId ?? null,
    corrective_actions: isOut ? form.correctiveActions : [],
    corrective_action_comment: isOut ? (form.correctiveActionComment?.trim() || null) : null,
    corrective_action_other: isOut && form.correctiveActions.includes('Other')
      ? (form.correctiveActionOther?.trim() || null)
      : null,
    resolution_status: isOut ? form.repeatQcStatus : null,
    action_at: isOut && form.actionAt ? new Date(form.actionAt).toISOString() : null,
    action_by: isOut ? staff.userId : null,
    action_by_name: isOut ? staff.fullName : null,
    action_by_staff_id: isOut ? staff.staffId : null,
    resolved_at: isResolved && form.actionAt ? new Date(form.actionAt).toISOString() : null,
    resolved_by: isResolved ? staff.userId : null,
    resolved_by_name: isResolved ? staff.fullName : null,
    performed_by_user_id: staff.userId,
    performed_by_name: staff.fullName,
    performed_by_staff_id: staff.staffId,
    comment: form.comment?.trim() || null,
    created_by: staff.userId,
    updated_by: staff.userId,
  };
}

function formToUpdateRow(form: QCRecordFormData, staff: StaffContext, existing: QCRecord) {
  const isOut = form.qcStatus === 'OUT';
  const isResolved = isOut && form.repeatQcStatus === 'IN';

  return {
    instrument_id: form.instrumentId,
    test_name: form.parameter,
    control_level: form.level || '',
    recorded_at: new Date(form.recordedAt).toISOString(),
    qc_status: form.qcStatus,
    corrective_actions: isOut ? form.correctiveActions : [],
    corrective_action_comment: isOut ? (form.correctiveActionComment?.trim() || null) : null,
    corrective_action_other: isOut && form.correctiveActions.includes('Other')
      ? (form.correctiveActionOther?.trim() || null)
      : null,
    resolution_status: isOut ? form.repeatQcStatus : null,
    action_at: isOut && form.actionAt ? new Date(form.actionAt).toISOString() : null,
    action_by: isOut ? (existing.actionByUserId ?? staff.userId) : null,
    action_by_name: isOut ? (existing.actionByName ?? staff.fullName) : null,
    action_by_staff_id: isOut ? (existing.actionByStaffId ?? staff.staffId) : null,
    resolved_at: isResolved
      ? (existing.resolvedAt ?? (form.actionAt ? new Date(form.actionAt).toISOString() : new Date().toISOString()))
      : null,
    resolved_by: isResolved ? (existing.resolvedByUserId ?? staff.userId) : null,
    resolved_by_name: isResolved ? (existing.resolvedByName ?? staff.fullName) : null,
    comment: form.comment?.trim() || null,
    updated_by: staff.userId,
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

export async function createQCRecord(
  staff: StaffContext,
  form: QCRecordFormData,
): Promise<ClinicalResult<QCRecord>> {
  return runClinicalMutation('Failed to create QC record', async () => {
    const supabase = createClient();
    return supabase
      .from('qc_records')
      .insert(formToInsertRow(form, staff))
      .select('*')
      .single();
  }).then((result) => ({
    data: result.data ? mapQCRecord(result.data as unknown as QCRecordRow) : null,
    error: result.error,
  }));
}

export interface QCBatchCreateResult {
  records: QCRecord[];
  count: number;
}

export async function createQCRecordBatch(
  staff: StaffContext,
  form: QCRecordFormData,
): Promise<ClinicalResult<QCBatchCreateResult>> {
  const batchId = crypto.randomUUID();
  const activeParams = getParametersForInstrument(form.instrumentName).map((p) => p.name);

  const outSet = form.qcStatus === 'OUT'
    ? new Set(form.markAllOut ? activeParams : form.outParameters)
    : new Set<string>();

  const rows = activeParams.map((parameter) => {
    const qcStatus = form.qcStatus === 'OUT' && outSet.has(parameter) ? 'OUT' : 'IN';
    return formToInsertRow(form, staff, { parameter, qcStatus, qcBatchId: batchId });
  });

  const result = await runClinicalMutation('Failed to create QC records', async () => {
    const supabase = createClient();
    return supabase
      .from('qc_records')
      .insert(rows)
      .select('*');
  });

  const records = (result.data as unknown as QCRecordRow[] | null)?.map(mapQCRecord) ?? [];

  return {
    data: result.error ? null : { records, count: records.length },
    error: result.error,
  };
}

export function shouldUseBatchCreate(form: QCRecordFormData): boolean {
  return isAllParametersSelection(form.parameter);
}

export async function updateQCRecord(
  id: string,
  staff: StaffContext,
  form: QCRecordFormData,
  existing: QCRecord,
): Promise<ClinicalResult<QCRecord>> {
  return runClinicalMutation('Failed to update QC record', async () => {
    const supabase = createClient();
    return supabase
      .from('qc_records')
      .update(formToUpdateRow(form, staff, existing))
      .eq('id', id)
      .is('deleted_at', null)
      .select('*')
      .single();
  }).then((result) => ({
    data: result.data ? mapQCRecord(result.data as unknown as QCRecordRow) : null,
    error: result.error,
  }));
}

export async function fetchQCInstruments(): Promise<{ id: string; name: string }[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('instruments')
      .select('id, name')
      .in('name', [...QC_INSTRUMENT_NAMES])
      .is('deleted_at', null)
      .order('name');

    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

export async function fetchInstrumentNameMap(): Promise<Record<string, string>> {
  const instruments = await fetchQCInstruments();
  return Object.fromEntries(instruments.map((row) => [row.id, row.name]));
}

export interface QCSummaryStats {
  qcRuns: number;
  parameterResults: number;
  inCount: number;
  outCount: number;
  unresolvedOut: number;
  outPercent: number;
}

type QCSummaryInput = Pick<QCRecord, 'qcStatus' | 'resolutionStatus' | 'qcBatchId'>;

export function computeQCSummary(records: QCSummaryInput[]): QCSummaryStats {
  const batchIds = new Set<string>();
  let individualRuns = 0;

  for (const record of records) {
    if (record.qcBatchId) {
      batchIds.add(record.qcBatchId);
    } else {
      individualRuns += 1;
    }
  }

  const qcRuns = batchIds.size + individualRuns;
  const parameterResults = records.length;
  const inCount = records.filter((r) => r.qcStatus === 'IN').length;
  const outCount = records.filter((r) => r.qcStatus === 'OUT').length;
  const unresolvedOut = records.filter(
    (r) => r.qcStatus === 'OUT' && r.resolutionStatus !== 'IN',
  ).length;
  const outPercent = parameterResults === 0
    ? 0
    : Number(((outCount / parameterResults) * 100).toFixed(1));

  return { qcRuns, parameterResults, inCount, outCount, unresolvedOut, outPercent };
}
