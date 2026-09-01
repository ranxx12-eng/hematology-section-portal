import { createClient } from '@/lib/supabase/client';
import {
  buildStudySummary,
  calculateComparisonResult,
  canApproveStudy,
  deriveOverallResult,
  manualReviewDecisionIsValid,
} from '@/lib/comparison-studies/calculation';
import { DEFAULT_SAMPLE_IDS, FORM_HEMA_013_CODE } from '@/lib/comparison-studies/constants';
import type {
  ComparisonSectionCode,
  ComparisonStudy,
  ComparisonStudyListItem,
  ComparisonStudyResult,
  ComparisonStudySample,
  ComparisonStudySection,
  ComparisonStudyType,
  ComparisonTestDefinition,
} from '@/types/comparison-study';
import type { StaffContext } from './staff-context';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface StudyRow {
  id: string;
  study_number: string;
  form_code: string | null;
  study_type: ComparisonStudyType;
  comparison_type: string | null;
  study_title: string;
  study_date: string | null;
  purpose: string | null;
  reference_label: string | null;
  comparison_label: string | null;
  reference_instrument_id: string | null;
  comparison_instrument_id: string | null;
  status: ComparisonStudy['status'];
  overall_result: ComparisonStudy['overallResult'];
  general_comments: string | null;
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
  parent_study_id: string | null;
  version_number: number;
  amendment_reason: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

async function logAudit(
  studyId: string,
  staff: StaffContext,
  action: string,
  opts?: {
    oldStatus?: ComparisonStudy['status'];
    newStatus?: ComparisonStudy['status'];
    comment?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const supabase = createClient();
  await supabase.from('comparison_study_audit_events').insert({
    study_id: studyId,
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

async function generateStudyNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const supabase = createClient();
  const { count } = await supabase
    .from('comparison_studies')
    .select('*', { count: 'exact', head: true })
    .like('study_number', `CMP-${year}-%`);
  const next = ((count ?? 0) + 1).toString().padStart(3, '0');
  return `CMP-${year}-${next}`;
}

function mapStudy(
  row: StudyRow,
  sections: ComparisonStudySection[],
  samples: ComparisonStudySample[],
  results: ComparisonStudyResult[],
): ComparisonStudy {
  return {
    id: row.id,
    studyNumber: row.study_number,
    formCode: row.form_code ?? undefined,
    studyType: row.study_type,
    comparisonType: row.comparison_type ?? undefined,
    studyTitle: row.study_title,
    studyDate: row.study_date ?? undefined,
    purpose: row.purpose ?? undefined,
    referenceLabel: row.reference_label ?? undefined,
    comparisonLabel: row.comparison_label ?? undefined,
    referenceInstrumentId: row.reference_instrument_id ?? undefined,
    comparisonInstrumentId: row.comparison_instrument_id ?? undefined,
    status: row.status,
    overallResult: row.overall_result ?? undefined,
    generalComments: row.general_comments ?? undefined,
    preparedBy: row.prepared_by ?? undefined,
    preparedByName: row.prepared_by_name ?? undefined,
    preparedByStaffId: row.prepared_by_staff_id ?? undefined,
    preparedAt: row.prepared_at ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedByName: row.reviewed_by_name ?? undefined,
    reviewedByStaffId: row.reviewed_by_staff_id ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    reviewComment: row.review_comment ?? undefined,
    approvedBy: row.approved_by ?? undefined,
    approvedByName: row.approved_by_name ?? undefined,
    approvedByStaffId: row.approved_by_staff_id ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    approvalComment: row.approval_comment ?? undefined,
    parentStudyId: row.parent_study_id ?? undefined,
    versionNumber: row.version_number,
    amendmentReason: row.amendment_reason ?? undefined,
    sections,
    samples,
    results,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at ?? undefined,
  };
}

async function fetchStudyRelations(studyId: string) {
  const supabase = createClient();
  const [sectionsRes, samplesRes] = await Promise.all([
    supabase.from('comparison_study_sections').select('*').eq('study_id', studyId).order('display_order'),
    supabase.from('comparison_study_samples').select('*').eq('study_id', studyId).order('display_order'),
  ]);

  const sampleIds = (samplesRes.data ?? []).map((row) => row.id as string);
  let resultsData: Array<Record<string, unknown>> = [];
  if (sampleIds.length > 0) {
    const res = await supabase
      .from('comparison_study_results')
      .select('*')
      .in('sample_id', sampleIds)
      .order('display_order');
    resultsData = (res.data ?? []) as Array<Record<string, unknown>>;
  }

  const sections: ComparisonStudySection[] = (sectionsRes.data ?? []).map((row) => ({
    id: row.id,
    studyId: row.study_id,
    section: row.section,
    completionPercentage: Number(row.completion_percentage),
    displayOrder: row.display_order,
  }));

  const samples: ComparisonStudySample[] = (samplesRes.data ?? []).map((row) => ({
    id: row.id,
    studyId: row.study_id,
    section: row.section,
    sampleId: row.sample_id,
    displayOrder: row.display_order,
  }));

  const results: ComparisonStudyResult[] = resultsData.map((row) => ({
    id: row.id as string,
    sampleId: row.sample_id as string,
    testDefinitionId: (row.test_definition_id as string | null) ?? undefined,
    testCode: row.test_code as string,
    testName: row.test_name as string,
    unit: row.unit as string,
    previousResult: row.previous_result != null ? Number(row.previous_result) : undefined,
    newResult: row.new_result != null ? Number(row.new_result) : undefined,
    differenceUnits: row.difference_units != null ? Number(row.difference_units) : undefined,
    differencePercent: row.difference_percent != null ? Number(row.difference_percent) : undefined,
    taeLimitSnapshot: row.tae_limit_snapshot != null ? Number(row.tae_limit_snapshot) : undefined,
    resultStatus: row.result_status as ComparisonStudyResult['resultStatus'],
    manualReviewDecision: (row.manual_review_decision as ComparisonStudyResult['manualReviewDecision']) ?? undefined,
    manualReviewComment: (row.manual_review_comment as string | null) ?? undefined,
    manualReviewedBy: (row.manual_reviewed_by as string | null) ?? undefined,
    manualReviewedByName: (row.manual_reviewed_by_name as string | null) ?? undefined,
    manualReviewedByStaffId: (row.manual_reviewed_by_staff_id as string | null) ?? undefined,
    manualReviewedAt: (row.manual_reviewed_at as string | null) ?? undefined,
    issueObservation: (row.issue_observation as string | null) ?? undefined,
    correctiveAction: (row.corrective_action as string | null) ?? undefined,
    repeatPerformed: Boolean(row.repeat_performed),
    repeatPreviousResult: row.repeat_previous_result != null ? Number(row.repeat_previous_result) : undefined,
    repeatNewResult: row.repeat_new_result != null ? Number(row.repeat_new_result) : undefined,
    repeatReason: (row.repeat_reason as string | null) ?? undefined,
    repeatBy: (row.repeat_by as string | null) ?? undefined,
    repeatByName: (row.repeat_by_name as string | null) ?? undefined,
    repeatAt: (row.repeat_at as string | null) ?? undefined,
    displayOrder: row.display_order as number,
  }));

  return { sections, samples, results };
}

export async function fetchComparisonTestDefinitions(): Promise<ClinicalListResult<ComparisonTestDefinition>> {
  return runClinicalListQuery('Failed to load comparison test definitions', async () => {
    const supabase = createClient();
    return supabase
      .from('comparison_test_definitions')
      .select('*')
      .eq('is_active', true)
      .order('section')
      .order('display_order');
  }).then((result) => ({
    data: (result.data as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as string,
      section: row.section as ComparisonSectionCode,
      testCode: row.test_code as string,
      testName: row.test_name as string,
      unit: row.unit as string,
      taeLimit: row.tae_limit != null ? Number(row.tae_limit) : undefined,
      displayOrder: row.display_order as number,
      isActive: row.is_active as boolean,
    })),
    error: result.error,
  }));
}

export async function fetchComparisonStudies(search?: string): Promise<ClinicalListResult<ComparisonStudyListItem>> {
  const result = await runClinicalListQuery('Failed to load comparison studies', async () => {
    const supabase = createClient();
    let query = supabase
      .from('comparison_studies')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (search?.trim()) {
      query = query.or(
        `study_number.ilike.%${search.trim()}%,study_title.ilike.%${search.trim()}%,reference_label.ilike.%${search.trim()}%,comparison_label.ilike.%${search.trim()}%`,
      );
    }
    return query;
  });

  const rows = result.data as StudyRow[];
  const list: ComparisonStudyListItem[] = [];

  for (const row of rows) {
    const { sections, samples } = await fetchStudyRelations(row.id);
    list.push({
      id: row.id,
      studyNumber: row.study_number,
      studyType: row.study_type,
      comparisonType: row.comparison_type ?? undefined,
      studyTitle: row.study_title,
      studyDate: row.study_date ?? undefined,
      referenceLabel: row.reference_label ?? undefined,
      comparisonLabel: row.comparison_label ?? undefined,
      sections: sections.map((s) => s.section),
      sampleCount: samples.length,
      overallResult: row.overall_result ?? undefined,
      status: row.status,
      preparedByName: row.prepared_by_name ?? undefined,
      versionNumber: row.version_number,
      createdAt: row.created_at,
    });
  }

  return { data: list, error: result.error };
}

export async function fetchComparisonStudyById(id: string): Promise<ClinicalResult<ComparisonStudy>> {
  const result = await runClinicalMutation('Failed to load comparison study', async () => {
    const supabase = createClient();
    return supabase.from('comparison_studies').select('*').eq('id', id).is('deleted_at', null).single();
  });
  if (!result.data) return { data: null, error: result.error };
  const relations = await fetchStudyRelations(id);
  return {
    data: mapStudy(result.data as StudyRow, relations.sections, relations.samples, relations.results),
    error: null,
  };
}

async function seedStandardComparisonStructure(
  studyId: string,
  sections: ComparisonSectionCode[],
  definitions: ComparisonTestDefinition[],
): Promise<void> {
  const supabase = createClient();
  for (const [index, section] of sections.entries()) {
    await supabase.from('comparison_study_sections').insert({
      study_id: studyId,
      section,
      display_order: index,
    });
    const sectionTests = definitions.filter((def) => def.section === section);
    for (const [sampleIndex, sampleId] of DEFAULT_SAMPLE_IDS.entries()) {
      const { data: sampleRow } = await supabase
        .from('comparison_study_samples')
        .insert({
          study_id: studyId,
          section,
          sample_id: sampleId,
          display_order: sampleIndex,
        })
        .select('*')
        .single();
      if (!sampleRow) continue;
      for (const [testIndex, test] of sectionTests.entries()) {
        await supabase.from('comparison_study_results').insert({
          sample_id: sampleRow.id,
          test_definition_id: test.id,
          test_code: test.testCode,
          test_name: test.testName,
          unit: test.unit,
          tae_limit_snapshot: test.taeLimit ?? null,
          display_order: testIndex,
        });
      }
    }
  }
}

export interface StandardComparisonSetupInput {
  studyTitle: string;
  comparisonType: string;
  studyDate: string;
  purpose?: string;
  referenceLabel?: string;
  comparisonLabel?: string;
  referenceInstrumentId?: string;
  comparisonInstrumentId?: string;
  generalComments?: string;
  sections: ComparisonSectionCode[];
}

export async function createComparisonStudyDraft(
  staff: StaffContext,
  studyType: ComparisonStudyType,
  setup?: StandardComparisonSetupInput,
): Promise<ClinicalResult<ComparisonStudy>> {
  const studyNumber = await generateStudyNumber();
  const insertResult = await runClinicalMutation('Failed to create comparison study', async () => {
    const supabase = createClient();
    return supabase
      .from('comparison_studies')
      .insert({
        study_number: studyNumber,
        study_type: studyType,
        form_code: studyType === 'standard_comparison' ? FORM_HEMA_013_CODE : null,
        study_title: setup?.studyTitle ?? '',
        comparison_type: setup?.comparisonType ?? null,
        study_date: setup?.studyDate ?? null,
        purpose: setup?.purpose ?? null,
        reference_label: setup?.referenceLabel ?? null,
        comparison_label: setup?.comparisonLabel ?? null,
        reference_instrument_id: setup?.referenceInstrumentId ?? null,
        comparison_instrument_id: setup?.comparisonInstrumentId ?? null,
        general_comments: setup?.generalComments ?? null,
        prepared_by: staff.userId,
        prepared_by_name: staff.fullName,
        prepared_by_staff_id: staff.staffId,
        created_by: staff.userId,
        updated_by: staff.userId,
      })
      .select('*')
      .single();
  });
  if (!insertResult.data) return { data: null, error: insertResult.error };

  const studyId = (insertResult.data as StudyRow).id;
  if (studyType === 'standard_comparison' && setup?.sections?.length) {
    const defs = await fetchComparisonTestDefinitions();
    if (defs.error) return { data: null, error: defs.error };
    await seedStandardComparisonStructure(studyId, setup.sections, defs.data);
  }

  await logAudit(studyId, staff, 'STUDY_CREATED', { newStatus: 'draft' });
  return fetchComparisonStudyById(studyId);
}

export async function saveStandardComparisonSetup(
  studyId: string,
  staff: StaffContext,
  setup: StandardComparisonSetupInput,
): Promise<ClinicalResult<ComparisonStudy>> {
  const current = await fetchComparisonStudyById(studyId);
  if (!current.data) return { data: null, error: current.error ?? 'Study not found' };
  if (current.data.status !== 'draft' && current.data.status !== 'returned') {
    return { data: null, error: 'Only draft or returned studies can be edited.' };
  }

  const updateResult = await runClinicalMutation('Failed to save comparison study setup', async () => {
    const supabase = createClient();
    return supabase
      .from('comparison_studies')
      .update({
        study_title: setup.studyTitle,
        comparison_type: setup.comparisonType,
        study_date: setup.studyDate,
        purpose: setup.purpose ?? null,
        reference_label: setup.referenceLabel ?? null,
        comparison_label: setup.comparisonLabel ?? null,
        reference_instrument_id: setup.referenceInstrumentId ?? null,
        comparison_instrument_id: setup.comparisonInstrumentId ?? null,
        general_comments: setup.generalComments ?? null,
        updated_by: staff.userId,
      })
      .eq('id', studyId)
      .select('*')
      .single();
  });
  if (!updateResult.data) return { data: null, error: updateResult.error };

  await logAudit(studyId, staff, 'STUDY_UPDATED');
  return fetchComparisonStudyById(studyId);
}

export interface ComparisonResultInput {
  id: string;
  previousResult?: number | null;
  newResult?: number | null;
  issueObservation?: string;
  correctiveAction?: string;
  repeatPerformed?: boolean;
  repeatPreviousResult?: number | null;
  repeatNewResult?: number | null;
  repeatReason?: string;
}

export async function saveComparisonResults(
  studyId: string,
  staff: StaffContext,
  inputs: ComparisonResultInput[],
): Promise<ClinicalResult<ComparisonStudy>> {
  const current = await fetchComparisonStudyById(studyId);
  if (!current.data) return { data: null, error: current.error ?? 'Study not found' };
  if (current.data.status !== 'draft' && current.data.status !== 'returned') {
    return { data: null, error: 'Study is read-only.' };
  }

  const supabase = createClient();
  for (const input of inputs) {
    const existing = current.data.results.find((r) => r.id === input.id);
    if (!existing) continue;
    const calc = calculateComparisonResult({
      previousResult: input.previousResult,
      newResult: input.newResult,
      taeLimit: existing.taeLimitSnapshot,
    });
    await supabase
      .from('comparison_study_results')
      .update({
        previous_result: input.previousResult ?? null,
        new_result: input.newResult ?? null,
        difference_units: calc.differenceUnits ?? null,
        difference_percent: calc.differencePercent ?? null,
        result_status: calc.resultStatus,
        issue_observation: input.issueObservation ?? null,
        corrective_action: input.correctiveAction ?? null,
        repeat_performed: input.repeatPerformed ?? false,
        repeat_previous_result: input.repeatPreviousResult ?? null,
        repeat_new_result: input.repeatNewResult ?? null,
        repeat_reason: input.repeatReason ?? null,
        repeat_by: input.repeatPerformed ? staff.userId : null,
        repeat_by_name: input.repeatPerformed ? staff.fullName : null,
        repeat_at: input.repeatPerformed ? new Date().toISOString() : null,
      })
      .eq('id', input.id);
  }

  const refreshed = await fetchComparisonStudyById(studyId);
  if (!refreshed.data) return refreshed;

  const overall = deriveOverallResult(refreshed.data.results);
  await supabase.from('comparison_studies').update({
    overall_result: overall,
    updated_by: staff.userId,
  }).eq('id', studyId);

  await logAudit(studyId, staff, 'RESULT_UPDATED', { metadata: { count: inputs.length } });
  return fetchComparisonStudyById(studyId);
}

export async function submitComparisonStudy(
  studyId: string,
  staff: StaffContext,
): Promise<ClinicalResult<ComparisonStudy>> {
  const current = await fetchComparisonStudyById(studyId);
  if (!current.data) return { data: null, error: current.error ?? 'Study not found' };
  if (current.data.status !== 'draft' && current.data.status !== 'returned') {
    return { data: null, error: 'Study cannot be submitted.' };
  }
  if (current.data.overallResult === 'incomplete') {
    return { data: null, error: 'Complete all required results before submitting.' };
  }

  const updateResult = await runClinicalMutation('Failed to submit comparison study', async () => {
    const supabase = createClient();
    return supabase
      .from('comparison_studies')
      .update({
        status: 'pending_review',
        prepared_by: staff.userId,
        prepared_by_name: staff.fullName,
        prepared_by_staff_id: staff.staffId,
        prepared_at: new Date().toISOString(),
        updated_by: staff.userId,
      })
      .eq('id', studyId)
      .select('*')
      .single();
  });
  if (!updateResult.data) return { data: null, error: updateResult.error };

  await logAudit(studyId, staff, 'STUDY_SUBMITTED', {
    oldStatus: current.data.status,
    newStatus: 'pending_review',
  });
  return fetchComparisonStudyById(studyId);
}

export async function reviewComparisonStudy(
  studyId: string,
  staff: StaffContext,
  input: { action: 'review' | 'return' | 'reject'; comment?: string },
): Promise<ClinicalResult<ComparisonStudy>> {
  const current = await fetchComparisonStudyById(studyId);
  if (!current.data) return { data: null, error: current.error ?? 'Study not found' };
  if (current.data.preparedBy === staff.userId) {
    return { data: null, error: 'Prepared by and reviewed by must be different users.' };
  }

  if ((input.action === 'return' || input.action === 'reject') && !input.comment?.trim()) {
    return { data: null, error: 'Comment is required for return or reject.' };
  }

  let newStatus: ComparisonStudy['status'] = 'pending_approval';
  if (input.action === 'return') newStatus = 'returned';
  if (input.action === 'reject') newStatus = 'rejected';

  const updateResult = await runClinicalMutation('Failed to review comparison study', async () => {
    const supabase = createClient();
    return supabase
      .from('comparison_studies')
      .update({
        status: newStatus,
        reviewed_by: staff.userId,
        reviewed_by_name: staff.fullName,
        reviewed_by_staff_id: staff.staffId,
        reviewed_at: new Date().toISOString(),
        review_comment: input.comment ?? null,
        updated_by: staff.userId,
      })
      .eq('id', studyId)
      .select('*')
      .single();
  });
  if (!updateResult.data) return { data: null, error: updateResult.error };

  await logAudit(studyId, staff, input.action === 'review' ? 'STUDY_REVIEWED' : input.action === 'return' ? 'STUDY_RETURNED' : 'STUDY_REJECTED', {
    oldStatus: current.data.status,
    newStatus,
    comment: input.comment,
  });
  return fetchComparisonStudyById(studyId);
}

export async function approveComparisonStudy(
  studyId: string,
  staff: StaffContext,
  input: { action: 'approve' | 'return' | 'reject'; comment?: string },
): Promise<ClinicalResult<ComparisonStudy>> {
  const current = await fetchComparisonStudyById(studyId);
  if (!current.data) return { data: null, error: current.error ?? 'Study not found' };

  if ((input.action === 'return' || input.action === 'reject') && !input.comment?.trim()) {
    return { data: null, error: 'Comment is required for return or reject.' };
  }

  if (input.action === 'approve') {
    if (!canApproveStudy(current.data.results)) {
      return { data: null, error: 'Unresolved manual review blocks approval.' };
    }
    if (current.data.reviewedBy === staff.userId) {
      return { data: null, error: 'Reviewed by and approved by should be different users.' };
    }
  }

  let newStatus: ComparisonStudy['status'] = 'approved';
  if (input.action === 'return') newStatus = 'returned';
  if (input.action === 'reject') newStatus = 'rejected';

  const updateResult = await runClinicalMutation('Failed to approve comparison study', async () => {
    const supabase = createClient();
    return supabase
      .from('comparison_studies')
      .update({
        status: newStatus,
        approved_by: input.action === 'approve' ? staff.userId : null,
        approved_by_name: input.action === 'approve' ? staff.fullName : null,
        approved_by_staff_id: input.action === 'approve' ? staff.staffId : null,
        approved_at: input.action === 'approve' ? new Date().toISOString() : null,
        approval_comment: input.comment ?? null,
        updated_by: staff.userId,
      })
      .eq('id', studyId)
      .select('*')
      .single();
  });
  if (!updateResult.data) return { data: null, error: updateResult.error };

  await logAudit(studyId, staff, input.action === 'approve' ? 'STUDY_APPROVED' : input.action === 'return' ? 'STUDY_RETURNED' : 'STUDY_REJECTED', {
    oldStatus: current.data.status,
    newStatus,
    comment: input.comment,
  });
  return fetchComparisonStudyById(studyId);
}

export async function completeManualReview(
  resultId: string,
  studyId: string,
  staff: StaffContext,
  input: { decision: ComparisonStudyResult['manualReviewDecision']; comment: string },
): Promise<ClinicalResult<ComparisonStudy>> {
  if (!manualReviewDecisionIsValid(input.decision, input.comment)) {
    return { data: null, error: 'Manual review decision and comment are required.' };
  }

  const supabase = createClient();
  await supabase
    .from('comparison_study_results')
    .update({
      manual_review_decision: input.decision,
      manual_review_comment: input.comment.trim(),
      manual_reviewed_by: staff.userId,
      manual_reviewed_by_name: staff.fullName,
      manual_reviewed_by_staff_id: staff.staffId,
      manual_reviewed_at: new Date().toISOString(),
    })
    .eq('id', resultId);

  await logAudit(studyId, staff, 'MANUAL_REVIEW_COMPLETED', { metadata: { resultId } });
  return fetchComparisonStudyById(studyId);
}

export async function createComparisonAmendment(
  studyId: string,
  staff: StaffContext,
  amendmentReason: string,
): Promise<ClinicalResult<ComparisonStudy>> {
  const current = await fetchComparisonStudyById(studyId);
  if (!current.data) return { data: null, error: current.error ?? 'Study not found' };
  if (current.data.status !== 'approved') {
    return { data: null, error: 'Only approved studies can be amended.' };
  }
  if (!amendmentReason.trim()) {
    return { data: null, error: 'Amendment reason is required.' };
  }

  const insertResult = await runClinicalMutation('Failed to create amendment', async () => {
    const supabase = createClient();
    return supabase
      .from('comparison_studies')
      .insert({
        study_number: current.data!.studyNumber,
        version_number: current.data!.versionNumber + 1,
        parent_study_id: studyId,
        amendment_reason: amendmentReason.trim(),
        study_type: current.data!.studyType,
        form_code: current.data!.formCode ?? null,
        study_title: `${current.data!.studyTitle} (Amendment)`,
        comparison_type: current.data!.comparisonType ?? null,
        reference_label: current.data!.referenceLabel ?? null,
        comparison_label: current.data!.comparisonLabel ?? null,
        status: 'draft',
        prepared_by: staff.userId,
        prepared_by_name: staff.fullName,
        prepared_by_staff_id: staff.staffId,
        created_by: staff.userId,
        updated_by: staff.userId,
      })
      .select('*')
      .single();
  });
  if (!insertResult.data) return { data: null, error: insertResult.error };

  await logAudit(studyId, staff, 'AMENDMENT_CREATED', {
    metadata: { newStudyId: (insertResult.data as StudyRow).id },
    comment: amendmentReason,
  });
  return fetchComparisonStudyById((insertResult.data as StudyRow).id);
}

export function summarizeStudy(study: ComparisonStudy) {
  return buildStudySummary(study.results, study.samples.length);
}

export async function logComparisonExport(
  studyId: string,
  staff: StaffContext,
  format: 'PDF' | 'EXCEL',
): Promise<void> {
  await logAudit(studyId, staff, format === 'PDF' ? 'PDF_EXPORTED' : 'EXCEL_EXPORTED');
}

export async function fetchComparisonAuditEvents(studyId: string) {
  const result = await runClinicalListQuery('Failed to load audit events', async () => {
    const supabase = createClient();
    return supabase
      .from('comparison_study_audit_events')
      .select('*')
      .eq('study_id', studyId)
      .order('created_at', { ascending: false });
  });
  return {
    data: (result.data as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as string,
      studyId: row.study_id as string,
      userId: row.user_id as string,
      userName: row.user_name as string,
      staffId: (row.staff_id as string | null) ?? undefined,
      action: row.action as string,
      oldStatus: row.old_status as string | null,
      newStatus: row.new_status as string | null,
      comment: row.comment as string | null,
      metadata: row.metadata as Record<string, unknown> | null,
      createdAt: row.created_at as string,
    })),
    error: result.error,
  };
}

export async function addComparisonSample(
  studyId: string,
  section: ComparisonSectionCode,
  sampleId: string,
  staff: StaffContext,
): Promise<ClinicalResult<ComparisonStudy>> {
  const current = await fetchComparisonStudyById(studyId);
  if (!current.data) return { data: null, error: current.error ?? 'Study not found' };
  if (current.data.status !== 'draft' && current.data.status !== 'returned') {
    return { data: null, error: 'Study is read-only.' };
  }

  const sectionSamples = current.data.samples.filter((s) => s.section === section);
  const defs = await fetchComparisonTestDefinitions();
  if (defs.error) return { data: null, error: defs.error };
  const sectionTests = defs.data.filter((def) => def.section === section);

  const supabase = createClient();
  const { data: sampleRow, error: sampleError } = await supabase
    .from('comparison_study_samples')
    .insert({
      study_id: studyId,
      section,
      sample_id: sampleId.trim(),
      display_order: sectionSamples.length,
    })
    .select('*')
    .single();
  if (sampleError || !sampleRow) return { data: null, error: sampleError?.message ?? 'Failed to add sample' };

  for (const [testIndex, test] of sectionTests.entries()) {
    await supabase.from('comparison_study_results').insert({
      sample_id: sampleRow.id,
      test_definition_id: test.id,
      test_code: test.testCode,
      test_name: test.testName,
      unit: test.unit,
      tae_limit_snapshot: test.taeLimit ?? null,
      display_order: testIndex,
    });
  }

  await logAudit(studyId, staff, 'SAMPLE_ADDED', { metadata: { sampleId, section } });
  return fetchComparisonStudyById(studyId);
}

export async function removeComparisonSample(
  studyId: string,
  sampleRowId: string,
  staff: StaffContext,
): Promise<ClinicalResult<ComparisonStudy>> {
  const current = await fetchComparisonStudyById(studyId);
  if (!current.data) return { data: null, error: current.error ?? 'Study not found' };
  if (current.data.status !== 'draft' && current.data.status !== 'returned') {
    return { data: null, error: 'Study is read-only.' };
  }

  const sample = current.data.samples.find((s) => s.id === sampleRowId);
  if (!sample) return { data: null, error: 'Sample not found.' };

  const supabase = createClient();
  await supabase.from('comparison_study_samples').delete().eq('id', sampleRowId);
  await logAudit(studyId, staff, 'SAMPLE_REMOVED', { metadata: { sampleId: sample.sampleId } });
  return fetchComparisonStudyById(studyId);
}

export async function archiveComparisonStudy(
  studyId: string,
  staff: StaffContext,
): Promise<ClinicalResult<ComparisonStudy>> {
  const current = await fetchComparisonStudyById(studyId);
  if (!current.data) return { data: null, error: current.error ?? 'Study not found' };

  const updateResult = await runClinicalMutation('Failed to archive comparison study', async () => {
    const supabase = createClient();
    return supabase
      .from('comparison_studies')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
        archived_by: staff.userId,
        updated_by: staff.userId,
      })
      .eq('id', studyId)
      .select('*')
      .single();
  });
  if (!updateResult.data) return { data: null, error: updateResult.error };

  await logAudit(studyId, staff, 'STUDY_ARCHIVED', {
    oldStatus: current.data.status,
    newStatus: 'archived',
  });
  return fetchComparisonStudyById(studyId);
}
