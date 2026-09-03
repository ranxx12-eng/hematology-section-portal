import { createClient } from '@/lib/supabase/client';
import type { QCApprovalFormData, QCReviewFormData } from '@/lib/qc-records/review-schema';
import type { QCRecordFormData } from '@/lib/qc-records/schema';
import {
  getParametersForInstrument,
  isAllParametersSelection,
  QC_INSTRUMENT_DB_NAME_CANDIDATES,
  QC_INSTRUMENT_NAMES,
  resolveCanonicalQCInstrumentName,
} from '@/lib/qc-records/config';
import type { Instrument, QCRecord } from '@/types';
import type { StaffContext } from './staff-context';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface QCRecordRow {
  id: string;
  instrument_id: string;
  test_name: string;
  control_level: string;
  recorded_at: string;
  qc_frequency: QCRecord['qcFrequency'];
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
  review_status: QCRecord['reviewStatus'];
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_by_staff_id: string | null;
  reviewed_at: string | null;
  review_decision: QCRecord['reviewDecision'] | null;
  review_comment: string | null;
  approval_status: QCRecord['approvalStatus'];
  approved_by: string | null;
  approved_by_name: string | null;
  approved_by_staff_id: string | null;
  approved_at: string | null;
  approval_decision: QCRecord['approvalDecision'] | null;
  approval_comment: string | null;
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
    qcFrequency: row.qc_frequency ?? 'daily',
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
    reviewStatus: row.review_status ?? 'Pending Review',
    reviewedByUserId: row.reviewed_by ?? undefined,
    reviewedByName: row.reviewed_by_name ?? undefined,
    reviewedByStaffId: row.reviewed_by_staff_id ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    reviewDecision: row.review_decision ?? undefined,
    reviewComment: row.review_comment ?? undefined,
    approvalStatus: row.approval_status ?? 'Pending Approval',
    approvedByUserId: row.approved_by ?? undefined,
    approvedByName: row.approved_by_name ?? undefined,
    approvedByStaffId: row.approved_by_staff_id ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    approvalDecision: row.approval_decision ?? undefined,
    approvalComment: row.approval_comment ?? undefined,
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
    qc_frequency: form.qcFrequency,
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
    action_by_staff_id: isOut ? (staff.staffId ?? null) : null,
    resolved_at: isResolved && form.actionAt ? new Date(form.actionAt).toISOString() : null,
    resolved_by: isResolved ? staff.userId : null,
    resolved_by_name: isResolved ? staff.fullName : null,
    performed_by_user_id: staff.userId,
    performed_by_name: staff.fullName,
    performed_by_staff_id: staff.staffId ?? null,
    comment: form.comment?.trim() || null,
    review_status: 'Pending Review',
    approval_status: 'Pending Approval',
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
    qc_frequency: form.qcFrequency,
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
    action_by_staff_id: isOut ? (existing.actionByStaffId ?? staff.staffId ?? null) : null,
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
  const catalog = await fetchQCInstrumentCatalog();
  return catalog.map(({ id, name }) => ({ id, name }));
}

export interface QCInstrumentCatalogEntry {
  id: string;
  name: string;
  serialNumber?: string;
  model?: string;
  manufacturer?: string;
}

/** Single bounded read for QC instrument filters and controlled-form print metadata. */
export async function fetchQCInstrumentCatalog(): Promise<QCInstrumentCatalogEntry[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('instruments')
      .select('id, name, serial_number, model, manufacturer, active')
      .in('name', [...QC_INSTRUMENT_DB_NAME_CANDIDATES])
      .is('deleted_at', null)
      .order('name');

    if (error || !data) return [];

    const bestByCanonical = new Map<string, {
      id: string;
      dbName: string;
      serialNumber?: string;
      model?: string;
      manufacturer?: string;
    }>();

    for (const row of data) {
      if (row.active === false) continue;

      const dbName = row.name as string;
      const canonical = resolveCanonicalQCInstrumentName(dbName);
      if (!canonical) continue;

      const candidate = {
        id: row.id as string,
        dbName,
        serialNumber: (row.serial_number as string | null) ?? undefined,
        model: (row.model as string | null) ?? undefined,
        manufacturer: (row.manufacturer as string | null) ?? undefined,
      };

      const existing = bestByCanonical.get(canonical);
      if (!existing) {
        bestByCanonical.set(canonical, candidate);
        continue;
      }

      const existingExact = existing.dbName === canonical;
      const candidateExact = dbName === canonical;
      if (!existingExact && candidateExact) {
        bestByCanonical.set(canonical, candidate);
      }
    }

    return QC_INSTRUMENT_NAMES
      .filter((canonical) => bestByCanonical.has(canonical))
      .map((canonical) => {
        const match = bestByCanonical.get(canonical)!;
        return {
          id: match.id,
          name: canonical,
          serialNumber: match.serialNumber,
          model: match.model,
          manufacturer: match.manufacturer,
        };
      });
  } catch {
    return [];
  }
}

export function buildQCInstrumentLookup(catalog: QCInstrumentCatalogEntry[]): {
  instrumentOptions: { id: string; name: string }[];
  instrumentNames: Record<string, string>;
  instrumentsById: Record<string, Pick<Instrument, 'id' | 'name' | 'serialNumber' | 'model' | 'manufacturer'>>;
} {
  const instrumentOptions = catalog.map(({ id, name }) => ({ id, name }));
  const instrumentNames = Object.fromEntries(catalog.map(({ id, name }) => [id, name]));
  const instrumentsById = Object.fromEntries(
    catalog.map(({ id, name, serialNumber, model, manufacturer }) => [
      id,
      { id, name, serialNumber: serialNumber ?? '', model: model ?? '', manufacturer: manufacturer ?? '' },
    ]),
  );
  return { instrumentOptions, instrumentNames, instrumentsById };
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

export async function reviewQCRecord(
  id: string,
  staff: StaffContext,
  review: QCReviewFormData,
): Promise<ClinicalResult<QCRecord>> {
  const now = new Date().toISOString();
  const result = await runClinicalMutation('Failed to review QC record', async () => {
    const supabase = createClient();
    return supabase
      .from('qc_records')
      .update({
        review_status: 'Reviewed',
        review_decision: review.reviewDecision,
        review_comment: review.reviewComment?.trim() || null,
        reviewed_by: staff.userId,
        reviewed_by_name: staff.fullName,
        reviewed_by_staff_id: staff.staffId,
        reviewed_at: now,
      })
      .eq('id', id)
      .eq('review_status', 'Pending Review')
      .is('deleted_at', null)
      .select('*')
      .single();
  });

  return {
    data: result.data ? mapQCRecord(result.data as unknown as QCRecordRow) : null,
    error: result.error,
  };
}

export async function approveQCRecord(
  id: string,
  staff: StaffContext,
  approval: QCApprovalFormData,
): Promise<ClinicalResult<QCRecord>> {
  const now = new Date().toISOString();
  const result = await runClinicalMutation('Failed to approve QC record', async () => {
    const supabase = createClient();
    return supabase
      .from('qc_records')
      .update({
        approval_status: 'Approved',
        approval_decision: approval.approvalDecision,
        approval_comment: approval.approvalComment?.trim() || null,
        approved_by: staff.userId,
        approved_by_name: staff.fullName,
        approved_by_staff_id: staff.staffId,
        approved_at: now,
      })
      .eq('id', id)
      .eq('review_status', 'Reviewed')
      .eq('approval_status', 'Pending Approval')
      .is('deleted_at', null)
      .select('*')
      .single();
  });

  return {
    data: result.data ? mapQCRecord(result.data as unknown as QCRecordRow) : null,
    error: result.error,
  };
}
