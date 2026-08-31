import { createClient } from '@/lib/supabase/client';
import type {
  EnvironmentalAssetFormData,
  EnvironmentalAdminEditFormData,
  EnvironmentalCorrectionFormData,
  EnvironmentalExcursionActionFormData,
  EnvironmentalExcursionRecheckFormData,
  EnvironmentalExcursionResolutionFormData,
  EnvironmentalExcursionReviewFormData,
  EnvironmentalReadingFormData,
  EnvironmentalVoidFormData,
  EnvironmentalWindowFormData,
} from '@/lib/environmental-monitoring/schema';
import type {
  EnvironmentalAsset,
  EnvironmentalAuditEvent,
  EnvironmentalDashboardStats,
  EnvironmentalExcursion,
  EnvironmentalMonitoringWindow,
  EnvironmentalReading,
  EnvironmentalReadingCorrection,
} from '@/types/environmental-monitoring';
import type { StaffContext } from './staff-context';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';
import {
  computeDailyCompliancePercent,
  countMissingWindows,
} from '@/lib/environmental-monitoring/compliance';

interface AssetRow {
  id: string;
  asset_code: string;
  asset_name: string;
  asset_type: EnvironmentalAsset['assetType'];
  location: string | null;
  serial_number: string | null;
  description: string | null;
  min_temperature: number;
  max_temperature: number;
  humidity_min: number | null;
  humidity_max: number | null;
  humidity_required: boolean;
  monitoring_frequency: string;
  qr_token: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface WindowRow {
  id: string;
  asset_id: string;
  window_name: string;
  start_time: string;
  end_time: string;
  required: boolean;
  days_of_week: number[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface ReadingRow {
  id: string;
  asset_id: string;
  monitoring_window_id: string | null;
  recorded_at: string;
  temperature: number;
  humidity: number | null;
  calculated_status: EnvironmentalReading['calculatedStatus'];
  range_min_at_reading: number;
  range_max_at_reading: number;
  humidity_min_at_reading: number | null;
  humidity_max_at_reading: number | null;
  out_of_range_parameters: string | null;
  performed_by_user_id: string;
  performed_by_name: string;
  performed_by_staff_id: string | null;
  source: EnvironmentalReading['source'];
  comment: string | null;
  voided_at: string | null;
  voided_by: string | null;
  voided_by_name: string | null;
  voided_by_staff_id: string | null;
  void_reason: string | null;
  created_at: string;
}

interface CorrectionRow {
  id: string;
  reading_id: string;
  previous_temperature: number;
  new_temperature: number;
  previous_humidity: number | null;
  new_humidity: number | null;
  correction_reason: string;
  corrected_by_user_id: string;
  corrected_by_name: string;
  corrected_by_staff_id: string | null;
  corrected_at: string;
}

interface ExcursionRow {
  id: string;
  reading_id: string;
  asset_id: string;
  detected_at: string;
  detected_temperature: number;
  detected_humidity: number | null;
  range_min_at_detection: number;
  range_max_at_detection: number;
  humidity_min_at_detection: number | null;
  humidity_max_at_detection: number | null;
  humidity_required_at_detection: boolean;
  out_of_range_parameters: string | null;
  status: EnvironmentalExcursion['status'];
  immediate_action: string | null;
  affected_material: string | null;
  maintenance_ticket_number: string | null;
  additional_comment: string | null;
  recheck_temperature: number | null;
  recheck_humidity: number | null;
  recheck_at: string | null;
  rechecked_by_user_id: string | null;
  rechecked_by_name: string | null;
  rechecked_by_staff_id: string | null;
  resolution_status: string | null;
  resolution_comment: string | null;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  resolved_by_name: string | null;
  resolved_by_staff_id: string | null;
  review_status: EnvironmentalExcursion['reviewStatus'];
  review_decision: EnvironmentalExcursion['reviewDecision'] | null;
  review_comment: string | null;
  reviewed_by_user_id: string | null;
  reviewed_by_name: string | null;
  reviewed_by_staff_id: string | null;
  reviewed_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface AuditRow {
  id: string;
  module: string;
  record_type: string;
  record_id: string;
  event_type: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  performed_by_user_id: string | null;
  performed_by_name: string | null;
  performed_by_staff_id: string | null;
  performed_at: string;
  reason: string | null;
}

function mapAsset(row: AssetRow): EnvironmentalAsset {
  return {
    id: row.id,
    assetCode: row.asset_code,
    assetName: row.asset_name,
    assetType: row.asset_type,
    location: row.location ?? undefined,
    serialNumber: row.serial_number ?? undefined,
    description: row.description ?? undefined,
    minTemperature: Number(row.min_temperature),
    maxTemperature: Number(row.max_temperature),
    humidityMin: row.humidity_min != null ? Number(row.humidity_min) : undefined,
    humidityMax: row.humidity_max != null ? Number(row.humidity_max) : undefined,
    humidityRequired: row.humidity_required,
    monitoringFrequency: row.monitoring_frequency,
    qrToken: row.qr_token,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWindow(row: WindowRow): EnvironmentalMonitoringWindow {
  return {
    id: row.id,
    assetId: row.asset_id,
    windowName: row.window_name,
    startTime: row.start_time,
    endTime: row.end_time,
    required: row.required,
    daysOfWeek: row.days_of_week,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReading(row: ReadingRow): EnvironmentalReading {
  return {
    id: row.id,
    assetId: row.asset_id,
    monitoringWindowId: row.monitoring_window_id ?? undefined,
    recordedAt: row.recorded_at,
    temperature: Number(row.temperature),
    humidity: row.humidity != null ? Number(row.humidity) : undefined,
    calculatedStatus: row.calculated_status,
    rangeMinAtReading: Number(row.range_min_at_reading),
    rangeMaxAtReading: Number(row.range_max_at_reading),
    humidityMinAtReading: row.humidity_min_at_reading != null ? Number(row.humidity_min_at_reading) : undefined,
    humidityMaxAtReading: row.humidity_max_at_reading != null ? Number(row.humidity_max_at_reading) : undefined,
    outOfRangeParameters: row.out_of_range_parameters as EnvironmentalReading['outOfRangeParameters'],
    performedByUserId: row.performed_by_user_id,
    performedByName: row.performed_by_name,
    performedByStaffId: row.performed_by_staff_id ?? undefined,
    source: row.source,
    comment: row.comment ?? undefined,
    voidedAt: row.voided_at ?? undefined,
    voidedBy: row.voided_by ?? undefined,
    voidedByName: row.voided_by_name ?? undefined,
    voidedByStaffId: row.voided_by_staff_id ?? undefined,
    voidReason: row.void_reason ?? undefined,
    createdAt: row.created_at,
  };
}

function mapCorrection(row: CorrectionRow): EnvironmentalReadingCorrection {
  return {
    id: row.id,
    readingId: row.reading_id,
    previousTemperature: Number(row.previous_temperature),
    newTemperature: Number(row.new_temperature),
    previousHumidity: row.previous_humidity != null ? Number(row.previous_humidity) : undefined,
    newHumidity: row.new_humidity != null ? Number(row.new_humidity) : undefined,
    correctionReason: row.correction_reason,
    correctedByUserId: row.corrected_by_user_id,
    correctedByName: row.corrected_by_name,
    correctedByStaffId: row.corrected_by_staff_id ?? undefined,
    correctedAt: row.corrected_at,
  };
}

function mapExcursion(row: ExcursionRow): EnvironmentalExcursion {
  return {
    id: row.id,
    readingId: row.reading_id,
    assetId: row.asset_id,
    detectedAt: row.detected_at,
    detectedTemperature: Number(row.detected_temperature),
    detectedHumidity: row.detected_humidity != null ? Number(row.detected_humidity) : undefined,
    rangeMinAtDetection: Number(row.range_min_at_detection),
    rangeMaxAtDetection: Number(row.range_max_at_detection),
    humidityMinAtDetection: row.humidity_min_at_detection != null ? Number(row.humidity_min_at_detection) : undefined,
    humidityMaxAtDetection: row.humidity_max_at_detection != null ? Number(row.humidity_max_at_detection) : undefined,
    humidityRequiredAtDetection: row.humidity_required_at_detection,
    outOfRangeParameters: row.out_of_range_parameters as EnvironmentalExcursion['outOfRangeParameters'],
    status: row.status,
    immediateAction: row.immediate_action ?? undefined,
    affectedMaterial: row.affected_material ?? undefined,
    maintenanceTicketNumber: row.maintenance_ticket_number ?? undefined,
    additionalComment: row.additional_comment ?? undefined,
    recheckTemperature: row.recheck_temperature != null ? Number(row.recheck_temperature) : undefined,
    recheckHumidity: row.recheck_humidity != null ? Number(row.recheck_humidity) : undefined,
    recheckAt: row.recheck_at ?? undefined,
    recheckedByUserId: row.rechecked_by_user_id ?? undefined,
    recheckedByName: row.rechecked_by_name ?? undefined,
    recheckedByStaffId: row.rechecked_by_staff_id ?? undefined,
    resolutionStatus: row.resolution_status ?? undefined,
    resolutionComment: row.resolution_comment ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    resolvedByUserId: row.resolved_by_user_id ?? undefined,
    resolvedByName: row.resolved_by_name ?? undefined,
    resolvedByStaffId: row.resolved_by_staff_id ?? undefined,
    reviewStatus: row.review_status,
    reviewDecision: row.review_decision ?? undefined,
    reviewComment: row.review_comment ?? undefined,
    reviewedByUserId: row.reviewed_by_user_id ?? undefined,
    reviewedByName: row.reviewed_by_name ?? undefined,
    reviewedByStaffId: row.reviewed_by_staff_id ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    voidedAt: row.voided_at ?? undefined,
    voidReason: row.void_reason ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAudit(row: AuditRow): EnvironmentalAuditEvent {
  return {
    id: row.id,
    module: row.module,
    recordType: row.record_type,
    recordId: row.record_id,
    eventType: row.event_type,
    oldData: row.old_data ?? undefined,
    newData: row.new_data ?? undefined,
    performedByUserId: row.performed_by_user_id ?? undefined,
    performedByName: row.performed_by_name ?? undefined,
    performedByStaffId: row.performed_by_staff_id ?? undefined,
    performedAt: row.performed_at,
    reason: row.reason ?? undefined,
  };
}

export async function fetchEnvironmentalAssets(): Promise<ClinicalListResult<EnvironmentalAsset>> {
  const result = await runClinicalListQuery('Failed to load environmental assets', async () => {
    const supabase = createClient();
    return supabase
      .from('environmental_assets')
      .select('*')
      .is('deleted_at', null)
      .order('asset_code');
  });
  return { data: (result.data as unknown as AssetRow[]).map(mapAsset), error: result.error };
}

export async function fetchEnvironmentalWindows(): Promise<ClinicalListResult<EnvironmentalMonitoringWindow>> {
  const result = await runClinicalListQuery('Failed to load monitoring windows', async () => {
    const supabase = createClient();
    return supabase.from('environmental_monitoring_windows').select('*').order('start_time');
  });
  return { data: (result.data as unknown as WindowRow[]).map(mapWindow), error: result.error };
}

export async function fetchEnvironmentalReadings(since?: string): Promise<ClinicalListResult<EnvironmentalReading>> {
  const result = await runClinicalListQuery('Failed to load environmental readings', async () => {
    const supabase = createClient();
    let query = supabase.from('environmental_readings').select('*').order('recorded_at', { ascending: false });
    if (since) query = query.gte('recorded_at', since);
    return query;
  });
  return { data: (result.data as unknown as ReadingRow[]).map(mapReading), error: result.error };
}

export async function fetchEnvironmentalExcursions(): Promise<ClinicalListResult<EnvironmentalExcursion>> {
  const result = await runClinicalListQuery('Failed to load environmental excursions', async () => {
    const supabase = createClient();
    return supabase.from('environmental_excursions').select('*').order('detected_at', { ascending: false });
  });
  return { data: (result.data as unknown as ExcursionRow[]).map(mapExcursion), error: result.error };
}

export async function fetchEnvironmentalCorrections(): Promise<ClinicalListResult<EnvironmentalReadingCorrection>> {
  const result = await runClinicalListQuery('Failed to load reading corrections', async () => {
    const supabase = createClient();
    return supabase.from('environmental_reading_corrections').select('*').order('corrected_at', { ascending: false });
  });
  return { data: (result.data as unknown as CorrectionRow[]).map(mapCorrection), error: result.error };
}

export async function fetchEnvironmentalAuditEvents(): Promise<ClinicalListResult<EnvironmentalAuditEvent>> {
  const result = await runClinicalListQuery('Failed to load environmental audit events', async () => {
    const supabase = createClient();
    return supabase.from('environmental_audit_events').select('*').order('performed_at', { ascending: false }).limit(500);
  });
  return { data: (result.data as unknown as AuditRow[]).map(mapAudit), error: result.error };
}

export async function createEnvironmentalReading(
  staff: StaffContext,
  form: EnvironmentalReadingFormData,
): Promise<ClinicalResult<{ reading: EnvironmentalReading; excursion?: EnvironmentalExcursion }>> {
  const result = await runClinicalMutation('Failed to record environmental reading', async () => {
    const supabase = createClient();
    return supabase
      .from('environmental_readings')
      .insert({
        asset_id: form.assetId,
        monitoring_window_id: form.monitoringWindowId ?? null,
        temperature: form.temperature,
        humidity: form.humidity ?? null,
        performed_by_user_id: staff.userId,
        performed_by_name: staff.fullName,
        performed_by_staff_id: staff.staffId,
        source: form.source,
        comment: form.comment?.trim() || null,
      })
      .select('*')
      .single();
  });

  if (!result.data) return { data: null, error: result.error };

  const reading = mapReading(result.data as unknown as ReadingRow);
  let excursion: EnvironmentalExcursion | undefined;
  if (reading.calculatedStatus === 'out_of_range') {
    const excursionResult = await runClinicalMutation('Failed to load excursion', async () => {
      const supabase = createClient();
      return supabase.from('environmental_excursions').select('*').eq('reading_id', reading.id).maybeSingle();
    });
    excursion = excursionResult.data ? mapExcursion(excursionResult.data as unknown as ExcursionRow) : undefined;
  }

  return { data: { reading, excursion }, error: null };
}

export async function correctEnvironmentalReading(
  readingId: string,
  staff: StaffContext,
  form: EnvironmentalCorrectionFormData,
): Promise<ClinicalResult<EnvironmentalReadingCorrection>> {
  const readingResult = await runClinicalMutation('Failed to load reading', async () => {
    const supabase = createClient();
    return supabase.from('environmental_readings').select('*').eq('id', readingId).single();
  });
  if (!readingResult.data) return { data: null, error: readingResult.error ?? 'Reading not found' };
  const current = mapReading(readingResult.data as unknown as ReadingRow);

  const correctionResult = await runClinicalMutation('Failed to create reading correction', async () => {
    const supabase = createClient();
    return supabase
      .from('environmental_reading_corrections')
      .insert({
        reading_id: readingId,
        previous_temperature: current.temperature,
        new_temperature: form.newTemperature,
        previous_humidity: current.humidity ?? null,
        new_humidity: form.newHumidity ?? null,
        correction_reason: form.correctionReason.trim(),
        corrected_by_user_id: staff.userId,
        corrected_by_name: staff.fullName,
        corrected_by_staff_id: staff.staffId,
      })
      .select('*')
      .single();
  });

  return {
    data: correctionResult.data ? mapCorrection(correctionResult.data as unknown as CorrectionRow) : null,
    error: correctionResult.error,
  };
}

export async function voidEnvironmentalReading(
  readingId: string,
  staff: StaffContext,
  form: EnvironmentalVoidFormData,
): Promise<ClinicalResult<EnvironmentalReading>> {
  const result = await runClinicalMutation('Failed to void environmental reading', async () => {
    const supabase = createClient();
    return supabase
      .from('environmental_readings')
      .update({
        voided_at: new Date().toISOString(),
        voided_by: staff.userId,
        voided_by_name: staff.fullName,
        voided_by_staff_id: staff.staffId,
        void_reason: form.voidReason.trim(),
      })
      .eq('id', readingId)
      .select('*')
      .single();
  });
  return { data: result.data ? mapReading(result.data as unknown as ReadingRow) : null, error: result.error };
}

export async function adminUpdateEnvironmentalReading(
  readingId: string,
  form: EnvironmentalAdminEditFormData,
): Promise<ClinicalResult<EnvironmentalReading>> {
  const result = await runClinicalMutation('Failed to apply administrative reading edit', async () => {
    const supabase = createClient();
    return supabase.rpc('environmental_admin_update_reading', {
      p_reading_id: readingId,
      p_temperature: form.newTemperature,
      p_humidity: form.newHumidity ?? null,
      p_reason: form.adminChangeReason.trim(),
    });
  });

  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  return { data: row ? mapReading(row as unknown as ReadingRow) : null, error: result.error };
}

export async function voidEnvironmentalExcursion(
  excursionId: string,
  staff: StaffContext,
  form: EnvironmentalVoidFormData,
): Promise<ClinicalResult<EnvironmentalExcursion>> {
  const result = await runClinicalMutation('Failed to void environmental excursion', async () => {
    const supabase = createClient();
    return supabase
      .from('environmental_excursions')
      .update({
        voided_at: new Date().toISOString(),
        voided_by: staff.userId,
        voided_by_name: staff.fullName,
        voided_by_staff_id: staff.staffId,
        void_reason: form.voidReason.trim(),
        status: 'voided',
      })
      .eq('id', excursionId)
      .select('*')
      .single();
  });
  return { data: result.data ? mapExcursion(result.data as unknown as ExcursionRow) : null, error: result.error };
}

export async function updateEnvironmentalExcursionAction(
  excursionId: string,
  staff: StaffContext,
  form: EnvironmentalExcursionActionFormData,
): Promise<ClinicalResult<EnvironmentalExcursion>> {
  const result = await runClinicalMutation('Failed to update excursion action', async () => {
    const supabase = createClient();
    return supabase
      .from('environmental_excursions')
      .update({
        immediate_action: form.immediateAction.trim(),
        affected_material: form.affectedMaterial?.trim() || null,
        maintenance_ticket_number: form.maintenanceTicketNumber?.trim() || null,
        additional_comment: form.additionalComment?.trim() || null,
        status: 'under_action',
        updated_at: new Date().toISOString(),
      })
      .eq('id', excursionId)
      .select('*')
      .single();
  });

  return { data: result.data ? mapExcursion(result.data as unknown as ExcursionRow) : null, error: result.error };
}

export async function recheckEnvironmentalExcursion(
  excursionId: string,
  staff: StaffContext,
  form: EnvironmentalExcursionRecheckFormData,
): Promise<ClinicalResult<EnvironmentalExcursion>> {
  const result = await runClinicalMutation('Failed to record excursion recheck', async () => {
    const supabase = createClient();
    return supabase
      .from('environmental_excursions')
      .update({
        recheck_temperature: form.recheckTemperature,
        recheck_humidity: form.recheckHumidity ?? null,
        recheck_at: form.recheckAt,
        rechecked_by_user_id: staff.userId,
        rechecked_by_name: staff.fullName,
        rechecked_by_staff_id: staff.staffId,
        status: 'awaiting_recheck',
        updated_at: new Date().toISOString(),
      })
      .eq('id', excursionId)
      .select('*')
      .single();
  });

  return { data: result.data ? mapExcursion(result.data as unknown as ExcursionRow) : null, error: result.error };
}

export async function resolveEnvironmentalExcursion(
  excursionId: string,
  staff: StaffContext,
  form: EnvironmentalExcursionResolutionFormData,
): Promise<ClinicalResult<EnvironmentalExcursion>> {
  const now = new Date().toISOString();
  const result = await runClinicalMutation('Failed to resolve excursion', async () => {
    const supabase = createClient();
    return supabase
      .from('environmental_excursions')
      .update({
        resolution_status: form.resolutionStatus.trim(),
        resolution_comment: form.resolutionComment.trim(),
        resolved_at: now,
        resolved_by_user_id: staff.userId,
        resolved_by_name: staff.fullName,
        resolved_by_staff_id: staff.staffId,
        status: 'resolved',
        updated_at: now,
      })
      .eq('id', excursionId)
      .select('*')
      .single();
  });

  return { data: result.data ? mapExcursion(result.data as unknown as ExcursionRow) : null, error: result.error };
}

export async function reviewEnvironmentalExcursion(
  excursionId: string,
  staff: StaffContext,
  form: EnvironmentalExcursionReviewFormData,
): Promise<ClinicalResult<EnvironmentalExcursion>> {
  const now = new Date().toISOString();
  const result = await runClinicalMutation('Failed to review excursion', async () => {
    const supabase = createClient();
    return supabase
      .from('environmental_excursions')
      .update({
        review_status: 'Reviewed',
        review_decision: form.reviewDecision,
        review_comment: form.reviewComment?.trim() || null,
        reviewed_by_user_id: staff.userId,
        reviewed_by_name: staff.fullName,
        reviewed_by_staff_id: staff.staffId,
        reviewed_at: now,
        updated_at: now,
      })
      .eq('id', excursionId)
      .select('*')
      .single();
  });

  return { data: result.data ? mapExcursion(result.data as unknown as ExcursionRow) : null, error: result.error };
}

export async function upsertEnvironmentalAsset(
  staff: StaffContext,
  form: EnvironmentalAssetFormData,
  assetId?: string,
): Promise<ClinicalResult<EnvironmentalAsset>> {
  const payload = {
    asset_code: form.assetCode.trim(),
    asset_name: form.assetName.trim(),
    asset_type: form.assetType,
    location: form.location?.trim() || null,
    serial_number: form.serialNumber?.trim() || null,
    description: form.description?.trim() || null,
    min_temperature: form.minTemperature,
    max_temperature: form.maxTemperature,
    humidity_min: form.humidityMin ?? null,
    humidity_max: form.humidityMax ?? null,
    humidity_required: form.humidityRequired,
    monitoring_frequency: form.monitoringFrequency,
    active: form.active,
    updated_by: staff.userId,
    updated_at: new Date().toISOString(),
  };

  const result = await runClinicalMutation('Failed to save environmental asset', async () => {
    const supabase = createClient();
    if (assetId) {
      return supabase.from('environmental_assets').update(payload).eq('id', assetId).select('*').single();
    }
    return supabase.from('environmental_assets').insert({ ...payload, created_by: staff.userId }).select('*').single();
  });

  return { data: result.data ? mapAsset(result.data as unknown as AssetRow) : null, error: result.error };
}

export async function upsertEnvironmentalWindow(
  form: EnvironmentalWindowFormData,
  assetId: string,
  windowId?: string,
): Promise<ClinicalResult<EnvironmentalMonitoringWindow>> {
  const payload = {
    asset_id: assetId,
    window_name: form.windowName.trim(),
    start_time: form.startTime,
    end_time: form.endTime,
    required: form.required,
    days_of_week: form.daysOfWeek,
    active: form.active,
    updated_at: new Date().toISOString(),
  };

  const result = await runClinicalMutation('Failed to save monitoring window', async () => {
    const supabase = createClient();
    if (windowId) {
      return supabase.from('environmental_monitoring_windows').update(payload).eq('id', windowId).select('*').single();
    }
    return supabase.from('environmental_monitoring_windows').insert(payload).select('*').single();
  });

  return { data: result.data ? mapWindow(result.data as unknown as WindowRow) : null, error: result.error };
}

export function computeEnvironmentalDashboardStats(
  assets: EnvironmentalAsset[],
  windows: EnvironmentalMonitoringWindow[],
  readings: EnvironmentalReading[],
  excursions: EnvironmentalExcursion[],
  now = new Date(),
): EnvironmentalDashboardStats {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return {
    dailyCompliancePercent: computeDailyCompliancePercent(assets, windows, readings, now),
    missingReadings: countMissingWindows(assets, windows, readings, now),
    excursionsThisMonth: excursions.filter((item) => item.detectedAt >= monthStart && !item.voidedAt).length,
    openExcursions: excursions.filter((item) => !item.voidedAt && ['open', 'under_action', 'awaiting_recheck'].includes(item.status)).length,
  };
}

export async function loadEnvironmentalMonitoringBundle(since?: string) {
  const [assets, windows, readings, excursions, corrections, auditEvents] = await Promise.all([
    fetchEnvironmentalAssets(),
    fetchEnvironmentalWindows(),
    fetchEnvironmentalReadings(since),
    fetchEnvironmentalExcursions(),
    fetchEnvironmentalCorrections(),
    fetchEnvironmentalAuditEvents(),
  ]);

  const error = assets.error || windows.error || readings.error || excursions.error || corrections.error || auditEvents.error;

  return {
    assets: assets.data,
    windows: windows.data,
    readings: readings.data,
    excursions: excursions.data,
    corrections: corrections.data,
    auditEvents: auditEvents.data,
    error,
  };
}
