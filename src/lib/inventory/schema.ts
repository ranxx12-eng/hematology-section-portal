import { z } from 'zod';
import type { InventoryItem } from '@/types';

export const INVENTORY_CATEGORIES = ['reagents', 'controls', 'calibrators', 'consumables', 'ppe'] as const;

export const inventoryFormSchema = z.object({
  itemName: z.string().min(1, 'Item name is required'),
  category: z.string().min(1, 'Category is required'),
  quantity: z.coerce.number().min(0, 'Quantity must be 0 or greater'),
  unit: z.string().min(1, 'Unit is required'),
  minimumStock: z.coerce.number().min(0, 'Minimum stock must be 0 or greater'),
  maximumStock: z.coerce.number().min(0).default(50),
  storageLocation: z.string().min(1, 'Storage location is required'),
  expiryDate: z.string().optional(),
});

export type InventoryFormData = z.infer<typeof inventoryFormSchema>;

export function emptyInventoryForm(): InventoryFormData {
  return {
    itemName: '',
    category: 'reagents',
    quantity: 10,
    unit: 'box',
    minimumStock: 5,
    maximumStock: 50,
    storageLocation: '',
    expiryDate: '',
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
