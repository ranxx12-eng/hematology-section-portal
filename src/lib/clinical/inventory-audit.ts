import { createClient } from '@/lib/supabase/client';
import type { StaffContext } from '@/lib/clinical/staff-context';

export async function logInventoryAudit(
  staff: StaffContext,
  input: {
    entityType: string;
    entityId: string;
    action: string;
    inventoryItemId?: string;
    lotNumber?: string;
    comment?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const supabase = createClient();
  await supabase.from('inventory_audit_events').insert({
    entity_type: input.entityType,
    entity_id: input.entityId,
    inventory_item_id: input.inventoryItemId ?? null,
    lot_number: input.lotNumber ?? null,
    action: input.action,
    user_id: staff.userId,
    user_name: staff.fullName,
    staff_id: staff.staffId,
    comment: input.comment ?? null,
    metadata: input.metadata ?? null,
  });
}

export async function fetchInventoryAuditForItem(itemId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('inventory_audit_events')
    .select('*')
    .eq('inventory_item_id', itemId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []).map((row) => ({
      id: row.id as string,
      entityType: row.entity_type as string,
      entityId: row.entity_id as string,
      inventoryItemId: (row.inventory_item_id as string | null) ?? undefined,
      lotNumber: (row.lot_number as string | null) ?? undefined,
      action: row.action as string,
      userName: (row.user_name as string | null) ?? undefined,
      comment: (row.comment as string | null) ?? undefined,
      metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
      createdAt: row.created_at as string,
    })),
    error: null,
  };
}

export async function fetchInventoryAuditForLot(lotNumber: string, itemId?: string) {
  const supabase = createClient();
  let query = supabase
    .from('inventory_audit_events')
    .select('*')
    .eq('lot_number', lotNumber)
    .order('created_at', { ascending: false })
    .limit(100);
  if (itemId) query = query.eq('inventory_item_id', itemId);
  const { data, error } = await query;
  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []).map((row) => ({
      id: row.id as string,
      entityType: row.entity_type as string,
      entityId: row.entity_id as string,
      inventoryItemId: (row.inventory_item_id as string | null) ?? undefined,
      lotNumber: (row.lot_number as string | null) ?? undefined,
      action: row.action as string,
      userName: (row.user_name as string | null) ?? undefined,
      comment: (row.comment as string | null) ?? undefined,
      metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
      createdAt: row.created_at as string,
    })),
    error: null,
  };
}
