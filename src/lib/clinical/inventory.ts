import { createClient } from '@/lib/supabase/client';
import { deriveInventoryStatus, type InventoryFormData } from '@/lib/inventory/schema';
import type { InventoryItem } from '@/types';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface InventoryItemRow {
  id: string;
  item_name: string;
  category: string;
  manufacturer: string | null;
  catalog_number: string | null;
  lot_number: string | null;
  quantity: number;
  unit: string;
  minimum_stock: number;
  maximum_stock: number;
  expiry_date: string | null;
  storage_location: string;
  supplier: string | null;
  received_date: string | null;
  opened_date: string | null;
  status: InventoryItem['status'];
  barcode: string | null;
  created_at: string;
}

function mapInventoryItem(row: InventoryItemRow): InventoryItem {
  return {
    id: row.id,
    itemName: row.item_name,
    category: row.category,
    manufacturer: row.manufacturer ?? undefined,
    catalogNumber: row.catalog_number ?? undefined,
    lotNumber: row.lot_number ?? undefined,
    quantity: Number(row.quantity),
    unit: row.unit,
    minimumStock: Number(row.minimum_stock),
    maximumStock: Number(row.maximum_stock),
    expiryDate: row.expiry_date ?? undefined,
    storageLocation: row.storage_location,
    supplier: row.supplier ?? undefined,
    receivedDate: row.received_date ?? undefined,
    openedDate: row.opened_date ?? undefined,
    status: row.status,
    barcode: row.barcode ?? undefined,
    createdAt: row.created_at,
  };
}

function formToInsertRow(form: InventoryFormData, userId: string) {
  const status = deriveInventoryStatus(form.quantity, form.minimumStock, form.expiryDate || undefined);
  return {
    item_name: form.itemName.trim(),
    category: form.category,
    quantity: form.quantity,
    unit: form.unit.trim(),
    minimum_stock: form.minimumStock,
    maximum_stock: form.maximumStock,
    storage_location: form.storageLocation.trim(),
    expiry_date: form.expiryDate || null,
    status,
    created_by: userId,
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

export async function createInventoryItem(
  userId: string,
  form: InventoryFormData,
): Promise<ClinicalResult<InventoryItem>> {
  return runClinicalMutation('Failed to create inventory item', async () => {
    const supabase = createClient();
    return supabase
      .from('inventory_items')
      .insert(formToInsertRow(form, userId))
      .select(INVENTORY_SELECT)
      .single();
  }).then((result) => ({
    data: result.data ? mapInventoryItem(result.data as unknown as InventoryItemRow) : null,
    error: result.error,
  }));
}

export async function softDeleteInventoryItem(id: string): Promise<{ error: string | null }> {
  const result = await runClinicalMutation('Failed to delete inventory item', async () => {
    const supabase = createClient();
    return supabase
      .from('inventory_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .single();
  });
  return { error: result.error };
}
