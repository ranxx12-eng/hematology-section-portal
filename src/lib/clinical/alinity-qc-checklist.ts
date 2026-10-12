import { createClient } from '@/lib/supabase/client';
import { fetchQCRecords } from '@/lib/clinical/qc-records';
import { riyadhDateParts } from '@/lib/qc-records/alinity-checklist/calendar';
import type { ChecklistCvAttestation, ChecklistQcResult, ChecklistRunLink, RoutineRunSlot } from '@/lib/qc-records/alinity-checklist/aggregate';
import type { QCRecord } from '@/types';

export interface AlinityChecklistRecord {
  id: string;
  instrumentId: string;
  year: number;
  month: number;
  comment: string;
  status: 'open' | 'reviewed' | 'finalized';
  reviewedByName?: string;
  reviewedByStaffId?: string;
  reviewedAt?: string;
  supervisorName?: string;
  supervisorStaffId?: string;
  supervisorAt?: string;
  frozenEvidence: FrozenChecklistEvidence | null;
}

export interface FrozenChecklistEvidence {
  links: ChecklistRunLink[];
  attestations: ChecklistCvAttestation[];
  records: ChecklistQcResult[];
}

export interface AlinityChecklistBundle {
  checklist: AlinityChecklistRecord;
  links: ChecklistRunLink[];
  attestations: ChecklistCvAttestation[];
  records: QCRecord[];
  history: Array<{ id: string; year: number; month: number; status: AlinityChecklistRecord['status'] }>;
}

interface ChecklistRow {
  id: string;
  instrument_id: string;
  checklist_year: number;
  checklist_month: number;
  comment: string | null;
  status: AlinityChecklistRecord['status'];
  reviewed_by_name: string | null;
  reviewed_by_staff_id: string | null;
  reviewed_at: string | null;
  supervisor_name: string | null;
  supervisor_staff_id: string | null;
  supervisor_at: string | null;
  frozen_evidence: FrozenChecklistEvidence | null;
}

function mapChecklist(row: ChecklistRow): AlinityChecklistRecord {
  return {
    id: row.id,
    instrumentId: row.instrument_id,
    year: row.checklist_year,
    month: row.checklist_month,
    comment: row.comment ?? '',
    status: row.status,
    reviewedByName: row.reviewed_by_name ?? undefined,
    reviewedByStaffId: row.reviewed_by_staff_id ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    supervisorName: row.supervisor_name ?? undefined,
    supervisorStaffId: row.supervisor_staff_id ?? undefined,
    supervisorAt: row.supervisor_at ?? undefined,
    frozenEvidence: row.frozen_evidence,
  };
}

function inMonth(record: QCRecord, year: number, month: number): boolean {
  const parts = riyadhDateParts(record.recordedAt);
  return parts.year === year && parts.month === month;
}

export function frozenRecordsToQc(records: ChecklistQcResult[]): QCRecord[] {
  return records.map((record) => ({
    id: record.id,
    instrumentId: record.instrumentId,
    parameter: record.parameter,
    level: record.level,
    recordedAt: record.recordedAt,
    qcFrequency: record.qcFrequency ?? 'daily',
    qcStatus: record.qcStatus,
    qcBatchId: record.qcBatchId,
    correctiveActions: record.correctiveActions ?? [],
    correctiveActionComment: record.correctiveActionComment,
    correctiveActionOther: record.correctiveActionOther,
    resolutionStatus: record.resolutionStatus,
    performedByUserId: record.performedByUserId,
    performedByName: record.performedByName,
    performedByStaffId: record.performedByStaffId,
    comment: record.comment,
    lotNumber: record.lotNumber,
    expiryDate: record.expiryDate,
    actionAt: record.actionAt,
    actionByName: record.actionByName,
    actionByStaffId: record.actionByStaffId,
    resolvedAt: record.resolvedAt,
    resolvedByName: record.resolvedByName,
    reviewStatus: record.reviewStatus,
    reviewedByUserId: record.reviewedByUserId,
    reviewedByName: record.reviewedByName,
    reviewedByStaffId: record.reviewedByStaffId,
    reviewedAt: record.reviewedAt,
    reviewDecision: record.reviewDecision,
    reviewComment: record.reviewComment,
    approvalStatus: record.approvalStatus === 'Approved' ? 'Approved' : 'Pending Approval',
    approvedByName: record.approvedByName,
    approvedByStaffId: record.approvedByStaffId,
    approvedAt: record.approvedAt,
    approvalDecision: record.approvalDecision,
    approvalComment: record.approvalComment,
    createdAt: record.recordedAt,
    updatedAt: record.recordedAt,
  }));
}

async function callRpc(name: string, args: Record<string, unknown>): Promise<string | null> {
  const supabase = createClient();
  const { error } = await supabase.rpc(name, args);
  return error?.message ?? null;
}

export async function loadAlinityChecklist(
  instrumentId: string,
  year: number,
  month: number,
): Promise<{ data: AlinityChecklistBundle | null; error: string | null }> {
  const supabase = createClient();
  const ensured = await supabase.rpc('ensure_alinity_qc_checklist', {
    p_instrument_id: instrumentId,
    p_year: year,
    p_month: month,
  });
  if (ensured.error || !ensured.data) {
    return { data: null, error: ensured.error?.message ?? 'Checklist could not be opened' };
  }
  const checklistId = ensured.data as string;
  const [checklistResult, linkResult, attestationResult, historyResult, qcResult] = await Promise.all([
    supabase.from('alinity_qc_checklists').select('*').eq('id', checklistId).single(),
    supabase.from('alinity_qc_run_links').select('day_of_month, run_slot, qc_batch_id').eq('checklist_id', checklistId),
    supabase.from('alinity_qc_cv_attestations').select('day_of_month, attested_by, attested_by_name, attested_by_staff_id, attested_at').eq('checklist_id', checklistId),
    supabase.from('alinity_qc_checklists').select('id, checklist_year, checklist_month, status').eq('instrument_id', instrumentId).order('checklist_year', { ascending: false }).order('checklist_month', { ascending: false }),
    fetchQCRecords(),
  ]);
  if (checklistResult.error || !checklistResult.data) {
    return { data: null, error: checklistResult.error?.message ?? 'Checklist could not be opened' };
  }
  const checklist = mapChecklist(checklistResult.data as ChecklistRow);
  const liveLinks: ChecklistRunLink[] = ((linkResult.data ?? []) as Array<{ day_of_month: number; run_slot: RoutineRunSlot; qc_batch_id: string }>).map((link) => ({
    day: link.day_of_month,
    slot: link.run_slot,
    qcBatchId: link.qc_batch_id,
  }));
  const liveAttestations: ChecklistCvAttestation[] = ((attestationResult.data ?? []) as Array<{
    day_of_month: number;
    attested_by: string;
    attested_by_name: string;
    attested_by_staff_id: string | null;
    attested_at: string;
  }>).map((row) => ({
    day: row.day_of_month,
    attestedByUserId: row.attested_by,
    attestedByName: row.attested_by_name,
    attestedByStaffId: row.attested_by_staff_id ?? undefined,
    attestedAt: row.attested_at,
  }));
  const liveRecords = (qcResult.data ?? []).filter((record) => record.instrumentId === instrumentId && inMonth(record, year, month));
  const finalized = checklist.status === 'finalized' && checklist.frozenEvidence;
  return {
    data: {
      checklist,
      links: finalized ? checklist.frozenEvidence?.links ?? [] : liveLinks,
      attestations: finalized ? checklist.frozenEvidence?.attestations ?? [] : liveAttestations,
      records: finalized ? frozenRecordsToQc(checklist.frozenEvidence?.records ?? []) : liveRecords,
      history: ((historyResult.data ?? []) as Array<{ id: string; checklist_year: number; checklist_month: number; status: AlinityChecklistRecord['status'] }>).map((row) => ({
        id: row.id,
        year: row.checklist_year,
        month: row.checklist_month,
        status: row.status,
      })),
    },
    error: linkResult.error?.message ?? attestationResult.error?.message ?? qcResult.error ?? null,
  };
}

export async function placeRecordedAlinityRun(input: {
  instrumentId: string;
  recordedAt: string;
  slot: RoutineRunSlot;
  qcBatchId: string;
}): Promise<string | null> {
  const parts = riyadhDateParts(input.recordedAt);
  const supabase = createClient();
  const ensured = await supabase.rpc('ensure_alinity_qc_checklist', {
    p_instrument_id: input.instrumentId,
    p_year: parts.year,
    p_month: parts.month,
  });
  if (ensured.error || !ensured.data) return ensured.error?.message ?? 'Checklist could not be opened';
  return associateAlinityRun(ensured.data as string, parts.day, input.slot, input.qcBatchId);
}

export async function associateAlinityRun(
  checklistId: string,
  day: number,
  slot: RoutineRunSlot,
  qcBatchId: string,
): Promise<string | null> {
  return callRpc('associate_alinity_qc_run', {
    p_checklist_id: checklistId,
    p_day: day,
    p_run_slot: slot,
    p_qc_batch_id: qcBatchId,
  });
}

export async function attestAlinityCv(checklistId: string, day: number): Promise<string | null> {
  return callRpc('attest_alinity_qc_cv', { p_checklist_id: checklistId, p_day: day });
}

export async function saveAlinityChecklistComment(checklistId: string, comment: string): Promise<string | null> {
  return callRpc('set_alinity_qc_checklist_comment', { p_checklist_id: checklistId, p_comment: comment });
}

export async function reviewAlinityChecklist(checklistId: string): Promise<string | null> {
  return callRpc('review_alinity_qc_checklist', { p_checklist_id: checklistId });
}

export async function signAlinityChecklist(checklistId: string): Promise<string | null> {
  return callRpc('sign_alinity_qc_checklist_supervisor', { p_checklist_id: checklistId });
}

export async function reopenAlinityChecklist(checklistId: string, reason: string): Promise<string | null> {
  return callRpc('reopen_alinity_qc_checklist', { p_checklist_id: checklistId, p_reason: reason });
}
