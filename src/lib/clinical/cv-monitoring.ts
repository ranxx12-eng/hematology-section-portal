import { createClient } from '@/lib/supabase/client';
import {
  buildCvMonitoringSummary,
  canApproveCvRecord,
  deriveOverallStatus,
  recalculateResultRow,
} from '@/lib/cv-monitoring/calculation';
import {
  CV_QC_LEVELS,
  derivePreviousMonth,
  FORM_HEMA_015_CODE,
  FORM_HEMA_015_QID,
} from '@/lib/cv-monitoring/constants';
import type {
  CvMonitoringDefinition,
  CvMonitoringLevel,
  CvMonitoringListItem,
  CvMonitoringRecord,
  CvMonitoringResult,
  CvMonitoringStatus,
  CvPreviousSourceType,
  CvQualityDisposition,
  CvTrendDataPoint,
} from '@/types/cv-monitoring';
import type { StaffContext } from './staff-context';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface RecordRow {
  id: string;
  monitoring_number: string;
  form_code: string;
  qid: string;
  instrument_id: string;
  instrument_name_snapshot: string;
  current_month: number;
  current_year: number;
  previous_month: number;
  previous_year: number;
  status: CvMonitoringStatus;
  overall_status: CvMonitoringRecord['overallStatus'];
  general_comments: string | null;
  notes: string | null;
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
  archived_at: string | null;
}

async function logAudit(
  recordId: string,
  staff: StaffContext,
  action: string,
  opts?: {
    oldStatus?: CvMonitoringStatus;
    newStatus?: CvMonitoringStatus;
    comment?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const supabase = createClient();
  await supabase.from('cv_monitoring_audit_events').insert({
    record_id: recordId,
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

async function generateMonitoringNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const supabase = createClient();
  const { count } = await supabase
    .from('cv_monitoring_monthly_records')
    .select('*', { count: 'exact', head: true })
    .like('monitoring_number', `CV-${year}-%`);
  const next = ((count ?? 0) + 1).toString().padStart(3, '0');
  return `CV-${year}-${next}`;
}

function mapResult(row: Record<string, unknown>, sourceMonitoringNumber?: string): CvMonitoringResult {
  return {
    id: row.id as string,
    monthlyRecordId: row.monthly_record_id as string,
    levelId: row.level_id as string,
    definitionId: (row.definition_id as string | null) ?? undefined,
    analyteCode: row.analyte_code_snapshot as string,
    analyteName: row.analyte_name_snapshot as string,
    unit: (row.unit_snapshot as string | null) ?? undefined,
    cvLimitSnapshot: row.cv_limit_snapshot != null ? Number(row.cv_limit_snapshot) : undefined,
    previousMean: row.previous_mean != null ? Number(row.previous_mean) : undefined,
    previousSd: row.previous_sd != null ? Number(row.previous_sd) : undefined,
    previousCvPercent: row.previous_cv_percent != null ? Number(row.previous_cv_percent) : undefined,
    previousStatus: row.previous_status as CvMonitoringResult['previousStatus'],
    previousSourceType: (row.previous_source_type as CvPreviousSourceType | null) ?? undefined,
    previousSourceRecordId: (row.previous_source_record_id as string | null) ?? undefined,
    previousSourceMonitoringNumber: sourceMonitoringNumber,
    previousManualReason: (row.previous_manual_reason as string | null) ?? undefined,
    previousManualEnteredBy: (row.previous_manual_entered_by_name as string | null) ?? undefined,
    previousManualEnteredAt: (row.previous_manual_entered_at as string | null) ?? undefined,
    currentMean: row.current_mean != null ? Number(row.current_mean) : undefined,
    currentSd: row.current_sd != null ? Number(row.current_sd) : undefined,
    currentCvPercent: row.current_cv_percent != null ? Number(row.current_cv_percent) : undefined,
    currentStatus: row.current_status as CvMonitoringResult['currentStatus'],
    cvChange: row.cv_change != null ? Number(row.cv_change) : undefined,
    trendStatus: (row.trend_status as CvMonitoringResult['trendStatus']) ?? undefined,
    comment: (row.comment as string | null) ?? undefined,
    observation: (row.observation as string | null) ?? undefined,
    investigation: (row.investigation as string | null) ?? undefined,
    possibleCause: (row.possible_cause as string | null) ?? undefined,
    correctiveAction: (row.corrective_action as string | null) ?? undefined,
    followUpRequired: row.follow_up_required != null ? Boolean(row.follow_up_required) : undefined,
    followUpComment: (row.follow_up_comment as string | null) ?? undefined,
    qualityDisposition: (row.quality_disposition as CvQualityDisposition | null) ?? undefined,
    displayOrder: row.display_order as number,
  };
}

async function fetchRecordRelations(recordId: string) {
  const supabase = createClient();
  const [levelsRes, resultsRes] = await Promise.all([
    supabase.from('cv_monitoring_levels').select('*').eq('monthly_record_id', recordId).order('display_order'),
    supabase.from('cv_monitoring_results').select('*').eq('monthly_record_id', recordId).order('display_order'),
  ]);

  const levels: CvMonitoringLevel[] = (levelsRes.data ?? []).map((row) => ({
    id: row.id as string,
    monthlyRecordId: row.monthly_record_id as string,
    qcLevel: row.qc_level as CvMonitoringLevel['qcLevel'],
    lotNumber: (row.lot_number as string | null) ?? undefined,
    displayOrder: row.display_order as number,
  }));

  const sourceIds = [...new Set((resultsRes.data ?? [])
    .map((r) => r.previous_source_record_id as string | null)
    .filter(Boolean))] as string[];

  const sourceNumbers = new Map<string, string>();
  if (sourceIds.length > 0) {
    const { data } = await supabase
      .from('cv_monitoring_monthly_records')
      .select('id, monitoring_number')
      .in('id', sourceIds);
    for (const row of data ?? []) {
      sourceNumbers.set(row.id as string, row.monitoring_number as string);
    }
  }

  const results: CvMonitoringResult[] = (resultsRes.data ?? []).map((row) =>
    mapResult(row as Record<string, unknown>, row.previous_source_record_id
      ? sourceNumbers.get(row.previous_source_record_id as string)
      : undefined),
  );

  return { levels, results };
}

function mapRecord(row: RecordRow, levels: CvMonitoringLevel[], results: CvMonitoringResult[]): CvMonitoringRecord {
  return {
    id: row.id,
    monitoringNumber: row.monitoring_number,
    formCode: row.form_code,
    qid: row.qid,
    instrumentId: row.instrument_id,
    instrumentNameSnapshot: row.instrument_name_snapshot,
    currentMonth: row.current_month,
    currentYear: row.current_year,
    previousMonth: row.previous_month,
    previousYear: row.previous_year,
    status: row.status,
    overallStatus: row.overall_status ?? undefined,
    generalComments: row.general_comments ?? undefined,
    notes: row.notes ?? undefined,
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
    levels,
    results,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at ?? undefined,
  };
}

export async function fetchCvMonitoringDefinitions(instrumentId?: string): Promise<ClinicalListResult<CvMonitoringDefinition>> {
  const result = await runClinicalListQuery('Failed to load CV definitions', async () => {
    const supabase = createClient();
    let query = supabase
      .from('cv_monitoring_definitions')
      .select('*, instruments(name)')
      .eq('is_active', true)
      .order('qc_level')
      .order('display_order');
    if (instrumentId) query = query.eq('instrument_id', instrumentId);
    return query;
  });

  return {
    data: (result.data as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as string,
      instrumentId: row.instrument_id as string,
      instrumentName: (row.instruments as { name?: string } | null)?.name,
      analyteCode: row.analyte_code as string,
      analyteName: row.analyte_name as string,
      qcLevel: row.qc_level as CvMonitoringDefinition['qcLevel'],
      unit: (row.unit as string | null) ?? undefined,
      cvLimitPercent: Number(row.cv_limit_percent),
      displayOrder: row.display_order as number,
      isActive: row.is_active as boolean,
      effectiveFrom: (row.effective_from as string | null) ?? undefined,
      effectiveTo: (row.effective_to as string | null) ?? undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    })),
    error: result.error,
  };
}

export async function updateCvMonitoringDefinition(
  definitionId: string,
  staff: StaffContext,
  patch: Partial<Pick<CvMonitoringDefinition, 'cvLimitPercent' | 'isActive' | 'displayOrder' | 'unit'>>,
  reason: string,
): Promise<ClinicalResult<CvMonitoringDefinition>> {
  if (!reason.trim()) return { data: null, error: 'Change reason is required.' };

  const supabase = createClient();
  const { data: existing } = await supabase
    .from('cv_monitoring_definitions')
    .select('*')
    .eq('id', definitionId)
    .single();
  if (!existing) return { data: null, error: 'Definition not found.' };

  const updates: Record<string, unknown> = { updated_by: staff.userId };
  const auditFields: Array<{ field: string; oldVal: string; newVal: string }> = [];

  if (patch.cvLimitPercent != null && patch.cvLimitPercent !== Number(existing.cv_limit_percent)) {
    updates.cv_limit_percent = patch.cvLimitPercent;
    auditFields.push({
      field: 'cv_limit_percent',
      oldVal: String(existing.cv_limit_percent),
      newVal: String(patch.cvLimitPercent),
    });
  }
  if (patch.isActive != null && patch.isActive !== existing.is_active) {
    updates.is_active = patch.isActive;
    auditFields.push({ field: 'is_active', oldVal: String(existing.is_active), newVal: String(patch.isActive) });
  }
  if (patch.displayOrder != null) updates.display_order = patch.displayOrder;
  if (patch.unit != null) updates.unit = patch.unit;

  const { data, error } = await supabase
    .from('cv_monitoring_definitions')
    .update(updates)
    .eq('id', definitionId)
    .select('*')
    .single();
  if (error || !data) return { data: null, error: error?.message ?? 'Update failed' };

  for (const audit of auditFields) {
    await supabase.from('cv_monitoring_definition_audit_events').insert({
      definition_id: definitionId,
      field_name: audit.field,
      old_value: audit.oldVal,
      new_value: audit.newVal,
      changed_by: staff.userId,
      changed_by_name: staff.fullName,
      staff_id: staff.staffId,
      reason: reason.trim(),
    });
  }

  return {
    data: {
      id: data.id as string,
      instrumentId: data.instrument_id as string,
      analyteCode: data.analyte_code as string,
      analyteName: data.analyte_name as string,
      qcLevel: data.qc_level as CvMonitoringDefinition['qcLevel'],
      unit: (data.unit as string | null) ?? undefined,
      cvLimitPercent: Number(data.cv_limit_percent),
      displayOrder: data.display_order as number,
      isActive: data.is_active as boolean,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    },
    error: null,
  };
}

async function seedRecordStructure(
  recordId: string,
  instrumentId: string,
): Promise<void> {
  const supabase = createClient();
  const defs = await fetchCvMonitoringDefinitions(instrumentId);
  if (defs.error) throw new Error(defs.error);

  for (const [index, qcLevel] of CV_QC_LEVELS.entries()) {
    const { data: levelRow } = await supabase
      .from('cv_monitoring_levels')
      .insert({ monthly_record_id: recordId, qc_level: qcLevel, display_order: index })
      .select('*')
      .single();
    if (!levelRow) continue;

    const levelDefs = defs.data.filter((d) => d.qcLevel === qcLevel);
    for (const [defIndex, def] of levelDefs.entries()) {
      await supabase.from('cv_monitoring_results').insert({
        monthly_record_id: recordId,
        level_id: levelRow.id,
        definition_id: def.id,
        analyte_code_snapshot: def.analyteCode,
        analyte_name_snapshot: def.analyteName,
        unit_snapshot: def.unit ?? null,
        cv_limit_snapshot: def.cvLimitPercent,
        display_order: defIndex,
      });
    }
  }
}

async function autoPopulatePreviousMonth(recordId: string, staff: StaffContext): Promise<boolean> {
  const record = await fetchCvMonitoringRecordById(recordId);
  if (!record.data) return false;

  const supabase = createClient();
  const { data: priorRecord } = await supabase
    .from('cv_monitoring_monthly_records')
    .select('id, monitoring_number')
    .eq('instrument_id', record.data.instrumentId)
    .eq('current_month', record.data.previousMonth)
    .eq('current_year', record.data.previousYear)
    .eq('status', 'approved')
    .is('deleted_at', null)
    .maybeSingle();

  if (!priorRecord) return false;

  const priorRelations = await fetchRecordRelations(priorRecord.id as string);
  let populated = false;

  for (const result of record.data.results) {
    const level = record.data.levels.find((l) => l.id === result.levelId);
    const priorLevel = priorRelations.levels.find((l) => l.qcLevel === level?.qcLevel);
    const priorResult = priorRelations.results.find(
      (r) => r.levelId === priorLevel?.id && r.analyteCode === result.analyteCode,
    );
    if (priorResult?.currentMean == null || priorResult?.currentSd == null) continue;

    const calc = recalculateResultRow({
      previousMean: priorResult.currentMean,
      previousSd: priorResult.currentSd,
      currentMean: result.currentMean,
      currentSd: result.currentSd,
      cvLimitSnapshot: result.cvLimitSnapshot,
    });

    await supabase.from('cv_monitoring_results').update({
      previous_mean: priorResult.currentMean ?? null,
      previous_sd: priorResult.currentSd ?? null,
      previous_cv_percent: priorResult.currentCvPercent ?? null,
      previous_status: priorResult.currentStatus,
      previous_source_type: 'auto_from_approved_record',
      previous_source_record_id: priorRecord.id,
      ...calc,
    }).eq('id', result.id);
    populated = true;
  }

  if (populated) {
    await logAudit(recordId, staff, 'PREVIOUS_MONTH_AUTO_POPULATED', {
      metadata: { sourceRecordId: priorRecord.id, sourceMonitoringNumber: priorRecord.monitoring_number },
    });
  }
  return populated;
}

export interface CreateCvMonitoringInput {
  instrumentId: string;
  instrumentName: string;
  currentMonth: number;
  currentYear: number;
  notes?: string;
  levelLots?: Partial<Record<'N' | 'P', string>>;
}

export async function createCvMonitoringDraft(
  staff: StaffContext,
  input: CreateCvMonitoringInput,
): Promise<ClinicalResult<CvMonitoringRecord>> {
  const previous = derivePreviousMonth(input.currentMonth, input.currentYear);
  const monitoringNumber = await generateMonitoringNumber();

  const insertResult = await runClinicalMutation('Failed to create CV monitoring record', async () => {
    const supabase = createClient();
    return supabase
      .from('cv_monitoring_monthly_records')
      .insert({
        monitoring_number: monitoringNumber,
        form_code: FORM_HEMA_015_CODE,
        qid: FORM_HEMA_015_QID,
        instrument_id: input.instrumentId,
        instrument_name_snapshot: input.instrumentName,
        current_month: input.currentMonth,
        current_year: input.currentYear,
        previous_month: previous.month,
        previous_year: previous.year,
        notes: input.notes ?? null,
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

  const recordId = (insertResult.data as RecordRow).id;
  await seedRecordStructure(recordId, input.instrumentId);

  if (input.levelLots) {
    const supabase = createClient();
    for (const [level, lot] of Object.entries(input.levelLots)) {
      if (!lot?.trim()) continue;
      await supabase
        .from('cv_monitoring_levels')
        .update({ lot_number: lot.trim() })
        .eq('monthly_record_id', recordId)
        .eq('qc_level', level);
    }
  }

  await autoPopulatePreviousMonth(recordId, staff);
  await logAudit(recordId, staff, 'CV_RECORD_CREATED', { newStatus: 'draft' });
  return fetchCvMonitoringRecordById(recordId);
}

export async function fetchCvMonitoringRecords(search?: string): Promise<ClinicalListResult<CvMonitoringListItem>> {
  const result = await runClinicalListQuery('Failed to load CV monitoring records', async () => {
    const supabase = createClient();
    let query = supabase
      .from('cv_monitoring_monthly_records')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (search?.trim()) {
      query = query.or(
        `monitoring_number.ilike.%${search.trim()}%,instrument_name_snapshot.ilike.%${search.trim()}%`,
      );
    }
    return query;
  });

  const list: CvMonitoringListItem[] = [];
  for (const row of result.data as RecordRow[]) {
    const { levels, results } = await fetchRecordRelations(row.id);
    list.push({
      id: row.id,
      monitoringNumber: row.monitoring_number,
      instrumentName: row.instrument_name_snapshot,
      currentMonth: row.current_month,
      currentYear: row.current_year,
      levels: levels.map((l) => l.qcLevel),
      highCvCount: results.filter((r) => r.currentStatus === 'high_cv').length,
      overallStatus: row.overall_status ?? undefined,
      status: row.status,
      preparedByName: row.prepared_by_name ?? undefined,
      reviewedByName: row.reviewed_by_name ?? undefined,
      approvedByName: row.approved_by_name ?? undefined,
      createdAt: row.created_at,
    });
  }
  return { data: list, error: result.error };
}

export async function fetchCvMonitoringRecordById(id: string): Promise<ClinicalResult<CvMonitoringRecord>> {
  const result = await runClinicalMutation('Failed to load CV monitoring record', async () => {
    const supabase = createClient();
    return supabase.from('cv_monitoring_monthly_records').select('*').eq('id', id).is('deleted_at', null).single();
  });
  if (!result.data) return { data: null, error: result.error };
  const relations = await fetchRecordRelations(id);
  return { data: mapRecord(result.data as RecordRow, relations.levels, relations.results), error: null };
}

export interface CvResultInput {
  id: string;
  previousMean?: number | null;
  previousSd?: number | null;
  previousSourceType?: CvPreviousSourceType;
  previousManualReason?: string;
  currentMean?: number | null;
  currentSd?: number | null;
  comment?: string;
  observation?: string;
  investigation?: string;
  possibleCause?: string;
  correctiveAction?: string;
  followUpRequired?: boolean;
  followUpComment?: string;
  qualityDisposition?: CvQualityDisposition;
}

export async function saveCvMonitoringResults(
  recordId: string,
  staff: StaffContext,
  inputs: CvResultInput[],
  levelLots?: Partial<Record<'N' | 'P', string>>,
): Promise<ClinicalResult<CvMonitoringRecord>> {
  const current = await fetchCvMonitoringRecordById(recordId);
  if (!current.data) return { data: null, error: current.error ?? 'Record not found' };
  if (current.data.status !== 'draft' && current.data.status !== 'returned') {
    return { data: null, error: 'Record is read-only.' };
  }

  const supabase = createClient();

  if (levelLots) {
    for (const [level, lot] of Object.entries(levelLots)) {
      await supabase
        .from('cv_monitoring_levels')
        .update({ lot_number: lot?.trim() || null })
        .eq('monthly_record_id', recordId)
        .eq('qc_level', level);
    }
  }

  for (const input of inputs) {
    const existing = current.data.results.find((r) => r.id === input.id);
    if (!existing) continue;

    const isManualPrevious = input.previousSourceType
      && input.previousSourceType !== 'auto_from_approved_record';

    const calc = recalculateResultRow({
      previousMean: input.previousMean ?? undefined,
      previousSd: input.previousSd ?? undefined,
      currentMean: input.currentMean ?? undefined,
      currentSd: input.currentSd ?? undefined,
      cvLimitSnapshot: existing.cvLimitSnapshot,
    });

    await supabase.from('cv_monitoring_results').update({
      previous_mean: input.previousMean ?? null,
      previous_sd: input.previousSd ?? null,
      previous_cv_percent: calc.previousCvPercent ?? null,
      previous_status: calc.previousStatus,
      previous_source_type: input.previousSourceType ?? existing.previousSourceType ?? null,
      previous_source_record_id: isManualPrevious ? null : existing.previousSourceRecordId ?? null,
      previous_manual_reason: isManualPrevious ? (input.previousManualReason ?? null) : null,
      previous_manual_entered_by: isManualPrevious ? staff.userId : null,
      previous_manual_entered_by_name: isManualPrevious ? staff.fullName : null,
      previous_manual_entered_at: isManualPrevious ? new Date().toISOString() : null,
      current_mean: input.currentMean ?? null,
      current_sd: input.currentSd ?? null,
      current_cv_percent: calc.currentCvPercent ?? null,
      current_status: calc.currentStatus,
      cv_change: calc.cvChange ?? null,
      trend_status: calc.trendStatus ?? null,
      comment: input.comment ?? null,
      observation: input.observation ?? null,
      investigation: input.investigation ?? null,
      possible_cause: input.possibleCause ?? null,
      corrective_action: input.correctiveAction ?? null,
      follow_up_required: input.followUpRequired ?? null,
      follow_up_comment: input.followUpComment ?? null,
      quality_disposition: input.qualityDisposition ?? null,
    }).eq('id', input.id);

    if (isManualPrevious) {
      await logAudit(recordId, staff, 'PREVIOUS_MONTH_MANUAL_ENTRY', {
        metadata: { resultId: input.id, sourceType: input.previousSourceType },
      });
    }
  }

  const refreshed = await fetchCvMonitoringRecordById(recordId);
  if (!refreshed.data) return refreshed;

  const overall = deriveOverallStatus(refreshed.data.results);
  await supabase.from('cv_monitoring_monthly_records').update({
    overall_status: overall,
    updated_by: staff.userId,
  }).eq('id', recordId);

  await logAudit(recordId, staff, 'RESULT_UPDATED', { metadata: { count: inputs.length } });
  return fetchCvMonitoringRecordById(recordId);
}

export async function saveCvMonitoringSetup(
  recordId: string,
  staff: StaffContext,
  setup: { generalComments?: string; notes?: string },
): Promise<ClinicalResult<CvMonitoringRecord>> {
  const updateResult = await runClinicalMutation('Failed to save setup', async () => {
    const supabase = createClient();
    return supabase
      .from('cv_monitoring_monthly_records')
      .update({
        general_comments: setup.generalComments ?? null,
        notes: setup.notes ?? null,
        updated_by: staff.userId,
      })
      .eq('id', recordId)
      .select('*')
      .single();
  });
  if (!updateResult.data) return { data: null, error: updateResult.error };
  await logAudit(recordId, staff, 'CV_RECORD_UPDATED');
  return fetchCvMonitoringRecordById(recordId);
}

export async function submitCvMonitoringRecord(recordId: string, staff: StaffContext): Promise<ClinicalResult<CvMonitoringRecord>> {
  const current = await fetchCvMonitoringRecordById(recordId);
  if (!current.data) return { data: null, error: current.error ?? 'Record not found' };
  if (current.data.overallStatus === 'incomplete') {
    return { data: null, error: 'Complete all required statistics before submitting.' };
  }

  const updateResult = await runClinicalMutation('Failed to submit record', async () => {
    const supabase = createClient();
    return supabase
      .from('cv_monitoring_monthly_records')
      .update({
        status: 'pending_review',
        prepared_by: staff.userId,
        prepared_by_name: staff.fullName,
        prepared_by_staff_id: staff.staffId,
        prepared_at: new Date().toISOString(),
        updated_by: staff.userId,
      })
      .eq('id', recordId)
      .select('*')
      .single();
  });
  if (!updateResult.data) return { data: null, error: updateResult.error };
  await logAudit(recordId, staff, 'RECORD_SUBMITTED', { oldStatus: current.data.status, newStatus: 'pending_review' });
  return fetchCvMonitoringRecordById(recordId);
}

export async function reviewCvMonitoringRecord(
  recordId: string,
  staff: StaffContext,
  input: { action: 'review' | 'return' | 'reject'; comment?: string },
): Promise<ClinicalResult<CvMonitoringRecord>> {
  const current = await fetchCvMonitoringRecordById(recordId);
  if (!current.data) return { data: null, error: current.error ?? 'Record not found' };
  if (current.data.preparedBy === staff.userId) {
    return { data: null, error: 'Prepared by and reviewed by must be different users.' };
  }
  if ((input.action === 'return' || input.action === 'reject') && !input.comment?.trim()) {
    return { data: null, error: 'Comment is required for return or reject.' };
  }

  let newStatus: CvMonitoringStatus = 'pending_approval';
  if (input.action === 'return') newStatus = 'returned';
  if (input.action === 'reject') newStatus = 'rejected';

  const updateResult = await runClinicalMutation('Failed to review record', async () => {
    const supabase = createClient();
    return supabase
      .from('cv_monitoring_monthly_records')
      .update({
        status: newStatus,
        reviewed_by: staff.userId,
        reviewed_by_name: staff.fullName,
        reviewed_by_staff_id: staff.staffId,
        reviewed_at: new Date().toISOString(),
        review_comment: input.comment ?? null,
        updated_by: staff.userId,
      })
      .eq('id', recordId)
      .select('*')
      .single();
  });
  if (!updateResult.data) return { data: null, error: updateResult.error };

  await logAudit(recordId, staff, input.action === 'review' ? 'RECORD_REVIEWED' : input.action === 'return' ? 'RECORD_RETURNED' : 'RECORD_REJECTED', {
    oldStatus: current.data.status,
    newStatus,
    comment: input.comment,
  });
  return fetchCvMonitoringRecordById(recordId);
}

export async function approveCvMonitoringRecord(
  recordId: string,
  staff: StaffContext,
  input: { action: 'approve' | 'return' | 'reject'; comment?: string },
): Promise<ClinicalResult<CvMonitoringRecord>> {
  const current = await fetchCvMonitoringRecordById(recordId);
  if (!current.data) return { data: null, error: current.error ?? 'Record not found' };

  if ((input.action === 'return' || input.action === 'reject') && !input.comment?.trim()) {
    return { data: null, error: 'Comment is required for return or reject.' };
  }

  if (input.action === 'approve') {
    if (!canApproveCvRecord(current.data.results)) {
      return { data: null, error: 'Unresolved manual review, incomplete data, or missing HIGH CV investigation blocks approval.' };
    }
    if (current.data.reviewedBy === staff.userId) {
      return { data: null, error: 'Reviewed by and approved by should be different users.' };
    }
  }

  let newStatus: CvMonitoringStatus = 'approved';
  if (input.action === 'return') newStatus = 'returned';
  if (input.action === 'reject') newStatus = 'rejected';

  const updateResult = await runClinicalMutation('Failed to approve record', async () => {
    const supabase = createClient();
    return supabase
      .from('cv_monitoring_monthly_records')
      .update({
        status: newStatus,
        approved_by: input.action === 'approve' ? staff.userId : null,
        approved_by_name: input.action === 'approve' ? staff.fullName : null,
        approved_by_staff_id: input.action === 'approve' ? staff.staffId : null,
        approved_at: input.action === 'approve' ? new Date().toISOString() : null,
        approval_comment: input.comment ?? null,
        updated_by: staff.userId,
      })
      .eq('id', recordId)
      .select('*')
      .single();
  });
  if (!updateResult.data) return { data: null, error: updateResult.error };

  await logAudit(recordId, staff, input.action === 'approve' ? 'RECORD_APPROVED' : input.action === 'return' ? 'RECORD_RETURNED' : 'RECORD_REJECTED', {
    oldStatus: current.data.status,
    newStatus,
    comment: input.comment,
  });
  return fetchCvMonitoringRecordById(recordId);
}

export async function archiveCvMonitoringRecord(recordId: string, staff: StaffContext): Promise<ClinicalResult<CvMonitoringRecord>> {
  const current = await fetchCvMonitoringRecordById(recordId);
  if (!current.data) return { data: null, error: current.error ?? 'Record not found' };

  const updateResult = await runClinicalMutation('Failed to archive record', async () => {
    const supabase = createClient();
    return supabase
      .from('cv_monitoring_monthly_records')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
        archived_by: staff.userId,
        updated_by: staff.userId,
      })
      .eq('id', recordId)
      .select('*')
      .single();
  });
  if (!updateResult.data) return { data: null, error: updateResult.error };
  await logAudit(recordId, staff, 'RECORD_ARCHIVED', { oldStatus: current.data.status, newStatus: 'archived' });
  return fetchCvMonitoringRecordById(recordId);
}

export async function fetchCvTrendData(filters?: {
  instrumentId?: string;
  analyteCode?: string;
  qcLevel?: string;
  fromYear?: number;
  fromMonth?: number;
  toYear?: number;
  toMonth?: number;
}): Promise<ClinicalListResult<CvTrendDataPoint>> {
  const result = await runClinicalListQuery('Failed to load trend data', async () => {
    const supabase = createClient();
    let query = supabase
      .from('cv_monitoring_monthly_records')
      .select('id, monitoring_number, instrument_id, instrument_name_snapshot, current_month, current_year, status')
      .eq('status', 'approved')
      .is('deleted_at', null)
      .order('current_year', { ascending: true })
      .order('current_month', { ascending: true });
    if (filters?.instrumentId) query = query.eq('instrument_id', filters.instrumentId);
    return query;
  });

  const points: CvTrendDataPoint[] = [];
  for (const row of result.data as Array<Record<string, unknown>>) {
    const { levels, results } = await fetchRecordRelations(row.id as string);
    for (const res of results) {
      const level = levels.find((l) => l.id === res.levelId);
      if (filters?.analyteCode && res.analyteCode !== filters.analyteCode) continue;
      if (filters?.qcLevel && level?.qcLevel !== filters.qcLevel) continue;
      points.push({
        month: row.current_month as number,
        year: row.current_year as number,
        instrumentId: row.instrument_id as string,
        instrumentName: row.instrument_name_snapshot as string,
        qcLevel: level?.qcLevel ?? 'N',
        analyteCode: res.analyteCode,
        analyteName: res.analyteName,
        mean: res.currentMean,
        sd: res.currentSd,
        cvPercent: res.currentCvPercent,
        cvLimitSnapshot: res.cvLimitSnapshot,
        status: res.currentStatus,
        monitoringNumber: row.monitoring_number as string,
        recordId: row.id as string,
      });
    }
  }
  return { data: points, error: result.error };
}

export async function fetchCvMonitoringAuditEvents(recordId: string) {
  const result = await runClinicalListQuery('Failed to load audit events', async () => {
    const supabase = createClient();
    return supabase
      .from('cv_monitoring_audit_events')
      .select('*')
      .eq('record_id', recordId)
      .order('created_at', { ascending: false });
  });
  return {
    data: (result.data as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as string,
      recordId: row.record_id as string,
      userId: row.user_id as string,
      userName: row.user_name as string,
      staffId: (row.staff_id as string | null) ?? undefined,
      action: row.action as string,
      oldStatus: (row.old_status as string | null) ?? undefined,
      newStatus: (row.new_status as string | null) ?? undefined,
      comment: (row.comment as string | null) ?? undefined,
      metadata: row.metadata as Record<string, unknown> | null,
      createdAt: row.created_at as string,
    })),
    error: result.error,
  };
}

export async function logCvExport(recordId: string, staff: StaffContext, format: 'PDF' | 'EXCEL'): Promise<void> {
  await logAudit(recordId, staff, format === 'PDF' ? 'PDF_EXPORTED' : 'EXCEL_EXPORTED');
}

export function summarizeCvRecord(record: CvMonitoringRecord) {
  return buildCvMonitoringSummary(record.results, record.levels);
}

export async function refreshPreviousMonthAutoFill(recordId: string, staff: StaffContext): Promise<ClinicalResult<CvMonitoringRecord>> {
  const populated = await autoPopulatePreviousMonth(recordId, staff);
  if (!populated) return { data: null, error: 'Previous approved CV record not found.' };
  return fetchCvMonitoringRecordById(recordId);
}
