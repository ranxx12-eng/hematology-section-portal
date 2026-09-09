import { createClient } from '@/lib/supabase/client';
import { computeCompletionSummary } from '@/lib/stain-qc/calendar';
import {
  FORM_HEMA_021_CODE,
  STAIN_QC_CONTROLLED_CORRECTIVE_ACTION,
  STAIN_QC_CONTROLLED_CORRECTIVE_ACTION_CODE,
  getStainQcFormDefinition,
} from '@/lib/stain-qc/constants';
import { buildChangeStainAuditValue, sheetAllowsLotReplacement } from '@/lib/stain-qc/change-stain';
import { formatPerformerInitials } from '@/lib/shared/performer-identity';
import type { RapiStainCatalogSnapshot } from '@/lib/qc-records/rapi-catalog-status';
import type {
  StainQcCellStatus,
  StainQcCorrectiveAction,
  StainQcCriterion,
  StainQcDailyResult,
  StainQcFormCode,
  StainQcListItem,
  StainQcMonthlySheet,
  StainQcMonthlySheetDetail,
  StainQcOverallEvaluation,
  StainQcResponsibilityEntry,
  StainQcResponsibilityType,
  StainQcWorkflowStatus,
} from '@/types/stain-qc';
import type { StaffContext } from './staff-context';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

function mapSheet(row: Record<string, unknown>): StainQcMonthlySheet {
  return {
    id: row.id as string,
    sheetNumber: row.sheet_number as string,
    formCode: row.form_code as StainQcFormCode,
    formTitle: row.form_title as string,
    stainName: row.stain_name as string,
    lotNumber: row.lot_number as string,
    expiryDate: row.expiry_date as string,
    sheetMonth: row.sheet_month as number,
    sheetYear: row.sheet_year as number,
    overallEvaluation: (row.overall_evaluation as StainQcOverallSheet['overallEvaluation']) ?? undefined,
    status: row.status as StainQcWorkflowStatus,
    versionNumber: row.version_number as number,
    parentSheetId: (row.parent_sheet_id as string | null) ?? undefined,
    amendmentReason: (row.amendment_reason as string | null) ?? undefined,
    submittedBy: (row.submitted_by as string | null) ?? undefined,
    submittedByName: (row.submitted_by_name as string | null) ?? undefined,
    submittedByStaffId: (row.submitted_by_staff_id as string | null) ?? undefined,
    submittedAt: (row.submitted_at as string | null) ?? undefined,
    reviewedBy: (row.reviewed_by as string | null) ?? undefined,
    reviewedByName: (row.reviewed_by_name as string | null) ?? undefined,
    reviewedByStaffId: (row.reviewed_by_staff_id as string | null) ?? undefined,
    reviewedAt: (row.reviewed_at as string | null) ?? undefined,
    reviewComment: (row.review_comment as string | null) ?? undefined,
    approvedBy: (row.approved_by as string | null) ?? undefined,
    approvedByName: (row.approved_by_name as string | null) ?? undefined,
    approvedByStaffId: (row.approved_by_staff_id as string | null) ?? undefined,
    approvedAt: (row.approved_at as string | null) ?? undefined,
    approvalComment: (row.approval_comment as string | null) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

type StainQcOverallSheet = StainQcMonthlySheet;

function mapCriterion(row: Record<string, unknown>): StainQcCriterion {
  return {
    id: row.id as string,
    formCode: row.form_code as StainQcFormCode,
    criterionKey: row.criterion_key as string,
    sectionKey: row.section_key as string,
    sectionLabel: row.section_label as string,
    rowLabel: row.row_label as string,
    componentLabel: (row.component_label as string | null) ?? undefined,
    idealColor: (row.ideal_color as string | null) ?? undefined,
    displayOrder: row.display_order as number,
  };
}

function mapDailyResult(row: Record<string, unknown>): StainQcDailyResult {
  return {
    id: row.id as string,
    sheetId: row.sheet_id as string,
    formCode: row.form_code as StainQcFormCode,
    criterionKey: row.criterion_key as string,
    dayOfMonth: row.day_of_month as number,
    resultStatus: row.result_status as StainQcCellStatus,
    lotNumberSnapshot: row.lot_number_snapshot as string,
    recordedBy: row.recorded_by as string,
    recordedByName: row.recorded_by_name as string,
    recordedByStaffId: (row.recorded_by_staff_id as string | null) ?? undefined,
    recordedByEmployeeId: (row.recorded_by_employee_id as string | null) ?? undefined,
    recordedByInitials: row.recorded_by_initials as string,
    recordedAt: row.recorded_at as string,
    lastUpdatedBy: (row.last_updated_by as string | null) ?? undefined,
    lastUpdatedByName: (row.last_updated_by_name as string | null) ?? undefined,
    lastUpdatedAt: (row.last_updated_at as string | null) ?? undefined,
    amendmentReason: (row.amendment_reason as string | null) ?? undefined,
  };
}

function mapResponsibility(row: Record<string, unknown>): StainQcResponsibilityEntry {
  return {
    id: row.id as string,
    sheetId: row.sheet_id as string,
    formCode: row.form_code as StainQcFormCode,
    responsibilityType: row.responsibility_type as StainQcResponsibilityType,
    dayOfMonth: row.day_of_month as number,
    lotNumberSnapshot: row.lot_number_snapshot as string,
    recordedBy: row.recorded_by as string,
    recordedByName: row.recorded_by_name as string,
    recordedByStaffId: (row.recorded_by_staff_id as string | null) ?? undefined,
    recordedByEmployeeId: (row.recorded_by_employee_id as string | null) ?? undefined,
    recordedByInitials: row.recorded_by_initials as string,
    recordedAt: row.recorded_at as string,
    note: (row.note as string | null) ?? undefined,
  };
}

function mapCorrective(row: Record<string, unknown>): StainQcCorrectiveAction {
  return {
    id: row.id as string,
    sheetId: row.sheet_id as string,
    dailyResultId: row.daily_result_id as string,
    formCode: row.form_code as StainQcFormCode,
    criterionKey: row.criterion_key as string,
    dayOfMonth: row.day_of_month as number,
    lotNumberSnapshot: row.lot_number_snapshot as string,
    actionCode: (row.action_code as StainQcCorrectiveAction['actionCode']) ?? 'change_stain',
    comment: (row.comment as string | null) ?? undefined,
    recordedBy: row.recorded_by as string,
    recordedByName: row.recorded_by_name as string,
    recordedByStaffId: (row.recorded_by_staff_id as string | null) ?? undefined,
    recordedByInitials: row.recorded_by_initials as string,
    recordedAt: row.recorded_at as string,
    confirmedAt: row.confirmed_at as string,
  };
}

async function generateSheetNumber(formCode: StainQcFormCode): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = formCode === 'Form-Hema-021' ? 'RAPI-QC' : 'GIEMSA-QC';
  const supabase = createClient();
  const { count } = await supabase
    .from('stain_qc_monthly_sheets')
    .select('*', { count: 'exact', head: true })
    .eq('form_code', formCode)
    .like('sheet_number', `${prefix}-${year}-%`);
  const next = ((count ?? 0) + 1).toString().padStart(3, '0');
  return `${prefix}-${year}-${next}`;
}

async function logAudit(
  sheetId: string,
  staff: StaffContext,
  input: {
    entityType: 'daily_result' | 'responsibility' | 'sheet_header' | 'corrective_action';
    entityId?: string;
    criterionKey?: string;
    dayOfMonth?: number;
    fieldName: string;
    oldValue?: string | null;
    newValue?: string | null;
    reason?: string;
  },
): Promise<void> {
  const supabase = createClient();
  await supabase.from('stain_qc_audit_events').insert({
    sheet_id: sheetId,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    criterion_key: input.criterionKey ?? null,
    day_of_month: input.dayOfMonth ?? null,
    field_name: input.fieldName,
    old_value: input.oldValue ?? null,
    new_value: input.newValue ?? null,
    reason: input.reason ?? null,
    changed_by: staff.userId,
    changed_by_name: staff.fullName,
    changed_by_staff_id: staff.staffId,
  });
}

export async function fetchStainQcCriteria(formCode: StainQcFormCode): Promise<ClinicalListResult<StainQcCriterion>> {
  return runClinicalListQuery('Failed to load stain QC criteria', async () => {
    const supabase = createClient();
    return supabase
      .from('stain_qc_criteria')
      .select('*')
      .eq('form_code', formCode)
      .eq('is_active', true)
      .order('display_order');
  }).then((result) => ({
    ...result,
    data: (result.data ?? []).map((row) => mapCriterion(row as Record<string, unknown>)),
  }));
}

export async function fetchRapiStainCatalogSnapshot(
  now = new Date(),
): Promise<ClinicalResult<RapiStainCatalogSnapshot>> {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const supabase = createClient();

  const sheetRes = await supabase
    .from('stain_qc_monthly_sheets')
    .select('*')
    .eq('form_code', FORM_HEMA_021_CODE)
    .eq('sheet_month', month)
    .eq('sheet_year', year)
    .is('deleted_at', null)
    .maybeSingle();

  if (sheetRes.error) return { data: null, error: sheetRes.error.message };

  const criteriaRes = await fetchStainQcCriteria(FORM_HEMA_021_CODE);
  if (criteriaRes.error) return { data: null, error: criteriaRes.error };

  if (!sheetRes.data) {
    return {
      data: {
        sheet: null,
        criteria: criteriaRes.data ?? [],
        dailyResults: [],
        correctiveActions: [],
      },
      error: null,
    };
  }

  const sheet = mapSheet(sheetRes.data as Record<string, unknown>);
  const detail = await fetchStainQcSheetDetail(sheet.id);
  if (detail.error || !detail.data) {
    return { data: null, error: detail.error ?? 'Failed to load current RAPI stain sheet' };
  }

  return {
    data: {
      sheet: {
        id: sheet.id,
        status: sheet.status,
        lotNumber: sheet.lotNumber,
        expiryDate: sheet.expiryDate,
        sheetMonth: sheet.sheetMonth,
        sheetYear: sheet.sheetYear,
      },
      criteria: detail.data.criteria,
      dailyResults: detail.data.dailyResults,
      correctiveActions: detail.data.correctiveActions,
    },
    error: null,
  };
}

export async function fetchStainQcSheets(formCode: StainQcFormCode): Promise<ClinicalListResult<StainQcListItem>> {
  const base = await runClinicalListQuery('Failed to load stain QC sheets', async () => {
    const supabase = createClient();
    return supabase
      .from('stain_qc_monthly_sheets')
      .select('*')
      .eq('form_code', formCode)
      .is('deleted_at', null)
      .order('sheet_year', { ascending: false })
      .order('sheet_month', { ascending: false });
  });

  if (base.error) return { data: [], error: base.error };

  const criteriaRes = await fetchStainQcCriteria(formCode);
  const criteria = criteriaRes.data ?? [];

  const items: StainQcListItem[] = [];
  for (const row of base.data ?? []) {
    const sheet = mapSheet(row as Record<string, unknown>);
    const detail = await fetchStainQcSheetDetail(sheet.id);
    const summary = computeCompletionSummary({
      criteria,
      month: sheet.sheetMonth,
      year: sheet.sheetYear,
      results: detail.data?.dailyResults ?? [],
      correctiveActionResultIds: new Set(
        (detail.data?.correctiveActions ?? [])
          .filter((action) => action.actionCode === 'change_stain' && action.confirmedAt)
          .map((c) => c.dailyResultId),
      ),
    });
    items.push({
      ...sheet,
      completionPercent: summary.completionPercent,
      missingRequiredCount: summary.missingCells,
      notAcceptableCount: summary.notAcceptableCells,
      pendingCorrectiveCount: summary.pendingCorrectiveCount,
    });
  }

  return { data: items, error: null };
}

export async function fetchStainQcSheetDetail(sheetId: string): Promise<ClinicalResult<StainQcMonthlySheetDetail>> {
  const supabase = createClient();
  const sheetRes = await supabase
    .from('stain_qc_monthly_sheets')
    .select('*')
    .eq('id', sheetId)
    .is('deleted_at', null)
    .maybeSingle();

  if (sheetRes.error) return { data: null, error: sheetRes.error.message };
  if (!sheetRes.data) return { data: null, error: 'Sheet not found' };

  const sheet = mapSheet(sheetRes.data as Record<string, unknown>);
  const [criteriaRes, resultsRes, responsibilityRes, correctiveRes] = await Promise.all([
    fetchStainQcCriteria(sheet.formCode),
    supabase.from('stain_qc_daily_results').select('*').eq('sheet_id', sheetId),
    supabase.from('stain_qc_responsibility_entries').select('*').eq('sheet_id', sheetId),
    supabase.from('stain_qc_corrective_actions').select('*').eq('sheet_id', sheetId),
  ]);

  if (resultsRes.error) return { data: null, error: resultsRes.error.message };
  if (responsibilityRes.error) return { data: null, error: responsibilityRes.error.message };
  if (correctiveRes.error) return { data: null, error: correctiveRes.error.message };

  return {
    data: {
      ...sheet,
      criteria: criteriaRes.data ?? [],
      dailyResults: (resultsRes.data ?? []).map((row) => mapDailyResult(row as Record<string, unknown>)),
      responsibilityEntries: (responsibilityRes.data ?? []).map((row) => mapResponsibility(row as Record<string, unknown>)),
      correctiveActions: (correctiveRes.data ?? []).map((row) => mapCorrective(row as Record<string, unknown>)),
    },
    error: null,
  };
}

export async function createStainQcSheet(input: {
  formCode: StainQcFormCode;
  lotNumber: string;
  expiryDate: string;
  sheetMonth: number;
  sheetYear: number;
  staff: StaffContext;
}): Promise<ClinicalResult<StainQcMonthlySheet>> {
  const def = getStainQcFormDefinition(input.formCode);
  return runClinicalMutation('Failed to create stain QC sheet', async () => {
    const supabase = createClient();
    const sheetNumber = await generateSheetNumber(input.formCode);
    return supabase.from('stain_qc_monthly_sheets').insert({
      sheet_number: sheetNumber,
      form_code: input.formCode,
      form_title: def.formTitle,
      stain_name: def.stainName,
      lot_number: input.lotNumber.trim(),
      expiry_date: input.expiryDate,
      sheet_month: input.sheetMonth,
      sheet_year: input.sheetYear,
      created_by: input.staff.userId,
      updated_by: input.staff.userId,
    }).select('*').single();
  }).then((result) => ({
    data: result.data ? mapSheet(result.data as Record<string, unknown>) : null,
    error: result.error,
  }));
}

export async function updateStainQcSheetHeader(input: {
  sheetId: string;
  sheet: Pick<StainQcMonthlySheet, 'lotNumber' | 'expiryDate'>;
  lotNumber?: string;
  expiryDate?: string;
  overallEvaluation?: StainQcOverallEvaluation | null;
  hasDailyResults?: boolean;
  staff: StaffContext;
}): Promise<ClinicalResult<StainQcMonthlySheet>> {
  const lotCheck = sheetAllowsLotReplacement({
    currentLotNumber: input.sheet.lotNumber,
    currentExpiryDate: input.sheet.expiryDate,
    nextLotNumber: input.lotNumber,
    nextExpiryDate: input.expiryDate,
    hasDailyResults: input.hasDailyResults ?? false,
  });
  if (!lotCheck.allowed) {
    return { data: null, error: lotCheck.reason ?? 'Lot replacement requires a new monthly sheet.' };
  }

  return runClinicalMutation('Failed to update stain QC sheet header', async () => {
    const supabase = createClient();
    const payload: Record<string, unknown> = { updated_by: input.staff.userId };
    if (input.lotNumber != null) payload.lot_number = input.lotNumber.trim();
    if (input.expiryDate != null) payload.expiry_date = input.expiryDate;
    if (input.overallEvaluation !== undefined) payload.overall_evaluation = input.overallEvaluation;
    return supabase.from('stain_qc_monthly_sheets').update(payload).eq('id', input.sheetId).select('*').single();
  }).then(async (result) => {
    if (result.data) {
      await logAudit(input.sheetId, input.staff, {
        entityType: 'sheet_header',
        fieldName: 'header',
        newValue: JSON.stringify({ lotNumber: input.lotNumber, expiryDate: input.expiryDate, overallEvaluation: input.overallEvaluation }),
      });
    }
    return {
      data: result.data ? mapSheet(result.data as Record<string, unknown>) : null,
      error: result.error,
    };
  });
}

export async function upsertStainQcDailyResult(input: {
  sheet: StainQcMonthlySheet;
  criterionKey: string;
  dayOfMonth: number;
  resultStatus: StainQcCellStatus | null;
  staff: StaffContext;
  employeeId?: string | null;
  amendmentReason?: string;
}): Promise<ClinicalResult<StainQcDailyResult | null>> {
  if (input.sheet.status !== 'draft') {
    return { data: null, error: 'Approved or submitted sheets cannot be edited directly' };
  }
  if (!input.sheet.lotNumber?.trim() || !input.sheet.expiryDate) {
    return { data: null, error: 'Lot number and expiry date are required before daily results can be entered' };
  }

  const supabase = createClient();
  const existingRes = await supabase
    .from('stain_qc_daily_results')
    .select('*')
    .eq('sheet_id', input.sheet.id)
    .eq('criterion_key', input.criterionKey)
    .eq('day_of_month', input.dayOfMonth)
    .maybeSingle();

  const existing = existingRes.data ? mapDailyResult(existingRes.data as Record<string, unknown>) : null;

  if (input.resultStatus == null) {
    if (!existing) return { data: null, error: null };
    await supabase.from('stain_qc_corrective_actions').delete().eq('daily_result_id', existing.id);
    const del = await supabase.from('stain_qc_daily_results').delete().eq('id', existing.id);
    if (del.error) return { data: null, error: del.error.message };
    await syncQcCorrectionResponsibilityForDay(input.sheet.id, input.dayOfMonth);
    await logAudit(input.sheet.id, input.staff, {
      entityType: 'daily_result',
      entityId: existing.id,
      criterionKey: input.criterionKey,
      dayOfMonth: input.dayOfMonth,
      fieldName: 'result_status',
      oldValue: existing.resultStatus,
      newValue: null,
    });
    return { data: null, error: null };
  }

  if (existing?.resultStatus === 'not_acceptable' && input.resultStatus !== existing.resultStatus) {
    if (!input.amendmentReason?.trim()) {
      return { data: null, error: 'A reason is required when changing a saved Not Acceptable result' };
    }
  }

  const initials = formatPerformerInitials(input.staff.fullName, input.staff.staffId);
  const payload = {
    sheet_id: input.sheet.id,
    form_code: input.sheet.formCode,
    criterion_key: input.criterionKey,
    day_of_month: input.dayOfMonth,
    result_status: input.resultStatus,
    lot_number_snapshot: input.sheet.lotNumber,
    recorded_by: existing?.recordedBy ?? input.staff.userId,
    recorded_by_name: existing?.recordedByName ?? input.staff.fullName,
    recorded_by_staff_id: existing?.recordedByStaffId ?? input.staff.staffId,
    recorded_by_employee_id: existing?.recordedByEmployeeId ?? input.employeeId ?? null,
    recorded_by_initials: existing?.recordedByInitials ?? initials,
    recorded_at: existing?.recordedAt ?? new Date().toISOString(),
    last_updated_by: input.staff.userId,
    last_updated_by_name: input.staff.fullName,
    last_updated_at: new Date().toISOString(),
    amendment_reason: input.amendmentReason ?? null,
  };

  const write = await supabase
    .from('stain_qc_daily_results')
    .upsert(payload, { onConflict: 'sheet_id,criterion_key,day_of_month' })
    .select('*')
    .single();

  if (write.error) return { data: null, error: write.error.message };

  await logAudit(input.sheet.id, input.staff, {
    entityType: 'daily_result',
    entityId: write.data.id as string,
    criterionKey: input.criterionKey,
    dayOfMonth: input.dayOfMonth,
    fieldName: 'result_status',
    oldValue: existing?.resultStatus ?? null,
    newValue: input.resultStatus,
    reason: input.amendmentReason,
  });

  if (input.resultStatus !== 'not_acceptable' && existing?.id) {
    await supabase.from('stain_qc_corrective_actions').delete().eq('daily_result_id', existing.id);
    await syncQcCorrectionResponsibilityForDay(input.sheet.id, input.dayOfMonth);
  }

  return { data: mapDailyResult(write.data as Record<string, unknown>), error: null };
}

async function syncQcCorrectionResponsibilityForDay(sheetId: string, dayOfMonth: number): Promise<void> {
  const supabase = createClient();
  const { data: remaining } = await supabase
    .from('stain_qc_corrective_actions')
    .select('id, day_of_month')
    .eq('sheet_id', sheetId)
    .eq('day_of_month', dayOfMonth);

  if ((remaining ?? []).length === 0) {
    await supabase
      .from('stain_qc_responsibility_entries')
      .delete()
      .eq('sheet_id', sheetId)
      .eq('responsibility_type', 'qc_correction_change_stain')
      .eq('day_of_month', dayOfMonth);
  }
}

export async function confirmStainQcChangeStain(input: {
  sheet: StainQcMonthlySheet;
  dailyResultId: string;
  criterionKey: string;
  dayOfMonth: number;
  optionalComment?: string;
  staff: StaffContext;
  employeeId?: string | null;
}): Promise<ClinicalResult<StainQcCorrectiveAction>> {
  const supabase = createClient();
  const { data: dailyResult, error: dailyError } = await supabase
    .from('stain_qc_daily_results')
    .select('id, result_status')
    .eq('id', input.dailyResultId)
    .maybeSingle();

  if (dailyError) return { data: null, error: dailyError.message };
  if (!dailyResult || dailyResult.result_status !== 'not_acceptable') {
    return { data: null, error: 'Change Stain can only be confirmed for Not Acceptable results' };
  }

  const initials = formatPerformerInitials(input.staff.fullName, input.staff.staffId);
  const recordedAt = new Date().toISOString();

  return runClinicalMutation('Failed to confirm Change Stain', async () => {
    const corrective = await supabase.from('stain_qc_corrective_actions').upsert({
      sheet_id: input.sheet.id,
      daily_result_id: input.dailyResultId,
      form_code: input.sheet.formCode,
      criterion_key: input.criterionKey,
      day_of_month: input.dayOfMonth,
      lot_number_snapshot: input.sheet.lotNumber,
      action_code: STAIN_QC_CONTROLLED_CORRECTIVE_ACTION_CODE,
      comment: input.optionalComment?.trim() || null,
      recorded_by: input.staff.userId,
      recorded_by_name: input.staff.fullName,
      recorded_by_staff_id: input.staff.staffId,
      recorded_by_employee_id: input.employeeId ?? null,
      recorded_by_initials: initials,
      recorded_at: recordedAt,
      confirmed_at: recordedAt,
    }, { onConflict: 'daily_result_id' }).select('*').single();

    if (corrective.error) return corrective;

    await supabase.from('stain_qc_responsibility_entries').upsert({
      sheet_id: input.sheet.id,
      form_code: input.sheet.formCode,
      responsibility_type: 'qc_correction_change_stain',
      day_of_month: input.dayOfMonth,
      lot_number_snapshot: input.sheet.lotNumber,
      recorded_by: input.staff.userId,
      recorded_by_name: input.staff.fullName,
      recorded_by_staff_id: input.staff.staffId,
      recorded_by_employee_id: input.employeeId ?? null,
      recorded_by_initials: initials,
      recorded_at: recordedAt,
      note: STAIN_QC_CONTROLLED_CORRECTIVE_ACTION,
    }, { onConflict: 'sheet_id,responsibility_type,day_of_month' });

    return corrective;
  }).then(async (result) => {
    const row = result.data as Record<string, unknown> | null;
    if (row) {
      await logAudit(input.sheet.id, input.staff, {
        entityType: 'corrective_action',
        entityId: row.id as string,
        criterionKey: input.criterionKey,
        dayOfMonth: input.dayOfMonth,
        fieldName: 'change_stain',
        newValue: buildChangeStainAuditValue({
          criterionKey: input.criterionKey,
          dayOfMonth: input.dayOfMonth,
          recordedByName: input.staff.fullName,
          recordedByInitials: initials,
          recordedAt,
          optionalComment: input.optionalComment,
        }),
      });
      await logAudit(input.sheet.id, input.staff, {
        entityType: 'responsibility',
        criterionKey: input.criterionKey,
        dayOfMonth: input.dayOfMonth,
        fieldName: 'qc_correction_change_stain',
        newValue: `${STAIN_QC_CONTROLLED_CORRECTIVE_ACTION} · ${initials}`,
      });
    }
    return {
      data: row ? mapCorrective(row) : null,
      error: result.error,
    };
  });
}

export async function recordStainQcResponsibility(input: {
  sheet: StainQcMonthlySheet;
  responsibilityType: StainQcResponsibilityType;
  dayOfMonth: number;
  note?: string;
  staff: StaffContext;
  employeeId?: string | null;
}): Promise<ClinicalResult<StainQcResponsibilityEntry>> {
  if (input.sheet.status !== 'draft') {
    return { data: null, error: 'Responsibility entries cannot be changed on locked sheets' };
  }
  if (input.responsibilityType === 'qc_correction_change_stain') {
    return { data: null, error: 'QC Correction / Change Stain is recorded automatically when Change Stain is confirmed' };
  }
  if (!input.sheet.lotNumber?.trim() || !input.sheet.expiryDate) {
    return { data: null, error: 'Lot number and expiry date are required before recording responsibility' };
  }

  const initials = formatPerformerInitials(input.staff.fullName, input.staff.staffId);
  return runClinicalMutation('Failed to record responsibility entry', async () => {
    const supabase = createClient();
    return supabase.from('stain_qc_responsibility_entries').upsert({
      sheet_id: input.sheet.id,
      form_code: input.sheet.formCode,
      responsibility_type: input.responsibilityType,
      day_of_month: input.dayOfMonth,
      lot_number_snapshot: input.sheet.lotNumber,
      recorded_by: input.staff.userId,
      recorded_by_name: input.staff.fullName,
      recorded_by_staff_id: input.staff.staffId,
      recorded_by_employee_id: input.employeeId ?? null,
      recorded_by_initials: initials,
      recorded_at: new Date().toISOString(),
      note: input.note?.trim() || null,
    }, { onConflict: 'sheet_id,responsibility_type,day_of_month' }).select('*').single();
  }).then((result) => ({
    data: result.data ? mapResponsibility(result.data as Record<string, unknown>) : null,
    error: result.error,
  }));
}

export async function transitionStainQcWorkflow(input: {
  sheetId: string;
  action: 'submit' | 'review' | 'approve';
  comment?: string;
}): Promise<ClinicalResult<StainQcMonthlySheet>> {
  return runClinicalMutation('Workflow transition failed', async () => {
    const supabase = createClient();
    return supabase.rpc('stain_qc_transition_workflow', {
      p_sheet_id: input.sheetId,
      p_action: input.action,
      p_comment: input.comment ?? null,
    });
  }).then((result) => ({
    data: result.data ? mapSheet(Array.isArray(result.data) ? result.data[0] as Record<string, unknown> : result.data as Record<string, unknown>) : null,
    error: result.error,
  }));
}

export async function findOrCreateStainQcMonthlySheet(input: {
  formCode: StainQcFormCode;
  lotNumber: string;
  expiryDate: string;
  sheetMonth: number;
  sheetYear: number;
  staff: StaffContext;
}): Promise<ClinicalResult<StainQcMonthlySheet>> {
  const supabase = createClient();
  const existingRes = await supabase
    .from('stain_qc_monthly_sheets')
    .select('*')
    .eq('form_code', input.formCode)
    .eq('sheet_month', input.sheetMonth)
    .eq('sheet_year', input.sheetYear)
    .eq('lot_number', input.lotNumber.trim())
    .is('deleted_at', null)
    .order('version_number', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingRes.error) return { data: null, error: existingRes.error.message };
  if (existingRes.data) {
    return { data: mapSheet(existingRes.data as Record<string, unknown>), error: null };
  }
  return createStainQcSheet(input);
}

export interface RapiStainDailyCriterionResult {
  criterionKey: string;
  resultStatus: StainQcCellStatus;
  changeStainComment?: string;
}

export async function saveRapiStainDailyEntry(input: {
  entryDate: string;
  lotNumber: string;
  expiryDate: string;
  results: RapiStainDailyCriterionResult[];
  staff: StaffContext;
  employeeId?: string | null;
}): Promise<ClinicalResult<{ sheetId: string; dayOfMonth: number }>> {
  const entry = new Date(input.entryDate);
  if (Number.isNaN(entry.getTime())) {
    return { data: null, error: 'Invalid entry date' };
  }
  const sheetMonth = entry.getMonth() + 1;
  const sheetYear = entry.getFullYear();
  const dayOfMonth = entry.getDate();

  const sheetRes = await findOrCreateStainQcMonthlySheet({
    formCode: FORM_HEMA_021_CODE,
    lotNumber: input.lotNumber,
    expiryDate: input.expiryDate,
    sheetMonth,
    sheetYear,
    staff: input.staff,
  });
  if (sheetRes.error || !sheetRes.data) {
    return { data: null, error: sheetRes.error ?? 'Failed to resolve monthly sheet' };
  }

  const sheet = sheetRes.data;
  if (sheet.status !== 'draft') {
    return { data: null, error: 'The monthly Form-Hema-021 sheet for this lot and period is locked' };
  }

  for (const result of input.results) {
    const upsert = await upsertStainQcDailyResult({
      sheet,
      criterionKey: result.criterionKey,
      dayOfMonth,
      resultStatus: result.resultStatus,
      staff: input.staff,
      employeeId: input.employeeId,
    });
    if (upsert.error) return { data: null, error: upsert.error };
    if (result.resultStatus === 'not_acceptable' && upsert.data?.id) {
      const corrective = await confirmStainQcChangeStain({
        sheet,
        dailyResultId: upsert.data.id,
        criterionKey: result.criterionKey,
        dayOfMonth,
        optionalComment: result.changeStainComment,
        staff: input.staff,
        employeeId: input.employeeId,
      });
      if (corrective.error) return { data: null, error: corrective.error };
    }
  }

  return { data: { sheetId: sheet.id, dayOfMonth }, error: null };
}
