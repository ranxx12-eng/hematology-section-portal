import { z } from 'zod';
import type { InventoryItem } from '@/types';
import { STORE_CATEGORIES } from '@/lib/inventory/constants';

export const INVENTORY_CATEGORIES = STORE_CATEGORIES;

export const inventoryFormSchema = z.object({
  itemName: z.string().min(1, 'Item name is required'),
  itemCode: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  manufacturer: z.string().optional(),
  catalogNumber: z.string().optional(),
  lotNumber: z.string().optional(),
  quantity: z.coerce.number().min(0, 'Quantity must be 0 or greater'),
  unit: z.string().min(1, 'Unit is required'),
  minimumStock: z.coerce.number().min(0, 'Minimum stock must be 0 or greater'),
  maximumStock: z.coerce.number().min(0).default(50),
  reorderLevel: z.coerce.number().min(0).optional(),
  storageLocation: z.string().min(1, 'Storage location is required'),
  supplier: z.string().optional(),
  receivedDate: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
});

export type InventoryFormData = z.infer<typeof inventoryFormSchema>;

export function emptyInventoryForm(): InventoryFormData {
  return {
    itemName: '',
    itemCode: '',
    category: 'reagents',
    manufacturer: '',
    catalogNumber: '',
    lotNumber: '',
    quantity: 10,
    unit: 'box',
    minimumStock: 5,
    maximumStock: 50,
    reorderLevel: 5,
    storageLocation: '',
    supplier: '',
    receivedDate: '',
    expiryDate: '',
    notes: '',
  };
}

export function inventoryItemToForm(item: InventoryItem): InventoryFormData {
  return {
    itemName: item.itemName,
    itemCode: item.itemCode ?? '',
    category: item.category,
    manufacturer: item.manufacturer ?? '',
    catalogNumber: item.catalogNumber ?? '',
    lotNumber: item.lotNumber ?? '',
    quantity: item.quantity,
    unit: item.unit,
    minimumStock: item.minimumStock,
    maximumStock: item.maximumStock,
    reorderLevel: item.reorderLevel ?? item.minimumStock,
    storageLocation: item.storageLocation,
    supplier: item.supplier ?? '',
    receivedDate: item.receivedDate ?? '',
    expiryDate: item.expiryDate ?? '',
    notes: item.notes ?? '',
  };
}

export function deriveInventoryStatus(
  quantity: number,
  minimumStock: number,
  expiryDate?: string,
): InventoryItem['status'] {
  if (expiryDate && new Date(expiryDate) < new Date()) return 'expired';
  if (quantity <= 0) return 'depleted';
  if (quantity <= minimumStock) return 'low_stock';
  return 'available';
}
