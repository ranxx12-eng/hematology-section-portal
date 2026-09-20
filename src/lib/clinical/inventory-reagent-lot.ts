import { createClient } from '@/lib/supabase/client';
import {
  computeDifference,
  deriveReagentResultInterpretation,
} from '@/lib/inventory/constants';
import {
  buildFormHema022ResultRows,
  resolveFormHema022CreatePayload,
  type CreateFormHema022StudyInput,
} from '@/lib/clinical/inventory-reagent-lot-form-hema-022';
import { logInventoryAudit } from '@/lib/clinical/inventory-audit';
import { maskSampleIdLabel } from '@/lib/security/sample-id-crypto';
import type {
  LotInterpretation,
  LotStudyStatus,
  ReagentLotComparison,
  ReagentLotComparisonResult,
  ReagentLotSampleIdentifier,
} from '@/types/inventory-module';
import type { InventoryItem } from '@/types';
import type { StaffContext } from './staff-context';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

async function generateStudyNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const supabase = createClient();
  const { count } = await supabase
    .from('inventory_reagent_lot_comparisons')
    .select('*', { count: 'exact', head: true })
    .like('study_number', `RLT-${year}-%`);
  return `RLT-${year}-${String((count ?? 0) + 1).padStart(3, '0')}`;
}

function mapComparison(
  row: Record<string, unknown>,
  results: ReagentLotComparisonResult[],
  sampleIdentifiers: ReagentLotSampleIdentifier[] = [],
): ReagentLotComparison {
  return {
    id: row.id as string,
    studyNumber: row.study_number as string,
    status: row.status as LotStudyStatus,
    schemaVersion: (row.schema_version as number | null) === 2 ? 2 : 1,
    formCode: (row.form_code as string | null) ?? undefined,
    studyYear: row.study_year != null ? Number(row.study_year) : undefined,
    analyteTestGroup: (row.analyte_test_group as string | null) ?? undefined,
    reagentKey: (row.reagent_key as string | null) ?? undefined,
    formLayout: (row.form_layout as 'alinity_hq' | 'stago_sta_r_max' | null) ?? undefined,
    testCodesSnapshot: (row.test_codes_snapshot as ReagentLotComparison['testCodesSnapshot']) ?? undefined,
    instrumentId: (row.instrument_id as string | null) ?? undefined,
    instrumentNameSnapshot: (row.instrument_name_snapshot as string | null) ?? undefined,
    reagentName: row.reagent_name as string,
    testParameter: (row.test_parameter as string | null) ?? undefined,
    oldLotNumber: row.old_lot_number as string,
    newLotNumber: row.new_lot_number as string,
    oldStoreItemId: (row.old_store_item_id as string | null) ?? undefined,
    newStoreItemId: (row.new_store_item_id as string | null) ?? undefined,
    studyDate: (row.study_date as string | null) ?? undefined,
    acceptanceCriteriaConfigured: Boolean(row.acceptance_criteria_configured),
    acceptanceMaxDifferencePercent: row.acceptance_max_difference_percent != null
      ? Number(row.acceptance_max_difference_percent)
      : undefined,
    conclusion: (row.conclusion as string | null) ?? undefined,
    comments: (row.comments as string | null) ?? undefined,
    preparedBy: (row.prepared_by as string | null) ?? undefined,
    preparedByName: (row.prepared_by_name as string | null) ?? undefined,
    preparedAt: (row.prepared_at as string | null) ?? undefined,
    reviewedBy: (row.reviewed_by as string | null) ?? undefined,
    reviewedByName: (row.reviewed_by_name as string | null) ?? undefined,
    reviewedAt: (row.reviewed_at as string | null) ?? undefined,
    approvedBy: (row.approved_by as string | null) ?? undefined,
    approvedByName: (row.approved_by_name as string | null) ?? undefined,
    approvedAt: (row.approved_at as string | null) ?? undefined,
    oldLotSnapshot: (row.old_lot_snapshot as { expiryDate?: string } | null) ?? undefined,
    newLotSnapshot: (row.new_lot_snapshot as { expiryDate?: string } | null) ?? undefined,
    activatedAt: (row.activated_at as string | null) ?? undefined,
    sampleIdentifiers,
    results,
    createdAt: row.created_at as string,
  };
}

function mapResult(row: Record<string, unknown>): ReagentLotComparisonResult {
  return {
    id: row.id as string,
    comparisonId: row.comparison_id as string,
    sampleNumber: row.sample_number as number,
    testCode: (row.test_code as string | null) ?? undefined,
    testLabel: (row.test_label as string | null) ?? undefined,
    unit: (row.unit as string | null) ?? undefined,
    acceptanceLimitPercent: row.acceptance_limit_percent != null
      ? Number(row.acceptance_limit_percent)
      : undefined,
    oldResult: row.old_result != null ? Number(row.old_result) : undefined,
    newResult: row.new_result != null ? Number(row.new_result) : undefined,
    differenceUnits: row.difference_units != null ? Number(row.difference_units) : undefined,
    absoluteDifferenceUnits: row.absolute_difference_units != null
      ? Number(row.absolute_difference_units)
      : undefined,
    differencePercent: row.difference_percent != null ? Number(row.difference_percent) : undefined,
    recordedByName: (row.recorded_by_name as string | null) ?? undefined,
    recordedByStaffId: (row.recorded_by_staff_id as string | null) ?? undefined,
    recordedAt: (row.recorded_at as string | null) ?? undefined,
    acceptanceCriterionText: (row.acceptance_criterion_text as string | null) ?? undefined,
    interpretation: row.interpretation as LotInterpretation,
    comment: (row.comment as string | null) ?? undefined,
  };
}

export interface CreateReagentLotComparisonInput {
  reagentName: string;
  testParameter?: string;
  instrumentId?: string;
  instrumentName?: string;
  oldLotNumber: string;
  newLotNumber: string;
  oldStoreItemId?: string;
  newStoreItemId?: string;
  studyDate?: string;
  sampleCount?: number;
  acceptanceMaxDifferencePercent?: number;
  comments?: string;
  oldLotExpiry?: string;
  newLotExpiry?: string;
}

export async function fetchReagentLotComparisons(): Promise<ClinicalListResult<ReagentLotComparison>> {
  const listResult = await runClinicalListQuery('Failed to load reagent lot comparisons', async () => {
    const supabase = createClient();
    return supabase
      .from('inventory_reagent_lot_comparisons')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
  });
  const comparisons: ReagentLotComparison[] = [];
  for (const row of listResult.data as Array<Record<string, unknown>>) {
    const comparisonId = row.id as string;
    const [results, sampleIds] = await Promise.all([
      fetchReagentResults(comparisonId),
      fetchSampleIdentifiers(comparisonId),
    ]);
    comparisons.push(mapComparison(row, results.data, sampleIds.data));
  }
  return { data: comparisons, error: listResult.error };
}

export async function fetchReagentLotComparisonById(id: string): Promise<ClinicalResult<ReagentLotComparison>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('inventory_reagent_lot_comparisons')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (error || !data) return { data: null, error: error?.message ?? 'Not found' };
  const [results, sampleIds] = await Promise.all([
    fetchReagentResults(id),
    fetchSampleIdentifiers(id),
  ]);
  return {
    data: mapComparison(data as Record<string, unknown>, results.data, sampleIds.data),
    error: null,
  };
}

async function fetchSampleIdentifiers(comparisonId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('inventory_reagent_lot_sample_identifiers')
    .select('sample_number, is_synthetic')
    .eq('comparison_id', comparisonId)
    .order('sample_number');
  if (error) return { data: [] as ReagentLotSampleIdentifier[], error: error.message };
  return {
    data: (data ?? []).map((row) => ({
      sampleNumber: row.sample_number as number,
      maskedLabel: maskSampleIdLabel(Boolean(row.is_synthetic)),
      isSynthetic: Boolean(row.is_synthetic),
    })),
    error: null,
  };
}

async function fetchReagentResults(comparisonId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('inventory_reagent_lot_comparison_results')
    .select('*')
    .eq('comparison_id', comparisonId)
    .order('display_order');
  return {
    data: (data ?? []).map((row) => mapResult(row as Record<string, unknown>)),
    error: error?.message ?? null,
  };
}

export async function createReagentLotComparison(
  staff: StaffContext,
  input: CreateReagentLotComparisonInput | CreateFormHema022StudyInput,
): Promise<ClinicalResult<ReagentLotComparison>> {
  const studyNumber = await generateStudyNumber();
  const formPayload = resolveFormHema022CreatePayload(input as CreateFormHema022StudyInput);
  if (!formPayload.ok && input.newStoreItemId) {
    return { data: null, error: formPayload.error };
  }
  const acceptanceConfigured = formPayload.ok
    ? Boolean(formPayload.payload.acceptance_criteria_configured)
    : input.acceptanceMaxDifferencePercent != null;
  const criterionText = !formPayload.ok && acceptanceConfigured
    ? `Max difference ≤ ${input.acceptanceMaxDifferencePercent}%`
    : undefined;

  const insertResult = await runClinicalMutation('Failed to create reagent lot comparison', async () => {
    const supabase = createClient();
    return supabase
      .from('inventory_reagent_lot_comparisons')
      .insert({
        study_number: studyNumber,
        reagent_name: formPayload.ok ? formPayload.payload.reagent_name : input.reagentName,
        test_parameter: formPayload.ok
          ? formPayload.payload.test_parameter
          : (input.testParameter ?? null),
        instrument_id: input.instrumentId ?? null,
        instrument_name_snapshot: input.instrumentName ?? null,
        old_lot_number: input.oldLotNumber,
        new_lot_number: input.newLotNumber,
        old_store_item_id: input.oldStoreItemId ?? null,
        new_store_item_id: input.newStoreItemId ?? null,
        study_date: input.studyDate ?? new Date().toISOString().slice(0, 10),
        acceptance_criteria_configured: acceptanceConfigured,
        acceptance_max_difference_percent: formPayload.ok
          ? null
          : (input.acceptanceMaxDifferencePercent ?? null),
        comments: input.comments ?? null,
        old_lot_snapshot: input.oldLotExpiry ? { expiryDate: input.oldLotExpiry } : null,
        new_lot_snapshot: input.newLotExpiry ? { expiryDate: input.newLotExpiry } : null,
        created_by: staff.userId,
        updated_by: staff.userId,
        prepared_by: staff.userId,
        prepared_by_name: staff.fullName,
        prepared_by_staff_id: staff.staffId,
        ...(formPayload.ok ? formPayload.payload : {}),
      })
      .select('*')
      .single();
  });
  if (!insertResult.data) return { data: null, error: insertResult.error };

  const comparisonId = (insertResult.data as Record<string, unknown>).id as string;
  const supabase = createClient();
  if (formPayload.ok) {
    const rows = buildFormHema022ResultRows(comparisonId, formPayload.tests);
    await supabase.from('inventory_reagent_lot_comparison_results').insert(rows);
  } else {
    const sampleCount = input.sampleCount ?? 3;
    for (let i = 1; i <= sampleCount; i += 1) {
      await supabase.from('inventory_reagent_lot_comparison_results').insert({
        comparison_id: comparisonId,
        sample_number: i,
        display_order: i - 1,
        interpretation: acceptanceConfigured ? 'incomplete' : 'criteria_not_configured',
        acceptance_criterion_text: criterionText ?? null,
      });
    }
  }

  await logInventoryAudit(staff, {
    entityType: 'reagent_lot_comparison',
    entityId: comparisonId,
    action: 'REAGENT_LOT_COMPARISON_CREATED',
    metadata: { studyNumber },
  });
  return fetchReagentLotComparisonById(comparisonId);
}

export interface ReagentResultInput {
  id: string;
  oldResult?: number | null;
  newResult?: number | null;
  comment?: string;
}

export async function saveReagentLotComparisonResults(
  staff: StaffContext,
  comparisonId: string,
  inputs: ReagentResultInput[],
  patch?: { conclusion?: string; comments?: string },
): Promise<ClinicalResult<ReagentLotComparison>> {
  const current = await fetchReagentLotComparisonById(comparisonId);
  if (!current.data) return current;
  if (current.data.status !== 'draft' && current.data.status !== 'returned') {
    return { data: null, error: 'Study is read-only.' };
  }

  const supabase = createClient();
  for (const input of inputs) {
    const diff = computeDifference(input.oldResult, input.newResult);
    const interpretation = deriveReagentResultInterpretation(
      current.data.acceptanceCriteriaConfigured,
      input.oldResult,
      input.newResult,
      current.data.acceptanceMaxDifferencePercent,
    );
    await supabase.from('inventory_reagent_lot_comparison_results').update({
      old_result: input.oldResult ?? null,
      new_result: input.newResult ?? null,
      difference_units: diff.differenceUnits ?? null,
      difference_percent: diff.differencePercent ?? null,
      interpretation,
      comment: input.comment ?? null,
    }).eq('id', input.id);
  }

  if (patch) {
    await supabase.from('inventory_reagent_lot_comparisons').update({
      conclusion: patch.conclusion ?? null,
      comments: patch.comments ?? null,
      updated_by: staff.userId,
    }).eq('id', comparisonId);
  }

  return fetchReagentLotComparisonById(comparisonId);
}

export async function submitReagentLotComparison(
  staff: StaffContext,
  comparisonId: string,
): Promise<ClinicalResult<ReagentLotComparison>> {
  const current = await fetchReagentLotComparisonById(comparisonId);
  if (!current.data) return current;
  if (current.data.status !== 'draft' && current.data.status !== 'returned') {
    return { data: null, error: 'Study cannot be submitted in its current status.' };
  }

  const result = await runClinicalMutation('Failed to submit study', async () => {
    const supabase = createClient();
    return supabase.rpc('perform_reagent_lot_workflow_action', {
      p_comparison_id: comparisonId,
      p_action: 'submit',
    });
  });
  if (result.error) return { data: null, error: result.error };
  return fetchReagentLotComparisonById(comparisonId);
}

export async function reviewReagentLotComparison(
  staff: StaffContext,
  comparisonId: string,
  action: 'review' | 'return' | 'reject',
  comment?: string,
): Promise<ClinicalResult<ReagentLotComparison>> {
  const current = await fetchReagentLotComparisonById(comparisonId);
  if (!current.data) return current;
  if (current.data.status !== 'pending_review') {
    return { data: null, error: 'Study is not pending review.' };
  }
  const rpcAction = action === 'review' ? 'review' : action;
  const result = await runClinicalMutation('Failed to review study', async () => {
    const supabase = createClient();
    return supabase.rpc('perform_reagent_lot_workflow_action', {
      p_comparison_id: comparisonId,
      p_action: rpcAction,
      p_comment: comment ?? null,
    });
  });
  if (result.error) return { data: null, error: result.error };
  return fetchReagentLotComparisonById(comparisonId);
}

export async function approveReagentLotComparison(
  staff: StaffContext,
  comparisonId: string,
  action: 'approve' | 'return' | 'reject',
  comment?: string,
): Promise<ClinicalResult<ReagentLotComparison>> {
  const current = await fetchReagentLotComparisonById(comparisonId);
  if (!current.data) return current;
  if (current.data.status !== 'pending_approval') {
    return { data: null, error: 'Study is not pending approval.' };
  }
  const rpcAction = action === 'approve' ? 'approve' : action;
  const result = await runClinicalMutation('Failed to approve study', async () => {
    const supabase = createClient();
    return supabase.rpc('perform_reagent_lot_workflow_action', {
      p_comparison_id: comparisonId,
      p_action: rpcAction,
      p_comment: comment ?? null,
    });
  });
  if (result.error) return { data: null, error: result.error };
  return fetchReagentLotComparisonById(comparisonId);
}

export async function activateReagentLotFromComparison(
  staff: StaffContext,
  comparisonId: string,
  _newStoreItem: InventoryItem,
): Promise<ClinicalResult<ReagentLotComparison>> {
  void _newStoreItem;
  const comparison = await fetchReagentLotComparisonById(comparisonId);
  if (!comparison.data) return comparison;
  if (comparison.data.status !== 'approved') {
    return { data: null, error: 'Study must be approved before activating the new lot.' };
  }
  if (comparison.data.activatedAt) {
    return { data: null, error: 'New lot was already activated for this study.' };
  }

  const supabase = createClient();
  const { data: usageId, error: rpcError } = await supabase.rpc('activate_reagent_lot_study', {
    p_comparison_id: comparisonId,
  });
  if (rpcError) {
    return { data: null, error: rpcError.message };
  }
  if (!usageId) {
    return { data: null, error: 'Lot activation did not complete.' };
  }
  return fetchReagentLotComparisonById(comparisonId);
}
