import { createClient } from '@/lib/supabase/client';
import { buildLotContextKey } from '@/lib/inventory/constants';
import { logInventoryAudit } from '@/lib/clinical/inventory-audit';
import type { InventoryLotUsage, LotUsageStatus } from '@/types/inventory-module';
import type { InventoryItem } from '@/types';
import type { StaffContext } from './staff-context';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

function mapRow(row: Record<string, unknown>): InventoryLotUsage {
  return {
    id: row.id as string,
    inventoryItemId: row.inventory_item_id as string,
    itemNameSnapshot: row.item_name_snapshot as string,
    categorySnapshot: row.category_snapshot as string,
    lotNumberSnapshot: row.lot_number_snapshot as string,
    manufacturerSnapshot: (row.manufacturer_snapshot as string | null) ?? undefined,
    contextKey: row.context_key as string,
    instrumentId: (row.instrument_id as string | null) ?? undefined,
    instrumentNameSnapshot: (row.instrument_name_snapshot as string | null) ?? undefined,
    testParameter: (row.test_parameter as string | null) ?? undefined,
    methodName: (row.method_name as string | null) ?? undefined,
    startDate: (row.start_date as string | null) ?? undefined,
    openDate: (row.open_date as string | null) ?? undefined,
    expiryDate: (row.expiry_date as string | null) ?? undefined,
    openVialExpiryDate: (row.open_vial_expiry_date as string | null) ?? undefined,
    quantityRemaining: row.quantity_remaining != null ? Number(row.quantity_remaining) : undefined,
    status: row.status as LotUsageStatus,
    startedByName: (row.started_by_name as string | null) ?? undefined,
    startedByStaffId: (row.started_by_staff_id as string | null) ?? undefined,
    reagentComparisonId: (row.reagent_comparison_id as string | null) ?? undefined,
    notes: (row.notes as string | null) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export interface ActivateLotInput {
  inventoryItemId: string;
  instrumentId?: string;
  instrumentName?: string;
  testParameter?: string;
  methodName?: string;
  startDate?: string;
  openDate?: string;
  openVialExpiryDate?: string;
  quantityRemaining?: number;
  notes?: string;
  kind: 'reagent' | 'qc';
  qcLevel?: string;
  reagentComparisonId?: string;
}

export async function fetchLotUsageRecords(status?: LotUsageStatus): Promise<ClinicalListResult<InventoryLotUsage>> {
  return runClinicalListQuery('Failed to load lot usage records', async () => {
    const supabase = createClient();
    let query = supabase.from('inventory_lot_usage').select('*').order('updated_at', { ascending: false });
    if (status) query = query.eq('status', status);
    return query;
  }).then((result) => ({
    data: (result.data as Array<Record<string, unknown>>).map(mapRow),
    error: result.error,
  }));
}

export async function activateLotFromStore(
  staff: StaffContext,
  item: InventoryItem,
  input: ActivateLotInput,
): Promise<ClinicalResult<InventoryLotUsage>> {
  const contextKey = buildLotContextKey({
    kind: input.kind,
    instrumentId: input.instrumentId,
    testParameter: input.testParameter,
    category: item.category,
    qcLevel: input.qcLevel,
  });

  const supabase = createClient();
  const { data: existing } = await supabase
    .from('inventory_lot_usage')
    .select('id, lot_number_snapshot')
    .eq('context_key', contextKey)
    .eq('status', 'active')
    .maybeSingle();

  if (existing && !input.reagentComparisonId) {
    return {
      data: null,
      error: `An active lot already exists for this context (Lot ${existing.lot_number_snapshot}). Complete lot verification or close the current lot first.`,
    };
  }

  if (existing) {
    await supabase
      .from('inventory_lot_usage')
      .update({ status: 'superseded', updated_at: new Date().toISOString() })
      .eq('id', existing.id as string);
    await logInventoryAudit(staff, {
      entityType: 'inventory_lot_usage',
      entityId: existing.id as string,
      inventoryItemId: item.id,
      lotNumber: existing.lot_number_snapshot as string,
      action: 'LOT_SUPERSEDED',
      metadata: { contextKey },
    });
  }

  const insertResult = await runClinicalMutation('Failed to activate lot', async () => {
    return supabase
      .from('inventory_lot_usage')
      .insert({
        inventory_item_id: item.id,
        item_name_snapshot: item.itemName,
        category_snapshot: item.category,
        lot_number_snapshot: item.lotNumber ?? '—',
        manufacturer_snapshot: item.manufacturer ?? null,
        context_key: contextKey,
        instrument_id: input.instrumentId ?? null,
        instrument_name_snapshot: input.instrumentName ?? null,
        test_parameter: input.testParameter ?? null,
        method_name: input.methodName ?? null,
        start_date: input.startDate ?? null,
        open_date: input.openDate ?? null,
        expiry_date: item.expiryDate ?? null,
        open_vial_expiry_date: input.openVialExpiryDate ?? null,
        quantity_remaining: input.quantityRemaining ?? item.quantity,
        status: 'active',
        started_by: staff.userId,
        started_by_name: staff.fullName,
        started_by_staff_id: staff.staffId,
        reagent_comparison_id: input.reagentComparisonId ?? null,
        notes: input.notes ?? null,
      })
      .select('*')
      .single();
  });

  if (!insertResult.data) return { data: null, error: insertResult.error };

  const usage = mapRow(insertResult.data as Record<string, unknown>);
  await logInventoryAudit(staff, {
    entityType: 'inventory_lot_usage',
    entityId: usage.id,
    inventoryItemId: item.id,
    lotNumber: usage.lotNumberSnapshot,
    action: 'LOT_ACTIVATED',
    metadata: { contextKey, reagentComparisonId: input.reagentComparisonId },
  });
  return { data: usage, error: null };
}

export async function closeLotUsage(
  staff: StaffContext,
  usageId: string,
  reason?: string,
): Promise<ClinicalResult<InventoryLotUsage>> {
  const result = await runClinicalMutation('Failed to close lot', async () => {
    const supabase = createClient();
    return supabase
      .from('inventory_lot_usage')
      .update({ status: 'closed' })
      .eq('id', usageId)
      .select('*')
      .single();
  });
  if (result.data) {
    const usage = mapRow(result.data as Record<string, unknown>);
    await logInventoryAudit(staff, {
      entityType: 'inventory_lot_usage',
      entityId: usageId,
      inventoryItemId: usage.inventoryItemId,
      lotNumber: usage.lotNumberSnapshot,
      action: 'LOT_CLOSED',
      comment: reason,
    });
    return { data: usage, error: null };
  }
  return { data: null, error: result.error };
}
