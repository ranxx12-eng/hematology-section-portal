import { createClient } from '@/lib/supabase/client';
import {
  ACCEPTABLE_FINAL_DECISIONS,
  buildQcVerificationContextKey,
  CBC_RUN_DAYS,
  CBC_RUNS_PER_DAY,
  CBC_VERIFICATION_PARAMETERS,
} from '@/lib/qc-lot-verification/constants';
import {
  buildParameterSummary,
  buildRunProgress,
  calculateCbcParameter,
  canSubmitCbcVerification,
  isStudyVerifiedForUse,
} from '@/lib/qc-lot-verification/cbc-calculation';
import { logInventoryAudit } from '@/lib/clinical/inventory-audit';
import type {
  QcLotVerificationLookupResult,
  QcLotVerificationParameter,
  QcLotVerificationRun,
  QcLotVerificationStudy,
  QcVerificationFinalDecision,
  QcVerificationStudyStatus,
  QcVerificationType,
} from '@/types/qc-lot-verification';
import type { StaffContext } from './staff-context';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

async function generateStudyNumber(type: QcVerificationType): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = type === 'cbc' ? 'QCV-CBC' : 'QCV-COA';
  const supabase = createClient();
  const { count } = await supabase
    .from('qc_lot_verification_studies')
    .select('*', { count: 'exact', head: true })
    .like('study_number', `${prefix}-${year}-%`);
  return `${prefix}-${year}-${String((count ?? 0) + 1).padStart(3, '0')}`;
}

function mapRun(row: Record<string, unknown>): QcLotVerificationRun {
  return {
    id: row.id as string,
    studyId: row.study_id as string,
    dayNumber: Number(row.day_number),
    runNumber: Number(row.run_number),
    completed: Boolean(row.completed),
    completedByName: (row.completed_by_name as string | null) ?? undefined,
    completedAt: (row.completed_at as string | null) ?? undefined,
  };
}

function mapParameter(row: Record<string, unknown>): QcLotVerificationParameter {
  return {
    id: row.id as string,
    studyId: row.study_id as string,
    parameterCode: row.parameter_code as string,
    parameterName: row.parameter_name as string,
    displayOrder: Number(row.display_order),
    manufacturerMean: row.manufacturer_mean != null ? Number(row.manufacturer_mean) : undefined,
    manufacturerSd: row.manufacturer_sd != null ? Number(row.manufacturer_sd) : undefined,
    establishedMean: row.established_mean != null ? Number(row.established_mean) : undefined,
    establishedSd: row.established_sd != null ? Number(row.established_sd) : undefined,
    manufacturerLower: row.manufacturer_lower != null ? Number(row.manufacturer_lower) : undefined,
    manufacturerUpper: row.manufacturer_upper != null ? Number(row.manufacturer_upper) : undefined,
    establishedLower: row.established_lower != null ? Number(row.established_lower) : undefined,
    establishedUpper: row.established_upper != null ? Number(row.established_upper) : undefined,
    difference: row.difference != null ? Number(row.difference) : undefined,
    sdi: row.sdi != null ? Number(row.sdi) : undefined,
    result: row.result as QcLotVerificationParameter['result'],
  };
}

function mapStudy(
  row: Record<string, unknown>,
  runs: QcLotVerificationRun[],
  parameters: QcLotVerificationParameter[],
): QcLotVerificationStudy {
  return {
    id: row.id as string,
    studyNumber: row.study_number as string,
    verificationType: row.verification_type as QcVerificationType,
    status: row.status as QcVerificationStudyStatus,
    qcMaterialName: row.qc_material_name as string,
    qcMaterialCode: (row.qc_material_code as string | null) ?? undefined,
    lotNumber: row.lot_number as string,
    inventoryItemId: (row.inventory_item_id as string | null) ?? undefined,
    instrumentId: (row.instrument_id as string | null) ?? undefined,
    instrumentNameSnapshot: (row.instrument_name_snapshot as string | null) ?? undefined,
    contextKey: row.context_key as string,
    studyDate: (row.study_date as string | null) ?? undefined,
    finalDecision: (row.final_decision as QcVerificationFinalDecision | null) ?? undefined,
    finalDecisionNotes: (row.final_decision_notes as string | null) ?? undefined,
    evidenceRefs: (row.evidence_refs as QcLotVerificationStudy['evidenceRefs']) ?? [],
    preparedByName: (row.prepared_by_name as string | null) ?? undefined,
    reviewedByName: (row.reviewed_by_name as string | null) ?? undefined,
    approvedByName: (row.approved_by_name as string | null) ?? undefined,
    rejectedByName: (row.rejected_by_name as string | null) ?? undefined,
    rejectionComment: (row.rejection_comment as string | null) ?? undefined,
    runs,
    parameters,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

async function fetchStudyParts(studyId: string) {
  const supabase = createClient();
  const [runsRes, paramsRes] = await Promise.all([
    supabase.from('qc_lot_verification_runs').select('*').eq('study_id', studyId).order('day_number').order('run_number'),
    supabase.from('qc_lot_verification_parameters').select('*').eq('study_id', studyId).order('display_order'),
  ]);
  return {
    runs: (runsRes.data ?? []).map((r) => mapRun(r as Record<string, unknown>)),
    parameters: (paramsRes.data ?? []).map((p) => mapParameter(p as Record<string, unknown>)),
  };
}

export interface CreateQcLotVerificationInput {
  verificationType: QcVerificationType;
  qcMaterialName: string;
  lotNumber: string;
  inventoryItemId?: string;
  instrumentId?: string;
  instrumentName?: string;
  studyDate?: string;
}

export async function fetchQcLotVerificationStudies(
  type?: QcVerificationType,
): Promise<ClinicalListResult<QcLotVerificationStudy>> {
  return runClinicalListQuery('Failed to load QC lot verification studies', async () => {
    const supabase = createClient();
    let q = supabase
      .from('qc_lot_verification_studies')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (type) q = q.eq('verification_type', type);
    return q;
  }).then(async (result) => {
    const studies: QcLotVerificationStudy[] = [];
    for (const row of result.data as Array<Record<string, unknown>>) {
      const parts = await fetchStudyParts(row.id as string);
      studies.push(mapStudy(row, parts.runs, parts.parameters));
    }
    return { data: studies, error: result.error };
  });
}

export async function fetchQcLotVerificationById(id: string): Promise<ClinicalResult<QcLotVerificationStudy>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('qc_lot_verification_studies')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error || !data) return { data: null, error: error?.message ?? 'Study not found' };
  const parts = await fetchStudyParts(id);
  return { data: mapStudy(data as Record<string, unknown>, parts.runs, parts.parameters), error: null };
}

export async function createQcLotVerificationStudy(
  staff: StaffContext,
  input: CreateQcLotVerificationInput,
): Promise<ClinicalResult<QcLotVerificationStudy>> {
  if (input.verificationType === 'coagulation') {
    return { data: null, error: 'Coagulation QC Verification is not yet implemented.' };
  }

  const contextKey = buildQcVerificationContextKey({
    verificationType: input.verificationType,
    qcMaterialName: input.qcMaterialName,
    lotNumber: input.lotNumber,
    instrumentId: input.instrumentId,
  });

  const supabase = createClient();
  const { data: existing } = await supabase
    .from('qc_lot_verification_studies')
    .select('id, study_number, status')
    .eq('context_key', contextKey)
    .is('deleted_at', null)
    .in('status', ['draft', 'runs_completed', 'pending_review', 'pending_approval'])
    .maybeSingle();

  if (existing) {
    return {
      data: null,
      error: `QC Lot Verification already in progress (${existing.study_number as string}). Continue the existing study instead of creating a duplicate.`,
    };
  }

  const studyNumber = await generateStudyNumber(input.verificationType);
  const insertResult = await runClinicalMutation('Failed to create verification study', async () =>
    supabase
      .from('qc_lot_verification_studies')
      .insert({
        study_number: studyNumber,
        verification_type: input.verificationType,
        qc_material_name: input.qcMaterialName.trim(),
        lot_number: input.lotNumber.trim(),
        inventory_item_id: input.inventoryItemId ?? null,
        instrument_id: input.instrumentId ?? null,
        instrument_name_snapshot: input.instrumentName ?? null,
        context_key: contextKey,
        study_date: input.studyDate ?? null,
        created_by: staff.userId,
        updated_by: staff.userId,
      })
      .select('*')
      .single(),
  );

  if (!insertResult.data) return { data: null, error: insertResult.error };
  const studyId = (insertResult.data as { id: string }).id;

  const runRows = [];
  for (let day = 1; day <= CBC_RUN_DAYS; day += 1) {
    for (let run = 1; run <= CBC_RUNS_PER_DAY; run += 1) {
      runRows.push({ study_id: studyId, day_number: day, run_number: run });
    }
  }
  await supabase.from('qc_lot_verification_runs').insert(runRows);

  const paramRows = CBC_VERIFICATION_PARAMETERS.map((p, i) => ({
    study_id: studyId,
    parameter_code: p.code,
    parameter_name: p.name,
    display_order: i + 1,
  }));
  await supabase.from('qc_lot_verification_parameters').insert(paramRows);

  await logInventoryAudit(staff, {
    entityType: 'qc_lot_verification',
    entityId: studyId,
    inventoryItemId: input.inventoryItemId,
    lotNumber: input.lotNumber,
    action: 'VERIFICATION_STUDY_CREATED',
    metadata: { verificationType: input.verificationType, contextKey },
  });

  return fetchQcLotVerificationById(studyId);
}

export async function toggleQcVerificationRun(
  staff: StaffContext,
  studyId: string,
  runId: string,
  completed: boolean,
): Promise<ClinicalResult<QcLotVerificationStudy>> {
  const current = await fetchQcLotVerificationById(studyId);
  if (!current.data) return current;
  if (!['draft', 'runs_completed'].includes(current.data.status)) {
    return { data: null, error: 'Run tracking is locked after submission.' };
  }

  const run = current.data.runs.find((r) => r.id === runId);
  if (!run) return { data: null, error: 'Run not found' };

  const supabase = createClient();
  const result = await runClinicalMutation('Failed to update run', async () =>
    supabase
      .from('qc_lot_verification_runs')
      .update({
        completed,
        completed_by: completed ? staff.userId : null,
        completed_by_name: completed ? staff.fullName : null,
        completed_by_staff_id: completed ? staff.staffId ?? null : null,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq('id', runId)
      .select('*')
      .single(),
  );

  if (result.error) return { data: null, error: result.error };

  await logInventoryAudit(staff, {
    entityType: 'qc_lot_verification',
    entityId: studyId,
    lotNumber: current.data.lotNumber,
    action: completed ? 'RUN_MARKED_COMPLETE' : 'RUN_COMPLETION_CORRECTED',
    metadata: { dayNumber: run.dayNumber, runNumber: run.runNumber, completed },
  });

  const refreshed = await fetchQcLotVerificationById(studyId);
  if (refreshed.data) {
    const progress = buildRunProgress(refreshed.data.runs);
    const nextStatus: QcVerificationStudyStatus = progress.runsComplete ? 'runs_completed' : 'draft';
    if (refreshed.data.status !== nextStatus && ['draft', 'runs_completed'].includes(refreshed.data.status)) {
      await supabase.from('qc_lot_verification_studies').update({ status: nextStatus, updated_by: staff.userId }).eq('id', studyId);
      return fetchQcLotVerificationById(studyId);
    }
  }
  return refreshed;
}

export async function saveQcVerificationParameters(
  staff: StaffContext,
  studyId: string,
  inputs: Array<{
    id: string;
    manufacturerMean?: number | null;
    manufacturerSd?: number | null;
    establishedMean?: number | null;
    establishedSd?: number | null;
  }>,
): Promise<ClinicalResult<QcLotVerificationStudy>> {
  const current = await fetchQcLotVerificationById(studyId);
  if (!current.data) return current;
  const progress = buildRunProgress(current.data.runs);
  if (!progress.runsComplete) {
    return { data: null, error: 'Complete all 20 runs before entering analyzer summary values.' };
  }
  if (!['draft', 'runs_completed'].includes(current.data.status)) {
    return { data: null, error: 'Parameter entry is locked after submission.' };
  }

  const supabase = createClient();
  for (const input of inputs) {
    const calc = calculateCbcParameter({
      manufacturerMean: input.manufacturerMean,
      manufacturerSd: input.manufacturerSd,
      establishedMean: input.establishedMean,
      establishedSd: input.establishedSd,
    });
    await supabase.from('qc_lot_verification_parameters').update({
      manufacturer_mean: input.manufacturerMean,
      manufacturer_sd: input.manufacturerSd,
      established_mean: input.establishedMean,
      established_sd: input.establishedSd,
      manufacturer_lower: calc.manufacturerLower ?? null,
      manufacturer_upper: calc.manufacturerUpper ?? null,
      established_lower: calc.establishedLower ?? null,
      established_upper: calc.establishedUpper ?? null,
      difference: calc.difference ?? null,
      sdi: calc.sdi ?? null,
      result: calc.result,
    }).eq('id', input.id);
  }

  await supabase.from('qc_lot_verification_studies').update({ updated_by: staff.userId }).eq('id', studyId);
  await logInventoryAudit(staff, {
    entityType: 'qc_lot_verification',
    entityId: studyId,
    lotNumber: current.data.lotNumber,
    action: 'PARAMETER_VALUES_SAVED',
  });

  return fetchQcLotVerificationById(studyId);
}

export async function saveQcVerificationFinalDecision(
  staff: StaffContext,
  studyId: string,
  finalDecision: QcVerificationFinalDecision,
  notes?: string,
): Promise<ClinicalResult<QcLotVerificationStudy>> {
  const current = await fetchQcLotVerificationById(studyId);
  if (!current.data) return current;
  if (!['draft', 'runs_completed'].includes(current.data.status)) {
    return { data: null, error: 'Final decision is locked after submission.' };
  }

  const supabase = createClient();
  await supabase.from('qc_lot_verification_studies').update({
    final_decision: finalDecision,
    final_decision_notes: notes ?? null,
    updated_by: staff.userId,
  }).eq('id', studyId);

  await logInventoryAudit(staff, {
    entityType: 'qc_lot_verification',
    entityId: studyId,
    action: 'FINAL_DECISION_CHANGED',
    metadata: { finalDecision },
  });

  return fetchQcLotVerificationById(studyId);
}

export async function submitQcLotVerification(
  staff: StaffContext,
  studyId: string,
): Promise<ClinicalResult<QcLotVerificationStudy>> {
  const current = await fetchQcLotVerificationById(studyId);
  if (!current.data) return current;

  const validation = canSubmitCbcVerification(current.data.runs, current.data.parameters);
  if (!validation.ok) return { data: null, error: validation.reason ?? 'Cannot submit' };
  if (!current.data.finalDecision) {
    return { data: null, error: 'Select a final decision before submitting.' };
  }

  const supabase = createClient();
  const result = await runClinicalMutation('Failed to submit study', async () =>
    supabase
      .from('qc_lot_verification_studies')
      .update({
        status: 'pending_review',
        prepared_by: staff.userId,
        prepared_by_name: staff.fullName,
        prepared_by_staff_id: staff.staffId ?? null,
        prepared_at: new Date().toISOString(),
        updated_by: staff.userId,
      })
      .eq('id', studyId)
      .select('*')
      .single(),
  );
  if (result.error) return { data: null, error: result.error };

  await logInventoryAudit(staff, {
    entityType: 'qc_lot_verification',
    entityId: studyId,
    action: 'VERIFICATION_SUBMITTED',
  });

  return fetchQcLotVerificationById(studyId);
}

export async function reviewQcLotVerification(
  staff: StaffContext,
  studyId: string,
  action: 'review' | 'return' | 'reject',
  comment?: string,
): Promise<ClinicalResult<QcLotVerificationStudy>> {
  const current = await fetchQcLotVerificationById(studyId);
  if (!current.data) return current;
  if (current.data.preparedByName === staff.fullName && action === 'review') {
    return { data: null, error: 'Prepared by and reviewed by must be different users.' };
  }

  const supabase = createClient();
  let status: QcVerificationStudyStatus = action === 'review' ? 'pending_approval' : action === 'return' ? 'runs_completed' : 'rejected';
  const result = await runClinicalMutation('Failed to review study', async () =>
    supabase
      .from('qc_lot_verification_studies')
      .update({
        status,
        reviewed_by: action === 'review' ? staff.userId : null,
        reviewed_by_name: action === 'review' ? staff.fullName : null,
        reviewed_by_staff_id: action === 'review' ? staff.staffId ?? null : null,
        reviewed_at: action === 'review' ? new Date().toISOString() : null,
        review_comment: comment ?? null,
        rejected_by: action === 'reject' ? staff.userId : null,
        rejected_by_name: action === 'reject' ? staff.fullName : null,
        rejected_at: action === 'reject' ? new Date().toISOString() : null,
        rejection_comment: action === 'reject' ? comment ?? null : null,
        updated_by: staff.userId,
      })
      .eq('id', studyId)
      .select('*')
      .single(),
  );
  if (result.error) return { data: null, error: result.error };

  await logInventoryAudit(staff, {
    entityType: 'qc_lot_verification',
    entityId: studyId,
    action: action === 'review' ? 'VERIFICATION_REVIEWED' : action === 'reject' ? 'VERIFICATION_REJECTED' : 'VERIFICATION_RETURNED',
    comment,
  });

  return fetchQcLotVerificationById(studyId);
}

export async function approveQcLotVerification(
  staff: StaffContext,
  studyId: string,
  action: 'approve' | 'return' | 'reject',
  comment?: string,
): Promise<ClinicalResult<QcLotVerificationStudy>> {
  const current = await fetchQcLotVerificationById(studyId);
  if (!current.data) return current;

  const supabase = createClient();
  const status: QcVerificationStudyStatus =
    action === 'approve' ? 'approved' : action === 'return' ? 'pending_review' : 'rejected';

  const result = await runClinicalMutation('Failed to approve study', async () =>
    supabase
      .from('qc_lot_verification_studies')
      .update({
        status,
        approved_by: action === 'approve' ? staff.userId : null,
        approved_by_name: action === 'approve' ? staff.fullName : null,
        approved_by_staff_id: action === 'approve' ? staff.staffId ?? null : null,
        approved_at: action === 'approve' ? new Date().toISOString() : null,
        approval_comment: action === 'approve' ? comment ?? null : null,
        rejected_by: action === 'reject' ? staff.userId : null,
        rejected_by_name: action === 'reject' ? staff.fullName : null,
        rejected_at: action === 'reject' ? new Date().toISOString() : null,
        rejection_comment: action === 'reject' ? comment ?? null : null,
        updated_by: staff.userId,
      })
      .eq('id', studyId)
      .select('*')
      .single(),
  );
  if (result.error) return { data: null, error: result.error };

  await logInventoryAudit(staff, {
    entityType: 'qc_lot_verification',
    entityId: studyId,
    action: action === 'approve' ? 'VERIFICATION_APPROVED' : action === 'reject' ? 'VERIFICATION_REJECTED' : 'VERIFICATION_RETURNED',
    comment,
  });

  return fetchQcLotVerificationById(studyId);
}

export async function lookupQcLotVerification(input: {
  verificationType: QcVerificationType;
  qcMaterialName: string;
  lotNumber: string;
  instrumentId?: string;
}): Promise<QcLotVerificationLookupResult> {
  const contextKey = buildQcVerificationContextKey(input);
  const supabase = createClient();

  const { data: approved } = await supabase
    .from('qc_lot_verification_studies')
    .select('id, study_number, status, final_decision, verification_type')
    .eq('context_key', contextKey)
    .eq('status', 'approved')
    .is('deleted_at', null)
    .maybeSingle();

  if (approved && isStudyVerifiedForUse({
    status: approved.status as string,
    verificationType: approved.verification_type as string,
    finalDecision: approved.final_decision as string | null,
  })) {
    return {
      status: 'verified',
      studyId: approved.id as string,
      studyNumber: approved.study_number as string,
      message: 'Approved QC Lot Verification exists for this lot.',
    };
  }

  const { data: inProgress } = await supabase
    .from('qc_lot_verification_studies')
    .select('id, study_number, status')
    .eq('context_key', contextKey)
    .in('status', ['draft', 'runs_completed', 'pending_review', 'pending_approval'])
    .is('deleted_at', null)
    .maybeSingle();

  if (inProgress) {
    return {
      status: 'in_progress',
      studyId: inProgress.id as string,
      studyNumber: inProgress.study_number as string,
      message: 'QC Lot Verification already in progress.',
    };
  }

  const { data: rejected } = await supabase
    .from('qc_lot_verification_studies')
    .select('id, study_number')
    .eq('context_key', contextKey)
    .eq('status', 'rejected')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (rejected) {
    return {
      status: 'rejected',
      studyId: rejected.id as string,
      studyNumber: rejected.study_number as string,
      message: 'Previous verification was rejected. A new study is required.',
    };
  }

  return {
    status: 'not_verified',
    message: 'This QC lot has not been verified yet. QC Lot Verification is required before use.',
  };
}

export function isAcceptableFinalDecision(decision?: QcVerificationFinalDecision | null): boolean {
  return Boolean(decision && ACCEPTABLE_FINAL_DECISIONS.includes(decision));
}

export { buildParameterSummary, buildRunProgress };
