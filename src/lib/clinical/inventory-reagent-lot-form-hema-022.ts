import { createClient } from '@/lib/supabase/client';
import {
  FORM_HEMA_022_CODE,
  FORM_HEMA_022_SAMPLE_COUNT,
  type FormHema022TestDefinition,
} from '@/lib/inventory/form-hema-022/constants';
import {
  buildAcceptanceCriterionText,
  resolveFormHema022Reagent,
  snapshotTestsForReagent,
} from '@/lib/inventory/form-hema-022/reagent-mapping';
import {
  computeFormHema022Difference,
  deriveFormHema022Interpretation,
} from '@/lib/inventory/form-hema-022/calculation';
import { validateFormHema022Submission } from '@/lib/inventory/form-hema-022/validation';
import type { CreateReagentLotComparisonInput } from '@/lib/clinical/inventory-reagent-lot';
import {
  fetchReagentLotComparisonById,
  submitReagentLotComparison,
} from '@/lib/clinical/inventory-reagent-lot';
import type { StaffContext } from '@/lib/clinical/staff-context';
import type { ClinicalResult } from '@/lib/clinical/result';
import type { ReagentLotComparison, ReagentLotComparisonResult } from '@/types/inventory-module';

export interface CreateFormHema022StudyInput extends CreateReagentLotComparisonInput {
  studyYear?: number;
}

export interface FormHema022ResultInput {
  id: string;
  oldResult?: number | null;
  newResult?: number | null;
  comment?: string;
}

export function buildFormHema022ResultRows(
  comparisonId: string,
  tests: FormHema022TestDefinition[],
): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = [];
  let displayOrder = 0;
  for (let sampleNumber = 1; sampleNumber <= FORM_HEMA_022_SAMPLE_COUNT; sampleNumber += 1) {
    for (const test of tests) {
      rows.push({
        comparison_id: comparisonId,
        sample_number: sampleNumber,
        test_code: test.code,
        test_label: test.label,
        unit: test.unit ?? null,
        acceptance_limit_percent: test.acceptanceLimitPercent ?? null,
        acceptance_criterion_text: buildAcceptanceCriterionText(test),
        interpretation: test.autoInterpretationEnabled ? 'incomplete' : 'criteria_not_configured',
        display_order: displayOrder,
      });
      displayOrder += 1;
    }
  }
  return rows;
}

export function resolveFormHema022CreatePayload(input: CreateFormHema022StudyInput): {
  ok: true;
  payload: Record<string, unknown>;
  tests: FormHema022TestDefinition[];
} | {
  ok: false;
  error: string;
} {
  const resolved = resolveFormHema022Reagent(input.reagentName);
  if (!resolved) {
    return {
      ok: false,
      error: `Reagent "${input.reagentName}" is not mapped to Form-Hema-022. Configure the controlled reagent mapping before starting this study.`,
    };
  }
  const tests = snapshotTestsForReagent(resolved.definition);
  const studyYear = input.studyYear ?? new Date(input.studyDate ?? Date.now()).getFullYear();
  return {
    ok: true,
    tests,
    payload: {
      schema_version: 2,
      form_code: FORM_HEMA_022_CODE,
      study_year: studyYear,
      analyte_test_group: resolved.definition.analyteTestGroup,
      reagent_key: resolved.definition.key,
      form_layout: resolved.definition.layout,
      test_codes_snapshot: tests,
      reagent_name: resolved.definition.displayName,
      test_parameter: tests.map((test) => test.label).join(', '),
      acceptance_criteria_configured: tests.every((test) => test.autoInterpretationEnabled),
      acceptance_max_difference_percent: null,
    },
  };
}

export async function saveFormHema022Results(
  staff: StaffContext,
  comparisonId: string,
  inputs: FormHema022ResultInput[],
  patch?: { conclusion?: string; comments?: string },
): Promise<ClinicalResult<ReagentLotComparison>> {
  const current = await fetchReagentLotComparisonById(comparisonId);
  if (!current.data) return current;
  if (current.data.schemaVersion !== 2) {
    return { data: null, error: 'Study is not a Form-Hema-022 record.' };
  }
  if (current.data.status !== 'draft' && current.data.status !== 'returned') {
    return { data: null, error: 'Study is read-only.' };
  }

  const testByCode = new Map(
    (current.data.testCodesSnapshot ?? []).map((test) => [test.code, test]),
  );
  const supabase = createClient();
  const now = new Date().toISOString();

  for (const input of inputs) {
    const existing = current.data.results.find((row) => row.id === input.id);
    if (!existing) continue;
    const test = existing.testCode ? testByCode.get(existing.testCode) : undefined;
    const diff = computeFormHema022Difference(input.oldResult, input.newResult);
    const interpretation = test
      ? deriveFormHema022Interpretation(test, input.oldResult, input.newResult)
      : existing.interpretation;

    await supabase.from('inventory_reagent_lot_comparison_results').update({
      old_result: input.oldResult ?? null,
      new_result: input.newResult ?? null,
      difference_units: diff.signedDifferenceUnits ?? null,
      absolute_difference_units: diff.absoluteDifferenceUnits ?? null,
      difference_percent: diff.differencePercent ?? null,
      interpretation,
      comment: input.comment ?? null,
      recorded_by_name: staff.fullName,
      recorded_by_staff_id: staff.staffId,
      recorded_at: now,
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

export async function submitFormHema022Study(
  staff: StaffContext,
  comparisonId: string,
): Promise<ClinicalResult<ReagentLotComparison>> {
  const current = await fetchReagentLotComparisonById(comparisonId);
  if (!current.data) return current;
  const issues = validateFormHema022Submission(current.data);
  if (issues.length > 0) {
    return { data: null, error: issues[0]?.message ?? 'Study cannot be submitted.' };
  }
  return submitReagentLotComparison(staff, comparisonId);
}

export async function changeFormHema022ReagentOnDraft(
  staff: StaffContext,
  comparisonId: string,
  reagentName: string,
): Promise<ClinicalResult<ReagentLotComparison>> {
  const current = await fetchReagentLotComparisonById(comparisonId);
  if (!current.data) return current;
  if (current.data.status !== 'draft' && current.data.status !== 'returned') {
    return { data: null, error: 'Study is read-only.' };
  }
  const resolved = resolveFormHema022Reagent(reagentName);
  if (!resolved) {
    return { data: null, error: `Reagent "${reagentName}" is not mapped to Form-Hema-022.` };
  }
  if (resolved.definition.key === current.data.reagentKey) {
    return current;
  }

  const tests = snapshotTestsForReagent(resolved.definition);
  const supabase = createClient();
  await supabase.from('inventory_reagent_lot_comparison_results').delete().eq('comparison_id', comparisonId);
  await supabase.from('inventory_reagent_lot_comparisons').update({
    reagent_name: resolved.definition.displayName,
    reagent_key: resolved.definition.key,
    form_layout: resolved.definition.layout,
    analyte_test_group: resolved.definition.analyteTestGroup,
    test_codes_snapshot: tests,
    test_parameter: tests.map((test) => test.label).join(', '),
    acceptance_criteria_configured: tests.every((test) => test.autoInterpretationEnabled),
    updated_by: staff.userId,
  }).eq('id', comparisonId);
  await supabase.from('inventory_reagent_lot_comparison_results').insert(buildFormHema022ResultRows(comparisonId, tests));
  return fetchReagentLotComparisonById(comparisonId);
}

export function groupFormHema022Results(results: ReagentLotComparisonResult[]): Map<number, ReagentLotComparisonResult[]> {
  const grouped = new Map<number, ReagentLotComparisonResult[]>();
  for (const result of results) {
    const list = grouped.get(result.sampleNumber) ?? [];
    list.push(result);
    grouped.set(result.sampleNumber, list);
  }
  return grouped;
}
