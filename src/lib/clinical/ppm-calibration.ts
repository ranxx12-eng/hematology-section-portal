import { createClient } from '@/lib/supabase/client';
import { fetchInstrumentById, fetchInstruments } from '@/lib/clinical/instruments';
import {
  computeDueStatus,
  computeRecordDueStatus,
  isMaintenanceTypeRequired,
} from '@/lib/ppm-calibration/compliance';
import type {
  CalibrationRecordFormData,
  PpmRecordFormData,
  PpmReviewFormData,
} from '@/lib/ppm-calibration/schema';
import { PPM_CALIBRATION_BUCKET, PPM_CALIBRATION_STORAGE_PREFIX } from '@/lib/ppm-calibration/constants';
import type { Instrument } from '@/types';
import type {
  EquipmentMaintenanceRecord,
  InstrumentMaintenanceSummary,
  PpmCalibrationDashboardStats,
} from '@/types/ppm-calibration';
import type { StaffContext } from './staff-context';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface MaintenanceRow {
  id: string;
  instrument_equipment_id: string;
  record_type: EquipmentMaintenanceRecord['recordType'];
  performed_date: string;
  next_due_date: string | null;
  performed_by: string;
  performed_by_name: string;
  performed_by_staff_id: string | null;
  performed_by_type: EquipmentMaintenanceRecord['performedByType'] | null;
  service_provider: string | null;
  engineer_name: string | null;
  certificate_number: string | null;
  work_order_number: string | null;
  ticket_number: string | null;
  result: EquipmentMaintenanceRecord['result'];
  comment: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_by_staff_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRecord(row: MaintenanceRow, instrument: Instrument): EquipmentMaintenanceRecord {
  return {
    id: row.id,
    instrumentEquipmentId: row.instrument_equipment_id,
    recordType: row.record_type,
    performedDate: row.performed_date,
    nextDueDate: row.next_due_date ?? undefined,
    dueStatus: computeRecordDueStatus(
      { nextDueDate: row.next_due_date, recordType: row.record_type },
      { ppmFrequency: instrument.ppmFrequency, calibrationFrequency: instrument.calibrationFrequency },
    ),
    performedBy: row.performed_by,
    performedByName: row.performed_by_name,
    performedByStaffId: row.performed_by_staff_id ?? undefined,
    performedByType: row.performed_by_type ?? undefined,
    serviceProvider: row.service_provider ?? undefined,
    engineerName: row.engineer_name ?? undefined,
    certificateNumber: row.certificate_number ?? undefined,
    workOrderNumber: row.work_order_number ?? undefined,
    ticketNumber: row.ticket_number ?? undefined,
    result: row.result,
    comment: row.comment ?? undefined,
    attachmentPath: row.attachment_path ?? undefined,
    attachmentName: row.attachment_name ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedByName: row.reviewed_by_name ?? undefined,
    reviewedByStaffId: row.reviewed_by_staff_id ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function latestByType(
  records: EquipmentMaintenanceRecord[],
  type: EquipmentMaintenanceRecord['recordType'],
): EquipmentMaintenanceRecord | undefined {
  return records
    .filter((r) => r.recordType === type)
    .sort((a, b) => b.performedDate.localeCompare(a.performedDate))[0];
}

export function buildInstrumentMaintenanceSummary(
  instrument: Instrument,
  records: EquipmentMaintenanceRecord[],
): InstrumentMaintenanceSummary {
  const ppmRequired = isMaintenanceTypeRequired(instrument.ppmFrequency);
  const calibrationRequired = isMaintenanceTypeRequired(instrument.calibrationFrequency);
  const latestPpm = latestByType(records, 'ppm');
  const latestCalibration = latestByType(records, 'calibration');

  const nextPpmDate = latestPpm?.nextDueDate ?? instrument.nextMaintenance;
  const nextCalibrationDate = latestCalibration?.nextDueDate ?? instrument.calibrationDueDate;

  return {
    instrumentId: instrument.id,
    instrumentName: instrument.name,
    itemType: instrument.itemType ?? 'instrument',
    assetCode: instrument.assetCode,
    location: instrument.location,
    lastPpmDate: latestPpm?.performedDate ?? instrument.lastMaintenance,
    nextPpmDate,
    ppmStatus: computeDueStatus(nextPpmDate, ppmRequired),
    lastCalibrationDate: latestCalibration?.performedDate,
    nextCalibrationDate,
    calibrationStatus: computeDueStatus(nextCalibrationDate, calibrationRequired),
    ppmRequired,
    calibrationRequired,
  };
}

export function computeDashboardStats(
  summaries: InstrumentMaintenanceSummary[],
): PpmCalibrationDashboardStats {
  return {
    totalItems: summaries.length,
    ppmDueSoon: summaries.filter((s) => s.ppmStatus === 'due_soon').length,
    ppmOverdue: summaries.filter((s) => s.ppmStatus === 'overdue').length,
    calibrationDueSoon: summaries.filter((s) => s.calibrationStatus === 'due_soon').length,
    calibrationOverdue: summaries.filter((s) => s.calibrationStatus === 'overdue').length,
  };
}

export async function fetchEquipmentMaintenanceRecords(
  instrumentId?: string,
): Promise<ClinicalListResult<EquipmentMaintenanceRecord>> {
  const [instrumentsResult, recordsResult] = await Promise.all([
    fetchInstruments(),
    runClinicalListQuery('Failed to load PPM/calibration records', async () => {
      const supabase = createClient();
      let query = supabase
        .from('equipment_maintenance_records')
        .select('*')
        .is('deleted_at', null)
        .order('performed_date', { ascending: false });
      if (instrumentId) query = query.eq('instrument_equipment_id', instrumentId);
      return query;
    }),
  ]);

  const instrumentMap = Object.fromEntries(instrumentsResult.data.map((i) => [i.id, i]));

  return {
    data: (recordsResult.data as unknown as MaintenanceRow[])
      .map((row) => {
        const instrument = instrumentMap[row.instrument_equipment_id];
        if (!instrument) return null;
        return mapRecord(row, instrument);
      })
      .filter((row): row is EquipmentMaintenanceRecord => row != null),
    error: recordsResult.error ?? instrumentsResult.error,
  };
}

export async function fetchPpmCalibrationBundle() {
  const [instruments, records] = await Promise.all([
    fetchInstruments(),
    fetchEquipmentMaintenanceRecords(),
  ]);

  const recordsByInstrument = records.data.reduce<Record<string, EquipmentMaintenanceRecord[]>>((acc, record) => {
    acc[record.instrumentEquipmentId] = [...(acc[record.instrumentEquipmentId] ?? []), record];
    return acc;
  }, {});

  const summaries = instruments.data
    .filter((instrument) => instrument.active !== false)
    .map((instrument) => buildInstrumentMaintenanceSummary(instrument, recordsByInstrument[instrument.id] ?? []));

  return {
    instruments: instruments.data,
    records: records.data,
    summaries,
    stats: computeDashboardStats(summaries),
    error: instruments.error ?? records.error,
  };
}

async function uploadAttachment(
  recordId: string,
  file: File,
): Promise<{ path: string; name: string } | { error: string }> {
  const supabase = createClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${PPM_CALIBRATION_STORAGE_PREFIX}/${recordId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(PPM_CALIBRATION_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (error) return { error: error.message };
  return { path, name: file.name };
}

export async function createPpmRecord(
  staff: StaffContext,
  form: PpmRecordFormData,
  attachment?: File,
): Promise<ClinicalResult<EquipmentMaintenanceRecord>> {
  const insertResult = await runClinicalMutation('Failed to record PPM', async () => {
    const supabase = createClient();
    return supabase
      .from('equipment_maintenance_records')
      .insert({
        instrument_equipment_id: form.instrumentEquipmentId,
        record_type: 'ppm',
        performed_date: form.performedDate,
        next_due_date: form.nextDueDate || null,
        performed_by: staff.userId,
        performed_by_name: staff.fullName,
        performed_by_staff_id: staff.staffId,
        service_provider: form.serviceProvider?.trim() || null,
        engineer_name: form.engineerName?.trim() || null,
        work_order_number: form.workOrderNumber?.trim() || null,
        ticket_number: form.ticketNumber?.trim() || null,
        result: form.result,
        comment: form.comment?.trim() || null,
        created_by: staff.userId,
        updated_by: staff.userId,
      })
      .select('*')
      .single();
  });

  if (!insertResult.data || insertResult.error) {
    return { data: null, error: insertResult.error };
  }

  let row = insertResult.data as unknown as MaintenanceRow;

  if (attachment) {
    const upload = await uploadAttachment(row.id, attachment);
    if ('error' in upload) return { data: null, error: upload.error };

    const updateResult = await runClinicalMutation('Failed to attach PPM report', async () => {
      const supabase = createClient();
      return supabase
        .from('equipment_maintenance_records')
        .update({
          attachment_path: upload.path,
          attachment_name: upload.name,
          updated_by: staff.userId,
        })
        .eq('id', row.id)
        .select('*')
        .single();
    });
    if (updateResult.data) row = updateResult.data as unknown as MaintenanceRow;
  }

  const instrumentResult = await fetchInstrumentById(form.instrumentEquipmentId);

  return {
    data: instrumentResult.data ? mapRecord(row, instrumentResult.data) : null,
    error: null,
  };
}

export async function createCalibrationRecord(
  staff: StaffContext,
  form: CalibrationRecordFormData,
  attachment?: File,
): Promise<ClinicalResult<EquipmentMaintenanceRecord>> {
  const isInternal = form.performedByType === 'internal_staff';

  const insertResult = await runClinicalMutation('Failed to record calibration', async () => {
    const supabase = createClient();
    return supabase
      .from('equipment_maintenance_records')
      .insert({
        instrument_equipment_id: form.instrumentEquipmentId,
        record_type: 'calibration',
        performed_date: form.performedDate,
        next_due_date: form.nextDueDate || null,
        performed_by: staff.userId,
        performed_by_name: staff.fullName,
        performed_by_staff_id: staff.staffId,
        performed_by_type: form.performedByType,
        certificate_number: form.certificateNumber?.trim() || null,
        service_provider: isInternal ? null : (form.serviceProvider?.trim() || null),
        engineer_name: isInternal ? null : (form.engineerName?.trim() || null),
        work_order_number: isInternal ? null : (form.workOrderNumber?.trim() || null),
        ticket_number: isInternal ? null : (form.ticketNumber?.trim() || null),
        result: form.result,
        comment: form.comment?.trim() || null,
        created_by: staff.userId,
        updated_by: staff.userId,
      })
      .select('*')
      .single();
  });

  if (!insertResult.data || insertResult.error) {
    return { data: null, error: insertResult.error };
  }

  let row = insertResult.data as unknown as MaintenanceRow;

  if (attachment) {
    const upload = await uploadAttachment(row.id, attachment);
    if ('error' in upload) return { data: null, error: upload.error };

    const updateResult = await runClinicalMutation('Failed to attach calibration certificate', async () => {
      const supabase = createClient();
      return supabase
        .from('equipment_maintenance_records')
        .update({
          attachment_path: upload.path,
          attachment_name: upload.name,
          updated_by: staff.userId,
        })
        .eq('id', row.id)
        .select('*')
        .single();
    });
    if (updateResult.data) row = updateResult.data as unknown as MaintenanceRow;
  }

  const instrumentResult = await fetchInstrumentById(form.instrumentEquipmentId);

  return {
    data: instrumentResult.data ? mapRecord(row, instrumentResult.data) : null,
    error: null,
  };
}

export async function reviewEquipmentMaintenanceRecord(
  recordId: string,
  staff: StaffContext,
  form: PpmReviewFormData,
): Promise<ClinicalResult<EquipmentMaintenanceRecord>> {
  const now = new Date().toISOString();
  const result = await runClinicalMutation('Failed to review record', async () => {
    const supabase = createClient();
    return supabase
      .from('equipment_maintenance_records')
      .update({
        reviewed_by: staff.userId,
        reviewed_by_name: staff.fullName,
        reviewed_by_staff_id: staff.staffId,
        reviewed_at: now,
        comment: form.reviewComment?.trim() || undefined,
        updated_by: staff.userId,
      })
      .eq('id', recordId)
      .select('*')
      .single();
  });

  if (!result.data) return { data: null, error: result.error };

  const row = result.data as unknown as MaintenanceRow;
  const instrumentResult = await fetchInstrumentById(row.instrument_equipment_id);

  return {
    data: instrumentResult.data ? mapRecord(row, instrumentResult.data) : null,
    error: result.error,
  };
}

export async function getAttachmentSignedUrl(path: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(PPM_CALIBRATION_BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function softDeleteEquipmentMaintenanceRecord(
  recordId: string,
  staff: StaffContext,
  reason: string,
): Promise<{ error: string | null }> {
  const result = await runClinicalMutation('Failed to delete record', async () => {
    const supabase = createClient();
    return supabase
      .from('equipment_maintenance_records')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: staff.userId,
        deleted_by_name: staff.fullName,
        deleted_by_staff_id: staff.staffId,
        delete_reason: reason.trim(),
      })
      .eq('id', recordId)
      .is('deleted_at', null)
      .select('id')
      .single();
  });
  return { error: result.error };
}
