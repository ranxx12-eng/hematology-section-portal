import { createClient } from '@/lib/supabase/client';
import type { MaintenanceRecordFormData } from '@/lib/maintenance-records/schema';
import type { MaintenanceRecord } from '@/types';
import type { EmployeeContext } from './staff-context';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface MaintenanceChecklistRow {
  id: string;
  item_order: number;
  item_text: string;
  is_completed: boolean;
}

interface MaintenanceRecordRow {
  id: string;
  instrument_id: string;
  maintenance_type: MaintenanceRecord['maintenanceType'];
  maintenance_date: string;
  shift: string;
  performed_by: string;
  result: MaintenanceRecord['result'];
  issue_found: string | null;
  corrective_action: string | null;
  ticket_number: string | null;
  engineer_name: string | null;
  supervisor_review: boolean;
  review_date: string | null;
  electronic_signature: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  maintenance_checklist_items?: MaintenanceChecklistRow[];
}

function combineDateTime(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

function mapMaintenanceRecord(row: MaintenanceRecordRow): MaintenanceRecord {
  const checklist = (row.maintenance_checklist_items ?? [])
    .sort((a, b) => a.item_order - b.item_order)
    .map((item) => ({
      item: item.item_text,
      completed: item.is_completed,
    }));

  return {
    id: row.id,
    instrumentId: row.instrument_id,
    maintenanceType: row.maintenance_type,
    date: combineDateTime(row.maintenance_date, row.created_at.slice(11, 16)),
    shift: row.shift,
    performedBy: row.performed_by,
    checklist,
    result: row.result,
    issueFound: row.issue_found ?? undefined,
    correctiveAction: row.corrective_action ?? undefined,
    ticketNumber: row.ticket_number ?? undefined,
    engineerName: row.engineer_name ?? undefined,
    supervisorReview: row.supervisor_review,
    reviewDate: row.review_date ?? undefined,
    electronicSignature: row.electronic_signature ?? undefined,
    createdAt: row.created_at,
  };
}

function formToInsertRow(form: MaintenanceRecordFormData, employee: EmployeeContext) {
  return {
    instrument_id: form.instrumentId,
    maintenance_type: form.maintenanceType,
    maintenance_date: form.maintenanceDate,
    shift: form.shift,
    performed_by: employee.employeeId,
    result: form.result,
    issue_found: form.comments?.trim() || null,
    created_by: employee.userId,
  };
}

function formToUpdateRow(form: MaintenanceRecordFormData) {
  return {
    instrument_id: form.instrumentId,
    maintenance_type: form.maintenanceType,
    maintenance_date: form.maintenanceDate,
    shift: form.shift,
    result: form.result,
    issue_found: form.comments?.trim() || null,
  };
}

const MAINTENANCE_SELECT = `
  *,
  maintenance_checklist_items (
    id,
    item_order,
    item_text,
    is_completed
  )
`;

export async function fetchMaintenanceRecords(): Promise<ClinicalListResult<MaintenanceRecord>> {
  const result = await runClinicalListQuery('Failed to load maintenance records', async () => {
    const supabase = createClient();
    return supabase
      .from('maintenance_records')
      .select(MAINTENANCE_SELECT)
      .is('deleted_at', null)
      .order('maintenance_date', { ascending: false })
      .order('created_at', { ascending: false });
  });

  return {
    data: (result.data as unknown as MaintenanceRecordRow[]).map(mapMaintenanceRecord),
    error: result.error,
  };
}

export async function createMaintenanceRecord(
  employee: EmployeeContext,
  form: MaintenanceRecordFormData,
): Promise<ClinicalResult<MaintenanceRecord>> {
  return runClinicalMutation('Failed to create maintenance record', async () => {
    const supabase = createClient();
    return supabase
      .from('maintenance_records')
      .insert(formToInsertRow(form, employee))
      .select(MAINTENANCE_SELECT)
      .single();
  }).then((result) => ({
    data: result.data ? mapMaintenanceRecord(result.data as unknown as MaintenanceRecordRow) : null,
    error: result.error,
  }));
}

export async function updateMaintenanceRecord(
  id: string,
  form: MaintenanceRecordFormData,
): Promise<ClinicalResult<MaintenanceRecord>> {
  return runClinicalMutation('Failed to update maintenance record', async () => {
    const supabase = createClient();
    return supabase
      .from('maintenance_records')
      .update(formToUpdateRow(form))
      .eq('id', id)
      .is('deleted_at', null)
      .select(MAINTENANCE_SELECT)
      .single();
  }).then((result) => ({
    data: result.data ? mapMaintenanceRecord(result.data as unknown as MaintenanceRecordRow) : null,
    error: result.error,
  }));
}

export async function fetchMaintenanceInstruments(): Promise<{ id: string; name: string }[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('instruments')
      .select('id, name')
      .is('deleted_at', null)
      .order('name');

    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

export async function fetchInstrumentNameMap(): Promise<Record<string, string>> {
  const instruments = await fetchMaintenanceInstruments();
  return Object.fromEntries(instruments.map((row) => [row.id, row.name]));
}

export async function fetchEmployeeNameMap(): Promise<Record<string, string>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('employees')
      .select('id, full_name')
      .is('deleted_at', null);

    if (error || !data) return {};
    return Object.fromEntries(data.map((row) => [row.id, row.full_name]));
  } catch {
    return {};
  }
}
