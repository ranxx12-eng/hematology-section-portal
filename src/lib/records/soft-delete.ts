import { createClient } from '@/lib/supabase/client';
import type { StaffContext } from '@/lib/clinical/staff-context';
import { runClinicalMutation } from '@/lib/clinical/result';
import {
  buildSoftDeleteAuditPayload,
  OPERATIONAL_RECORD_MODULE_MAP,
  type OperationalRecordModule,
} from './registry';

export async function softDeleteOperationalRecord(
  module: OperationalRecordModule,
  id: string,
  staff: StaffContext,
  deleteReason?: string,
): Promise<{ error: string | null }> {
  const config = OPERATIONAL_RECORD_MODULE_MAP[module];
  const payload = buildSoftDeleteAuditPayload(staff, deleteReason);

  const result = await runClinicalMutation('Failed to delete record', async () => {
    const supabase = createClient();
    return supabase
      .from(config.table)
      .update(payload)
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .single();
  });

  return { error: result.error };
}
