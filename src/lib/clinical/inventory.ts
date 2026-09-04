import { createClient } from '@/lib/supabase/client';
import { deriveStoreDisplayStatus } from '@/lib/inventory/constants';
import { deriveInventoryStatus, type InventoryFormData } from '@/lib/inventory/schema';
import type { InventoryItem } from '@/types';
import type { InventoryModuleSummary } from '@/types/inventory-module';
import { logInventoryAudit } from '@/lib/clinical/inventory-audit';
import type { StaffContext } from './staff-context';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface InventoryItemRow {
  id: string;
  item_name: string;
  item_code: string | null;
  category: string;
  manufacturer: string | null;
  catalog_number: string | null;
  lot_number: string | null;
  quantity: number;
  unit: string;
  minimum_stock: number;
  maximum_stock: number;
  reorder_level: number | null;
  expiry_date: string | null;
  storage_location: string;
  supplier: string | null;
  received_date: string | null;
  opened_date: string | null;
  status: InventoryItem['status'];
  barcode: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapInventoryItem(row: InventoryItemRow): InventoryItem {
  return {
    id: row.id,
    itemName: row.item_name,
    itemCode: row.item_code ?? undefined,
    category: row.category,
    manufacturer: row.manufacturer ?? undefined,
    catalogNumber: row.catalog_number ?? undefined,
    lotNumber: row.lot_number ?? undefined,
    quantity: Number(row.quantity),
    unit: row.unit,
    minimumStock: Number(row.minimum_stock),
    maximumStock: Number(row.maximum_stock),
    reorderLevel: row.reorder_level != null ? Number(row.reorder_level) : undefined,
    expiryDate: row.expiry_date ?? undefined,
    storageLocation: row.storage_location,
    supplier: row.supplier ?? undefined,
    receivedDate: row.received_date ?? undefined,
    openedDate: row.opened_date ?? undefined,
    status: row.status,
    barcode: row.barcode ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formToInsertRow(form: InventoryFormData, userId: string) {
  const status = deriveInventoryStatus(form.quantity, form.minimumStock, form.expiryDate || undefined);
  return {
    item_name: form.itemName.trim(),
    item_code: form.itemCode?.trim() || null,
    category: form.category,
    manufacturer: form.manufacturer?.trim() || null,
    catalog_number: form.catalogNumber?.trim() || null,
    lot_number: form.lotNumber?.trim() || null,
    quantity: form.quantity,
    unit: form.unit.trim(),
    minimum_stock: form.minimumStock,
    maximum_stock: form.maximumStock,
    reorder_level: form.reorderLevel ?? null,
    storage_location: form.storageLocation.trim(),
    supplier: form.supplier?.trim() || null,
    received_date: form.receivedDate || null,
    expiry_date: form.expiryDate || null,
    notes: form.notes?.trim() || null,
    status,
    created_by: userId,
    updated_by: userId,
  };
}

const INVENTORY_SELECT = '*';

export async function fetchInventoryItems(): Promise<ClinicalListResult<InventoryItem>> {
  return runClinicalListQuery('Failed to load inventory items', async () => {
    const supabase = createClient();
    return supabase
      .from('inventory_items')
      .select(INVENTORY_SELECT)
      .is('deleted_at', null)
      .order('item_name');
  }).then((result) => ({
    data: (result.data as unknown as InventoryItemRow[]).map(mapInventoryItem),
    error: result.error,
  }));
}

export async function fetchInventoryModuleSummary(): Promise<ClinicalResult<InventoryModuleSummary>> {
  try {
    const supabase = createClient();
    const itemsRes = await supabase
      .from('inventory_items')
      .select('quantity, minimum_stock, expiry_date, status')
      .is('deleted_at', null);

    const safeCount = async (
      table: 'inventory_lot_usage' | 'inventory_reagent_lot_comparisons' | 'qc_lot_verification_studies',
    ): Promise<number> => {
      try {
        if (table === 'inventory_lot_usage') {
          const { count, error } = await supabase
            .from(table)
            .select('id', { count: 'exact', head: true })
            .eq('status', 'active');
          return error ? 0 : count ?? 0;
        }
        if (table === 'qc_lot_verification_studies') {
          const { count, error } = await supabase
            .from(table)
            .select('id', { count: 'exact', head: true })
            .is('deleted_at', null)
            .in('status', ['draft', 'runs_completed', 'pending_review', 'pending_approval']);
          return error ? 0 : count ?? 0;
        }
        const { count, error } = await supabase
          .from(table)
          .select('id', { count: 'exact', head: true })
          .is('deleted_at', null)
          .in('status', ['draft', 'submitted', 'pending_review', 'pending_approval']);
        return error ? 0 : count ?? 0;
      } catch {
        return 0;
      }
    };

    const [activeLots, pendingReagentStudies, pendingQcStudies] = await Promise.all([
      safeCount('inventory_lot_usage'),
      safeCount('inventory_reagent_lot_comparisons'),
      safeCount('qc_lot_verification_studies'),
    ]);

    const rawItems = itemsRes.data ?? [];
    let lowStock = 0;
    let expiringSoon = 0;
    let expired = 0;
    let outOfStock = 0;
    for (const row of rawItems) {
      const item = {
        quantity: Number(row.quantity ?? 0),
        minimumStock: Number(row.minimum_stock ?? 0),
        expiryDate: (row.expiry_date as string | null) ?? undefined,
        status: row.status as InventoryItem['status'],
      };
      const display = deriveStoreDisplayStatus(item);
      if (display === 'low_stock') lowStock += 1;
      if (display === 'expiring_soon') expiringSoon += 1;
      if (display === 'expired') expired += 1;
      if (display === 'out_of_stock') outOfStock += 1;
    }

    return {
      data: {
        totalItems: rawItems.length,
        lowStock,
        expiringSoon,
        expired,
        outOfStock,
        activeLots,
        pendingReagentStudies,
        pendingQcStudies,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to load inventory summary',
    };
  }
}

export async function createInventoryItem(
  staff: StaffContext,
  form: InventoryFormData,
): Promise<ClinicalResult<InventoryItem>> {
  const result = await runClinicalMutation('Failed to create inventory item', async () => {
    const supabase = createClient();
    return supabase
      .from('inventory_items')
      .insert(formToInsertRow(form, staff.userId))
      .select(INVENTORY_SELECT)
      .single();
  });
  if (result.data) {
    const item = mapInventoryItem(result.data as unknown as InventoryItemRow);
    await logInventoryAudit(staff, {
      entityType: 'inventory_item',
      entityId: item.id,
      inventoryItemId: item.id,
      lotNumber: item.lotNumber,
      action: 'STOCK_RECEIVED',
      comment: 'Item created in store',
    });
    return { data: item, error: null };
  }
  return { data: null, error: result.error };
}

export async function updateInventoryItem(
  staff: StaffContext,
  id: string,
  form: InventoryFormData,
): Promise<ClinicalResult<InventoryItem>> {
  const status = deriveInventoryStatus(form.quantity, form.minimumStock, form.expiryDate || undefined);
  const result = await runClinicalMutation('Failed to update inventory item', async () => {
    const supabase = createClient();
    return supabase
      .from('inventory_items')
      .update({
        item_name: form.itemName.trim(),
        item_code: form.itemCode?.trim() || null,
        category: form.category,
        manufacturer: form.manufacturer?.trim() || null,
        catalog_number: form.catalogNumber?.trim() || null,
        lot_number: form.lotNumber?.trim() || null,
        quantity: form.quantity,
        unit: form.unit.trim(),
        minimum_stock: form.minimumStock,
        maximum_stock: form.maximumStock,
        reorder_level: form.reorderLevel ?? null,
        storage_location: form.storageLocation.trim(),
        supplier: form.supplier?.trim() || null,
        received_date: form.receivedDate || null,
        expiry_date: form.expiryDate || null,
        notes: form.notes?.trim() || null,
        status,
        updated_by: staff.userId,
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select(INVENTORY_SELECT)
      .single();
  });
  if (result.data) {
    await logInventoryAudit(staff, {
      entityType: 'inventory_item',
      entityId: id,
      inventoryItemId: id,
      action: 'ITEM_UPDATED',
    });
    return { data: mapInventoryItem(result.data as unknown as InventoryItemRow), error: null };
  }
  return { data: null, error: result.error };
}

export async function adjustInventoryQuantity(
  staff: StaffContext,
  id: string,
  quantityChange: number,
  reason?: string,
): Promise<ClinicalResult<InventoryItem>> {
  const current = await fetchInventoryItems();
  const item = current.data.find((i) => i.id === id);
  if (!item) return { data: null, error: 'Item not found' };

  const newQty = Math.max(0, item.quantity + quantityChange);
  const status = deriveInventoryStatus(newQty, item.minimumStock, item.expiryDate);
  const result = await runClinicalMutation('Failed to adjust quantity', async () => {
    const supabase = createClient();
    await supabase.from('inventory_transactions').insert({
      item_id: id,
      transaction_type: quantityChange >= 0 ? 'receive' : 'issue',
      quantity_change: quantityChange,
      quantity_before: item.quantity,
      quantity_after: newQty,
      reason: reason ?? null,
      performed_by: staff.userId,
    });
    return supabase
      .from('inventory_items')
      .update({ quantity: newQty, status, updated_by: staff.userId })
      .eq('id', id)
      .select(INVENTORY_SELECT)
      .single();
  });
  if (result.data) {
    await logInventoryAudit(staff, {
      entityType: 'inventory_item',
      entityId: id,
      inventoryItemId: id,
      lotNumber: item.lotNumber,
      action: 'QUANTITY_ADJUSTED',
      comment: reason,
      metadata: { quantityChange, newQty },
    });
    return { data: mapInventoryItem(result.data as unknown as InventoryItemRow), error: null };
  }
  return { data: null, error: result.error };
}

export async function setInventoryItemStatus(
  staff: StaffContext,
  id: string,
  status: InventoryItem['status'],
  reason?: string,
): Promise<ClinicalResult<InventoryItem>> {
  const result = await runClinicalMutation('Failed to update item status', async () => {
    const supabase = createClient();
    return supabase
      .from('inventory_items')
      .update({ status, updated_by: staff.userId })
      .eq('id', id)
      .select(INVENTORY_SELECT)
      .single();
  });
  if (result.data) {
    await logInventoryAudit(staff, {
      entityType: 'inventory_item',
      entityId: id,
      inventoryItemId: id,
      action: status === 'quarantined' ? 'ITEM_QUARANTINED' : 'ITEM_STATUS_CHANGED',
      comment: reason,
      metadata: { status },
    });
    return { data: mapInventoryItem(result.data as unknown as InventoryItemRow), error: null };
  }
  return { data: null, error: result.error };
}

export async function softDeleteInventoryItem(
  staff: StaffContext,
  id: string,
): Promise<{ error: string | null }> {
  const result = await runClinicalMutation('Failed to delete inventory item', async () => {
    const supabase = createClient();
    return supabase
      .from('inventory_items')
      .update({ deleted_at: new Date().toISOString(), status: 'inactive', updated_by: staff.userId })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .single();
  });
  if (!result.error) {
    await logInventoryAudit(staff, {
      entityType: 'inventory_item',
      entityId: id,
      inventoryItemId: id,
      action: 'ITEM_DEACTIVATED',
    });
  }
  return { error: result.error };
}
