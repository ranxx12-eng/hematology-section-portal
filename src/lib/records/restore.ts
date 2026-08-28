import { createClient } from '@/lib/supabase/client';
import type { StaffContext } from '@/lib/clinical/staff-context';
import { runClinicalMutation } from '@/lib/clinical/result';
import type { Permission } from '@/lib/permissions/roles';
import {
  buildRestoreAuditPayload,
  mapDeletedRow,
  OPERATIONAL_RECORD_MODULES,
  OPERATIONAL_RECORD_MODULE_MAP,
  type DeletedOperationalRecord,
  type OperationalRecordModule,
} from './registry';

export async function restoreOperationalRecord(
  module: OperationalRecordModule,
  id: string,
  staff: StaffContext,
): Promise<{ error: string | null }> {
  const config = OPERATIONAL_RECORD_MODULE_MAP[module];
  const payload = buildRestoreAuditPayload(staff);

  const result = await runClinicalMutation('Failed to restore record', async () => {
    const supabase = createClient();
    return supabase
      .from(config.table)
      .update(payload)
      .eq('id', id)
      .not('deleted_at', 'is', null)
      .select('id')
      .single();
  });

  return { error: result.error };
}

const DELETED_SELECT_COLUMNS = [
  'id',
  'created_at',
  'deleted_at',
  'deleted_by_name',
  'deleted_by_staff_id',
  'delete_reason',
  'patient_name',
  'patient_acc_number',
  'patient_id',
  'patient_lab_accession',
  'lab_accession',
  'tests',
  'rejected_tests',
  'test_name',
  'control_level',
  'qc_status',
  'recorded_at',
  'maintenance_type',
  'maintenance_date',
  'result',
  'title',
  'status',
  'item_name',
  'category',
  'quantity',
  'submitted_at',
  'status',
  'test_type',
].join(', ');

export async function fetchDeletedOperationalRecords(): Promise<{
  data: DeletedOperationalRecord[];
  error: string | null;
}> {
  const supabase = createClient();
  const results: DeletedOperationalRecord[] = [];
  const errors: string[] = [];

  await Promise.all(
    OPERATIONAL_RECORD_MODULES.map(async (config) => {
      const { data, error } = await supabase
        .from(config.table)
        .select(DELETED_SELECT_COLUMNS)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (error) {
        errors.push(`${config.label}: ${error.message}`);
        return;
      }

      for (const row of data ?? []) {
        results.push(mapDeletedRow(config.module, row as unknown as Record<string, unknown>));
      }
    }),
  );

  results.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));

  return {
    data: results,
    error: errors.length > 0 ? errors.join('; ') : null,
  };
}

export function canSoftDeleteModule(
  module: OperationalRecordModule,
  can: (permission: Permission) => boolean,
): boolean {
  if (can('records.delete')) return true;
  const legacy = OPERATIONAL_RECORD_MODULE_MAP[module].legacyManageDeletePermission as Permission | undefined;
  return legacy ? can(legacy) : false;
}
