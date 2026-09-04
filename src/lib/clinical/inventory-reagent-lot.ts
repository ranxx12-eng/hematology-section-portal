import { createClient } from '@/lib/supabase/client';
import {
  computeDifference,
  deriveReagentResultInterpretation,
} from '@/lib/inventory/constants';
import { logInventoryAudit } from '@/lib/clinical/inventory-audit';
import { activateLotFromStore } from '@/lib/clinical/inventory-lot-usage';
import type {
  LotInterpretation,
  LotStudyStatus,
  ReagentLotComparison,
  ReagentLotComparisonResult,
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

function mapComparison(row: Record<string, unknown>, results: ReagentLotComparisonResult[]): ReagentLotComparison {
  return {
    id: row.id as string,
    studyNumber: row.study_number as string,
    status: row.status as LotStudyStatus,
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
    preparedByName: (row.prepared_by_name as string | null) ?? undefined,
    preparedAt: (row.prepared_at as string | null) ?? undefined,
    reviewedByName: (row.reviewed_by_name as string | null) ?? undefined,
    reviewedAt: (row.reviewed_at as string | null) ?? undefined,
    approvedByName: (row.approved_by_name as string | null) ?? undefined,
    approvedAt: (row.approved_at as string | null) ?? undefined,
    oldLotSnapshot: (row.old_lot_snapshot as { expiryDate?: string } | null) ?? undefined,
    newLotSnapshot: (row.new_lot_snapshot as { expiryDate?: string } | null) ?? undefined,
    activatedAt: (row.activated_at as string | null) ?? undefined,
    results,
    createdAt: row.created_at as string,
  };
}

function mapResult(row: Record<string, unknown>): ReagentLotComparisonResult {
  return {
    id: row.id as string,
    comparisonId: row.comparison_id as string,
    sampleNumber: row.sample_number as number,
    oldResult: row.old_result != null ? Number(row.old_result) : undefined,
    newResult: row.new_result != null ? Number(row.new_result) : undefined,
    differenceUnits: row.difference_units != null ? Number(row.difference_units) : undefined,
    differencePercent: row.difference_percent != null ? Number(row.difference_percent) : undefined,
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
    const results = await fetchReagentResults(row.id as string);
    comparisons.push(mapComparison(row, results.data));
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
  const results = await fetchReagentResults(id);
  return { data: mapComparison(data as Record<string, unknown>, results.data), error: null };
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
  input: CreateReagentLotComparisonInput,
): Promise<ClinicalResult<ReagentLotComparison>> {
  const studyNumber = await generateStudyNumber();
  const acceptanceConfigured = input.acceptanceMaxDifferencePercent != null;
  const criterionText = acceptanceConfigured
    ? `Max difference ≤ ${input.acceptanceMaxDifferencePercent}%`
    : undefined;

  const insertResult = await runClinicalMutation('Failed to create reagent lot comparison', async () => {
    const supabase = createClient();
    return supabase
      .from('inventory_reagent_lot_comparisons')
      .insert({
        study_number: studyNumber,
        reagent_name: input.reagentName,
        test_parameter: input.testParameter ?? null,
        instrument_id: input.instrumentId ?? null,
        instrument_name_snapshot: input.instrumentName ?? null,
        old_lot_number: input.oldLotNumber,
        new_lot_number: input.newLotNumber,
        old_store_item_id: input.oldStoreItemId ?? null,
        new_store_item_id: input.newStoreItemId ?? null,
        study_date: input.studyDate ?? new Date().toISOString().slice(0, 10),
        acceptance_criteria_configured: acceptanceConfigured,
        acceptance_max_difference_percent: input.acceptanceMaxDifferencePercent ?? null,
        comments: input.comments ?? null,
        old_lot_snapshot: input.oldLotExpiry ? { expiryDate: input.oldLotExpiry } : null,
        new_lot_snapshot: input.newLotExpiry ? { expiryDate: input.newLotExpiry } : null,
        created_by: staff.userId,
        updated_by: staff.userId,
        prepared_by: staff.userId,
        prepared_by_name: staff.fullName,
        prepared_by_staff_id: staff.staffId,
      })
      .select('*')
      .single();
  });
  if (!insertResult.data) return { data: null, error: insertResult.error };

  const comparisonId = (insertResult.data as Record<string, unknown>).id as string;
  const sampleCount = input.sampleCount ?? 3;
  const supabase = createClient();
  for (let i = 1; i <= sampleCount; i += 1) {
    await supabase.from('inventory_reagent_lot_comparison_results').insert({
      comparison_id: comparisonId,
      sample_number: i,
      display_order: i - 1,
      interpretation: acceptanceConfigured ? 'incomplete' : 'criteria_not_configured',
      acceptance_criterion_text: criterionText ?? null,
    });
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
  const result = await runClinicalMutation('Failed to submit study', async () => {
    const supabase = createClient();
    return supabase
      .from('inventory_reagent_lot_comparisons')
      .update({
        status: 'pending_review',
        prepared_at: new Date().toISOString(),
        updated_by: staff.userId,
      })
      .eq('id', comparisonId)
      .select('*')
      .single();
  });
  if (result.error) return { data: null, error: result.error };
  await logInventoryAudit(staff, { entityType: 'reagent_lot_comparison', entityId: comparisonId, action: 'STUDY_SUBMITTED' });
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
  if (current.data.preparedByName === staff.fullName && action === 'review') {
    return { data: null, error: 'Prepared by and reviewed by must be different users.' };
  }
  let status: LotStudyStatus = 'pending_approval';
  if (action === 'return') status = 'returned';
  if (action === 'reject') status = 'rejected';

  const result = await runClinicalMutation('Failed to review study', async () => {
    const supabase = createClient();
    return supabase
      .from('inventory_reagent_lot_comparisons')
      .update({
        status,
        reviewed_by: staff.userId,
        reviewed_by_name: staff.fullName,
        reviewed_by_staff_id: staff.staffId,
        reviewed_at: new Date().toISOString(),
        review_comment: comment ?? null,
        updated_by: staff.userId,
      })
      .eq('id', comparisonId)
      .select('*')
      .single();
  });
  if (result.error) return { data: null, error: result.error };
  await logInventoryAudit(staff, { entityType: 'reagent_lot_comparison', entityId: comparisonId, action: 'STUDY_REVIEWED' });
  return fetchReagentLotComparisonById(comparisonId);
}

export async function approveReagentLotComparison(
  staff: StaffContext,
  comparisonId: string,
  action: 'approve' | 'return' | 'reject',
  comment?: string,
): Promise<ClinicalResult<ReagentLotComparison>> {
  let status: LotStudyStatus = 'approved';
  if (action === 'return') status = 'returned';
  if (action === 'reject') status = 'rejected';

  const result = await runClinicalMutation('Failed to approve study', async () => {
    const supabase = createClient();
    return supabase
      .from('inventory_reagent_lot_comparisons')
      .update({
        status,
        approved_by: action === 'approve' ? staff.userId : null,
        approved_by_name: action === 'approve' ? staff.fullName : null,
        approved_by_staff_id: action === 'approve' ? staff.staffId : null,
        approved_at: action === 'approve' ? new Date().toISOString() : null,
        approval_comment: comment ?? null,
        updated_by: staff.userId,
      })
      .eq('id', comparisonId)
      .select('*')
      .single();
  });
  if (result.error) return { data: null, error: result.error };
  await logInventoryAudit(staff, { entityType: 'reagent_lot_comparison', entityId: comparisonId, action: 'STUDY_APPROVED' });
  return fetchReagentLotComparisonById(comparisonId);
}

export async function activateReagentLotFromComparison(
  staff: StaffContext,
  comparisonId: string,
  newStoreItem: InventoryItem,
): Promise<ClinicalResult<ReagentLotComparison>> {
  const comparison = await fetchReagentLotComparisonById(comparisonId);
  if (!comparison.data) return comparison;
  if (comparison.data.status !== 'approved') {
    return { data: null, error: 'Study must be approved before activating the new lot.' };
  }
  if (comparison.data.activatedAt) {
    return { data: null, error: 'New lot was already activated for this study.' };
  }

  const activation = await activateLotFromStore(staff, newStoreItem, {
    inventoryItemId: newStoreItem.id,
    instrumentId: comparison.data.instrumentId,
    instrumentName: comparison.data.instrumentNameSnapshot,
    testParameter: comparison.data.testParameter,
    startDate: new Date().toISOString().slice(0, 10),
    kind: 'reagent',
    reagentComparisonId: comparisonId,
  });
  if (activation.error) return { data: null, error: activation.error };

  const supabase = createClient();
  await supabase.from('inventory_reagent_lot_comparisons').update({
    activated_at: new Date().toISOString(),
    activated_by: staff.userId,
  }).eq('id', comparisonId);

  await logInventoryAudit(staff, {
    entityType: 'reagent_lot_comparison',
    entityId: comparisonId,
    inventoryItemId: newStoreItem.id,
    lotNumber: comparison.data.newLotNumber,
    action: 'NEW_LOT_ACTIVATED',
  });
  return fetchReagentLotComparisonById(comparisonId);
}
