import type { StaffContext } from '@/lib/clinical/staff-context';

export type OperationalRecordModule =
  | 'critical_values'
  | 'sample_rejections'
  | 'corrected_results'
  | 'pending_samples'
  | 'qc_records'
  | 'tat_records'
  | 'maintenance_records'
  | 'tasks'
  | 'inventory_items'
  | 'form_submissions';

export interface OperationalRecordModuleConfig {
  module: OperationalRecordModule;
  label: string;
  table: OperationalRecordModule;
  /** Existing manage permission that may soft-delete (legacy modules). */
  legacyManageDeletePermission?: string;
  summaryFields: string[];
  patientReferenceFields?: string[];
  createdAtField: string;
  deletedAtField: string;
}

export const OPERATIONAL_RECORD_MODULES: OperationalRecordModuleConfig[] = [
  {
    module: 'critical_values',
    label: 'Critical Values',
    table: 'critical_values',
    legacyManageDeletePermission: 'critical_values.manage',
    summaryFields: ['patient_name', 'patient_acc_number', 'tests'],
    patientReferenceFields: ['patient_name', 'patient_acc_number', 'patient_id'],
    createdAtField: 'created_at',
    deletedAtField: 'deleted_at',
  },
  {
    module: 'sample_rejections',
    label: 'Sample Rejections',
    table: 'sample_rejections',
    summaryFields: ['patient_name', 'patient_lab_accession', 'rejected_tests'],
    patientReferenceFields: ['patient_name', 'patient_lab_accession', 'patient_id'],
    createdAtField: 'created_at',
    deletedAtField: 'deleted_at',
  },
  {
    module: 'corrected_results',
    label: 'Corrected Results',
    table: 'corrected_results',
    summaryFields: ['patient_name', 'lab_accession', 'test_name'],
    patientReferenceFields: ['patient_name', 'lab_accession', 'patient_id'],
    createdAtField: 'created_at',
    deletedAtField: 'deleted_at',
  },
  {
    module: 'pending_samples',
    label: 'Pending Samples',
    table: 'pending_samples',
    summaryFields: ['patient_name', 'patient_lab_accession', 'test_name'],
    patientReferenceFields: ['patient_name', 'patient_lab_accession', 'patient_id'],
    createdAtField: 'created_at',
    deletedAtField: 'deleted_at',
  },
  {
    module: 'qc_records',
    label: 'Quality Control',
    table: 'qc_records',
    summaryFields: ['test_name', 'control_level', 'qc_status', 'recorded_at'],
    createdAtField: 'created_at',
    deletedAtField: 'deleted_at',
  },
  {
    module: 'tat_records',
    label: 'TAT',
    table: 'tat_records',
    summaryFields: ['test_type', 'status', 'department'],
    createdAtField: 'created_at',
    deletedAtField: 'deleted_at',
  },
  {
    module: 'maintenance_records',
    label: 'Maintenance',
    table: 'maintenance_records',
    summaryFields: ['maintenance_type', 'maintenance_date', 'result'],
    createdAtField: 'created_at',
    deletedAtField: 'deleted_at',
  },
  {
    module: 'tasks',
    label: 'Tasks',
    table: 'tasks',
    legacyManageDeletePermission: 'tasks.manage',
    summaryFields: ['title', 'status'],
    createdAtField: 'created_at',
    deletedAtField: 'deleted_at',
  },
  {
    module: 'inventory_items',
    label: 'Inventory',
    table: 'inventory_items',
    legacyManageDeletePermission: 'inventory.manage',
    summaryFields: ['item_name', 'category', 'quantity'],
    createdAtField: 'created_at',
    deletedAtField: 'deleted_at',
  },
  {
    module: 'form_submissions',
    label: 'Form Submissions',
    table: 'form_submissions',
    summaryFields: ['submitted_at', 'status'],
    createdAtField: 'submitted_at',
    deletedAtField: 'deleted_at',
  },
];

export const OPERATIONAL_RECORD_MODULE_MAP = Object.fromEntries(
  OPERATIONAL_RECORD_MODULES.map((config) => [config.module, config]),
) as Record<OperationalRecordModule, OperationalRecordModuleConfig>;

export function getOperationalModuleLabel(module: OperationalRecordModule): string {
  return OPERATIONAL_RECORD_MODULE_MAP[module]?.label ?? module;
}

export interface SoftDeleteAuditPayload {
  deleted_at: string;
  deleted_by: string;
  deleted_by_name: string;
  deleted_by_staff_id: string | null;
  delete_reason: string | null;
}

export interface RestoreAuditPayload {
  deleted_at: null;
  restored_at: string;
  restored_by: string;
  restored_by_name: string;
  restored_by_staff_id: string | null;
}

export function buildSoftDeleteAuditPayload(
  staff: StaffContext,
  deleteReason?: string,
): SoftDeleteAuditPayload {
  return {
    deleted_at: new Date().toISOString(),
    deleted_by: staff.userId,
    deleted_by_name: staff.fullName,
    deleted_by_staff_id: staff.staffId,
    delete_reason: deleteReason?.trim() || null,
  };
}

export function buildRestoreAuditPayload(staff: StaffContext): RestoreAuditPayload {
  return {
    deleted_at: null,
    restored_at: new Date().toISOString(),
    restored_by: staff.userId,
    restored_by_name: staff.fullName,
    restored_by_staff_id: staff.staffId,
  };
}

function formatFieldValue(value: unknown): string {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (typeof value === 'object') return '';
  return String(value);
}

export function buildRecordSummary(row: Record<string, unknown>, config: OperationalRecordModuleConfig): string {
  const parts = config.summaryFields
    .map((field) => formatFieldValue(row[field]))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Record';
}

export function buildPatientReference(row: Record<string, unknown>, config: OperationalRecordModuleConfig): string {
  if (!config.patientReferenceFields?.length) return '—';
  const parts = config.patientReferenceFields
    .map((field) => formatFieldValue(row[field]))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

export interface DeletedOperationalRecord {
  id: string;
  module: OperationalRecordModule;
  moduleLabel: string;
  summary: string;
  patientReference: string;
  deletedByName: string | null;
  deletedByStaffId: string | null;
  deletedAt: string;
  deleteReason: string | null;
  createdAt: string;
}

export function mapDeletedRow(
  module: OperationalRecordModule,
  row: Record<string, unknown>,
): DeletedOperationalRecord {
  const config = OPERATIONAL_RECORD_MODULE_MAP[module];
  return {
    id: String(row.id),
    module,
    moduleLabel: config.label,
    summary: buildRecordSummary(row, config),
    patientReference: buildPatientReference(row, config),
    deletedByName: (row.deleted_by_name as string | null) ?? null,
    deletedByStaffId: (row.deleted_by_staff_id as string | null) ?? null,
    deletedAt: String(row.deleted_at ?? ''),
    deleteReason: (row.delete_reason as string | null) ?? null,
    createdAt: String(row.created_at ?? row[config.createdAtField] ?? ''),
  };
}
