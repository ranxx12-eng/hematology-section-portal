import { createClient } from '@/lib/supabase/client';
import {
  deriveBodyFluidCounts,
  validateBodyFluidSubmit,
} from '@/lib/medical-reports/body-fluid-logic';
import type { BodyFluidWorksheetFormData } from '@/lib/medical-reports/body-fluid-schema';
import type {
  BodyFluidCountEntry,
  BodyFluidWorksheet,
  BodyFluidWorksheetListItem,
} from '@/types/body-fluid-worksheet';
import type { StaffContext } from './staff-context';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';
import { fetchPortalStaff } from './staff-profiles';

interface WorksheetRow {
  id: string;
  patient_label_reference: string;
  time_received: string | null;
  specimen_type: BodyFluidWorksheet['specimenType'] | null;
  specimen_type_other: string | null;
  tube_number: string | null;
  clot_status: BodyFluidWorksheet['clotStatus'] | null;
  color_appearance: string | null;
  chamber_background: string | null;
  dilution_used: boolean;
  dilution_background_ok: boolean | null;
  dilution_factor: number | null;
  second_tech_enabled: boolean;
  primary_tech_user_id: string;
  primary_tech_name: string;
  primary_tech_staff_id: string | null;
  second_tech_user_id: string | null;
  second_tech_name: string | null;
  second_tech_staff_id: string | null;
  tech1_total_wbc: number | null;
  tech1_avg_wbc: number | null;
  tech1_total_rbc: number | null;
  tech1_avg_rbc: number | null;
  tech2_total_wbc: number | null;
  tech2_avg_wbc: number | null;
  tech2_total_rbc: number | null;
  tech2_avg_rbc: number | null;
  wbc_agreement: BodyFluidWorksheet['wbcAgreement'];
  rbc_agreement: BodyFluidWorksheet['rbcAgreement'];
  final_wbc: number | null;
  final_rbc: number | null;
  differential_neutrophils: number | null;
  differential_lymphocytes: number | null;
  differential_monocytes: number | null;
  differential_other_type: string | null;
  differential_other_quantity: number | null;
  comments: string | null;
  pathologist_name: string | null;
  pathologist_staff_id: string | null;
  pathologist_reviewed_at: string | null;
  pathologist_comment: string | null;
  status: BodyFluidWorksheet['status'];
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CountRow {
  id: string;
  worksheet_id: string;
  tech_number: number;
  cell_type: BodyFluidCountEntry['cellType'];
  square_number: number;
  count_value: number | null;
}

function mapCount(row: CountRow): BodyFluidCountEntry {
  return {
    id: row.id,
    worksheetId: row.worksheet_id,
    techNumber: row.tech_number as 1 | 2,
    cellType: row.cell_type,
    squareNumber: row.square_number,
    countValue: row.count_value ?? undefined,
  };
}

function mapWorksheet(row: WorksheetRow, counts: BodyFluidCountEntry[]): BodyFluidWorksheet {
  return {
    id: row.id,
    patientLabelReference: row.patient_label_reference,
    timeReceived: row.time_received ?? undefined,
    specimenType: row.specimen_type ?? undefined,
    specimenTypeOther: row.specimen_type_other ?? undefined,
    tubeNumber: row.tube_number ?? undefined,
    clotStatus: row.clot_status ?? undefined,
    colorAppearance: row.color_appearance ?? undefined,
    chamberBackground: row.chamber_background ?? undefined,
    dilutionUsed: row.dilution_used,
    dilutionBackgroundOk: row.dilution_background_ok ?? undefined,
    dilutionFactor: row.dilution_factor ?? undefined,
    secondTechEnabled: row.second_tech_enabled,
    primaryTechUserId: row.primary_tech_user_id,
    primaryTechName: row.primary_tech_name,
    primaryTechStaffId: row.primary_tech_staff_id ?? undefined,
    secondTechUserId: row.second_tech_user_id ?? undefined,
    secondTechName: row.second_tech_name ?? undefined,
    secondTechStaffId: row.second_tech_staff_id ?? undefined,
    tech1TotalWbc: row.tech1_total_wbc ?? undefined,
    tech1AvgWbc: row.tech1_avg_wbc ?? undefined,
    tech1TotalRbc: row.tech1_total_rbc ?? undefined,
    tech1AvgRbc: row.tech1_avg_rbc ?? undefined,
    tech2TotalWbc: row.tech2_total_wbc ?? undefined,
    tech2AvgWbc: row.tech2_avg_wbc ?? undefined,
    tech2TotalRbc: row.tech2_total_rbc ?? undefined,
    tech2AvgRbc: row.tech2_avg_rbc ?? undefined,
    wbcAgreement: row.wbc_agreement,
    rbcAgreement: row.rbc_agreement,
    finalWbc: row.final_wbc ?? undefined,
    finalRbc: row.final_rbc ?? undefined,
    differentialNeutrophils: row.differential_neutrophils ?? undefined,
    differentialLymphocytes: row.differential_lymphocytes ?? undefined,
    differentialMonocytes: row.differential_monocytes ?? undefined,
    differentialOtherType: row.differential_other_type ?? undefined,
    differentialOtherQuantity: row.differential_other_quantity ?? undefined,
    comments: row.comments ?? undefined,
    pathologistName: row.pathologist_name ?? undefined,
    pathologistStaffId: row.pathologist_staff_id ?? undefined,
    pathologistReviewedAt: row.pathologist_reviewed_at ?? undefined,
    pathologistComment: row.pathologist_comment ?? undefined,
    status: row.status,
    submittedAt: row.submitted_at ?? undefined,
    counts,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchCountsForWorksheets(worksheetIds: string[]): Promise<Record<string, BodyFluidCountEntry[]>> {
  if (worksheetIds.length === 0) return {};
  const supabase = createClient();
  const { data } = await supabase
    .from('body_fluid_count_entries')
    .select('*')
    .in('worksheet_id', worksheetIds)
    .order('tech_number')
    .order('cell_type')
    .order('square_number');
  return ((data ?? []) as CountRow[]).reduce<Record<string, BodyFluidCountEntry[]>>((acc, row) => {
    const entry = mapCount(row);
    acc[row.worksheet_id] = [...(acc[row.worksheet_id] ?? []), entry];
    return acc;
  }, {});
}

async function logAudit(
  worksheetId: string,
  staff: StaffContext,
  eventType: string,
  eventData?: Record<string, unknown>,
): Promise<void> {
  const supabase = createClient();
  await supabase.from('body_fluid_worksheet_audit_events').insert({
    worksheet_id: worksheetId,
    event_type: eventType,
    event_data: eventData ?? null,
    performed_by: staff.userId,
    performed_by_name: staff.fullName,
    performed_by_staff_id: staff.staffId,
  });
}

function buildWorksheetPayload(
  form: BodyFluidWorksheetFormData,
  staff: StaffContext,
  secondTech?: { userId: string; name: string; staffId: string | null },
  status: BodyFluidWorksheet['status'] = 'draft',
) {
  const derived = deriveBodyFluidCounts({
    counts: form.counts.map((entry) => ({
      techNumber: entry.techNumber,
      cellType: entry.cellType,
      squareNumber: entry.squareNumber,
      countValue: entry.countValue ?? undefined,
    })),
    secondTechEnabled: form.secondTechEnabled,
    dilutionUsed: form.dilutionUsed,
    dilutionFactor: form.dilutionFactor,
  });

  return {
    patient_label_reference: form.patientLabelReference?.trim() ?? '',
    time_received: form.timeReceived || null,
    specimen_type: form.specimenType ?? null,
    specimen_type_other: form.specimenType === 'other' ? (form.specimenTypeOther?.trim() || null) : null,
    tube_number: form.tubeNumber?.trim() || null,
    clot_status: form.clotStatus ?? null,
    color_appearance: form.colorAppearance?.trim() || null,
    chamber_background: form.chamberBackground?.trim() || null,
    dilution_used: form.dilutionUsed,
    dilution_background_ok: form.dilutionUsed ? (form.dilutionBackgroundOk ?? null) : null,
    dilution_factor: form.dilutionUsed ? (form.dilutionFactor ?? null) : null,
    second_tech_enabled: form.secondTechEnabled,
    second_tech_user_id: form.secondTechEnabled ? (secondTech?.userId ?? null) : null,
    second_tech_name: form.secondTechEnabled ? (secondTech?.name ?? null) : null,
    second_tech_staff_id: form.secondTechEnabled ? (secondTech?.staffId ?? null) : null,
    tech1_total_wbc: derived.tech1TotalWbc ?? null,
    tech1_avg_wbc: derived.tech1AvgWbc ?? null,
    tech1_total_rbc: derived.tech1TotalRbc ?? null,
    tech1_avg_rbc: derived.tech1AvgRbc ?? null,
    tech2_total_wbc: derived.tech2TotalWbc ?? null,
    tech2_avg_wbc: derived.tech2AvgWbc ?? null,
    tech2_total_rbc: derived.tech2TotalRbc ?? null,
    tech2_avg_rbc: derived.tech2AvgRbc ?? null,
    wbc_agreement: derived.wbcAgreement,
    rbc_agreement: derived.rbcAgreement,
    final_wbc: derived.finalWbc ?? null,
    final_rbc: derived.finalRbc ?? null,
    differential_neutrophils: form.differentialNeutrophils ?? null,
    differential_lymphocytes: form.differentialLymphocytes ?? null,
    differential_monocytes: form.differentialMonocytes ?? null,
    differential_other_type: form.differentialOtherType?.trim() || null,
    differential_other_quantity: form.differentialOtherQuantity ?? null,
    comments: form.comments?.trim() || null,
    pathologist_name: form.pathologistName?.trim() || null,
    pathologist_staff_id: form.pathologistStaffId?.trim() || null,
    pathologist_reviewed_at: form.pathologistReviewedAt || null,
    pathologist_comment: form.pathologistComment?.trim() || null,
    status,
    submitted_at: status === 'submitted' ? new Date().toISOString() : null,
    updated_by: staff.userId,
  };
}

async function resolveSecondTech(secondTechUserId?: string) {
  if (!secondTechUserId) return undefined;
  const staffResult = await fetchPortalStaff();
  const match = staffResult.data.find((staff) => staff.profileId === secondTechUserId);
  if (!match) return undefined;
  return { userId: match.profileId, name: match.fullName, staffId: match.staffId };
}

async function upsertCounts(worksheetId: string, counts: BodyFluidWorksheetFormData['counts']): Promise<string | null> {
  const supabase = createClient();
  for (const entry of counts) {
    const { error } = await supabase
      .from('body_fluid_count_entries')
      .upsert({
        worksheet_id: worksheetId,
        tech_number: entry.techNumber,
        cell_type: entry.cellType,
        square_number: entry.squareNumber,
        count_value: entry.countValue ?? null,
      }, { onConflict: 'worksheet_id,tech_number,cell_type,square_number' });
    if (error) return error.message;
  }
  return null;
}

export async function fetchBodyFluidWorksheets(search?: string): Promise<ClinicalListResult<BodyFluidWorksheetListItem>> {
  const result = await runClinicalListQuery('Failed to load body fluid worksheets', async () => {
    const supabase = createClient();
    let query = supabase
      .from('body_fluid_worksheets')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (search?.trim()) {
      query = query.ilike('patient_label_reference', `%${search.trim()}%`);
    }
    return query;
  });

  return {
    data: (result.data as WorksheetRow[]).map((row) => ({
      id: row.id,
      patientLabelReference: row.patient_label_reference,
      specimenType: row.specimen_type ?? undefined,
      timeReceived: row.time_received ?? undefined,
      primaryTechName: row.primary_tech_name,
      status: row.status,
      finalWbc: row.final_wbc ?? undefined,
      finalRbc: row.final_rbc ?? undefined,
      submittedAt: row.submitted_at ?? undefined,
      createdAt: row.created_at,
    })),
    error: result.error,
  };
}

export async function fetchBodyFluidWorksheetById(id: string): Promise<ClinicalResult<BodyFluidWorksheet>> {
  const result = await runClinicalMutation('Failed to load body fluid worksheet', async () => {
    const supabase = createClient();
    return supabase.from('body_fluid_worksheets').select('*').eq('id', id).is('deleted_at', null).single();
  });
  if (!result.data) return { data: null, error: result.error };
  const row = result.data as WorksheetRow;
  const countMap = await fetchCountsForWorksheets([row.id]);
  return { data: mapWorksheet(row, countMap[row.id] ?? []), error: null };
}

export async function createBodyFluidWorksheetDraft(
  staff: StaffContext,
): Promise<ClinicalResult<BodyFluidWorksheet>> {
  const insertResult = await runClinicalMutation('Failed to create body fluid worksheet', async () => {
    const supabase = createClient();
    return supabase
      .from('body_fluid_worksheets')
      .insert({
        primary_tech_user_id: staff.userId,
        primary_tech_name: staff.fullName,
        primary_tech_staff_id: staff.staffId,
        created_by: staff.userId,
        updated_by: staff.userId,
      })
      .select('*')
      .single();
  });
  if (!insertResult.data) return { data: null, error: insertResult.error };
  const worksheetId = (insertResult.data as WorksheetRow).id;

  const supabase = createClient();
  const seedRows = [];
  for (const techNumber of [1, 2]) {
    for (const cellType of ['wbc', 'rbc']) {
      const squareCount = cellType === 'wbc' ? 4 : 5;
      for (let square = 1; square <= squareCount; square += 1) {
        seedRows.push({
          worksheet_id: worksheetId,
          tech_number: techNumber,
          cell_type: cellType,
          square_number: square,
        });
      }
    }
  }
  const { error: seedError } = await supabase.from('body_fluid_count_entries').insert(seedRows);
  if (seedError) return { data: null, error: seedError.message };

  await logAudit(worksheetId, staff, 'worksheet_created');
  return fetchBodyFluidWorksheetById(worksheetId);
}

export async function saveBodyFluidWorksheetDraft(
  worksheetId: string,
  staff: StaffContext,
  form: BodyFluidWorksheetFormData,
): Promise<ClinicalResult<BodyFluidWorksheet>> {
  const current = await fetchBodyFluidWorksheetById(worksheetId);
  if (!current.data) return { data: null, error: current.error ?? 'Worksheet not found' };
  if (current.data.status !== 'draft') return { data: null, error: 'Submitted worksheets cannot be edited.' };

  const secondTech = await resolveSecondTech(form.secondTechUserId);
  const payload = buildWorksheetPayload(form, staff, secondTech, 'draft');

  const updateResult = await runClinicalMutation('Failed to save body fluid worksheet', async () => {
    const supabase = createClient();
    return supabase.from('body_fluid_worksheets').update(payload).eq('id', worksheetId).select('*').single();
  });
  if (!updateResult.data) return { data: null, error: updateResult.error };

  const countError = await upsertCounts(worksheetId, form.counts);
  if (countError) return { data: null, error: countError };

  await logAudit(worksheetId, staff, 'worksheet_saved');
  return fetchBodyFluidWorksheetById(worksheetId);
}

export async function submitBodyFluidWorksheet(
  worksheetId: string,
  staff: StaffContext,
  form: BodyFluidWorksheetFormData,
): Promise<ClinicalResult<BodyFluidWorksheet>> {
  const derived = deriveBodyFluidCounts({
    counts: form.counts.map((entry) => ({
      techNumber: entry.techNumber,
      cellType: entry.cellType,
      squareNumber: entry.squareNumber,
      countValue: entry.countValue ?? undefined,
    })),
    secondTechEnabled: form.secondTechEnabled,
    dilutionUsed: form.dilutionUsed,
    dilutionFactor: form.dilutionFactor,
  });

  const validation = validateBodyFluidSubmit({
    specimenType: form.specimenType,
    specimenTypeOther: form.specimenTypeOther,
    timeReceived: form.timeReceived,
    counts: form.counts.map((entry) => ({
      techNumber: entry.techNumber,
      cellType: entry.cellType,
      squareNumber: entry.squareNumber,
      countValue: entry.countValue ?? undefined,
    })),
    secondTechEnabled: form.secondTechEnabled,
    secondTechUserId: form.secondTechUserId,
    dilutionUsed: form.dilutionUsed,
    dilutionFactor: form.dilutionFactor,
    comments: form.comments,
    derived,
  });
  if (!validation.ok) return { data: null, error: validation.reason ?? 'Cannot submit worksheet' };

  const secondTech = await resolveSecondTech(form.secondTechUserId);
  const payload = buildWorksheetPayload(form, staff, secondTech, 'submitted');

  const updateResult = await runClinicalMutation('Failed to submit body fluid worksheet', async () => {
    const supabase = createClient();
    return supabase.from('body_fluid_worksheets').update(payload).eq('id', worksheetId).select('*').single();
  });
  if (!updateResult.data) return { data: null, error: updateResult.error };

  const countError = await upsertCounts(worksheetId, form.counts);
  if (countError) return { data: null, error: countError };

  await logAudit(worksheetId, staff, 'worksheet_submitted', {
    finalWbc: derived.finalWbc,
    finalRbc: derived.finalRbc,
    wbcAgreement: derived.wbcAgreement,
    rbcAgreement: derived.rbcAgreement,
  });
  return fetchBodyFluidWorksheetById(worksheetId);
}

export async function logBodyFluidWorksheetPrinted(
  worksheetId: string,
  staff: StaffContext,
): Promise<void> {
  await logAudit(worksheetId, staff, 'worksheet_printed');
}
