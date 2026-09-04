import type { InventoryItem } from '@/types';
import type { LotInterpretation, StoreDisplayStatus } from '@/types/inventory-module';

export const INVENTORY_MODULE_SUBTITLE =
  'Manage stock, active lots, reagent lot verification, and QC lot verification.';

export const EXPIRY_WARNING_DAYS = 30;

export const STORE_CATEGORIES = [
  'reagents',
  'qc_materials',
  'controls',
  'kits',
  'consumables',
  'stains',
  'manual_test_materials',
  'calibrators',
  'ppe',
  'other',
] as const;

export const STORE_STATUS_LABELS: Record<StoreDisplayStatus, string> = {
  available: 'Available',
  low_stock: 'Low Stock',
  out_of_stock: 'Out of Stock',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
  quarantined: 'Quarantined',
  inactive: 'Inactive',
};

export const LOT_USAGE_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  due_to_expire: 'Due to Expire',
  expired: 'Expired',
  replacement_pending: 'Replacement Pending',
  closed: 'Closed',
  superseded: 'Superseded',
};

export const LOT_STUDY_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  pending_review: 'Pending Review',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  returned: 'Returned',
  rejected: 'Rejected',
};

export const LOT_INTERPRETATION_LABELS: Record<LotInterpretation, string> = {
  incomplete: 'Incomplete',
  criteria_not_configured: 'Acceptance Criteria Not Configured',
  acceptable: 'Acceptable',
  not_acceptable: 'Not Acceptable',
  manual_review: 'Manual Review',
};

export const INVENTORY_TABS = [
  { id: 'store', href: '/inventory/store', label: 'Store' },
  { id: 'lot-in-use', href: '/inventory/lot-in-use', label: 'Lot in Use' },
  { id: 'lot-to-lot-reagents', href: '/inventory/lot-to-lot-reagents', label: 'Lot-to-Lot Reagents' },
  { id: 'qc-lot-verification', href: '/inventory/qc-lot-verification', label: 'QC Lot Verification' },
] as const;

export function buildLotContextKey(input: {
  instrumentId?: string;
  testParameter?: string;
  category?: string;
  kind: 'reagent' | 'qc';
  qcLevel?: string;
}): string {
  const parts = [
    `kind:${input.kind}`,
    input.instrumentId ? `instrument:${input.instrumentId}` : 'instrument:none',
    input.category ? `category:${input.category}` : '',
    input.testParameter ? `param:${input.testParameter}` : '',
    input.qcLevel ? `level:${input.qcLevel}` : '',
  ].filter(Boolean);
  return parts.join('|');
}

export function deriveStoreDisplayStatus(
  item: Pick<InventoryItem, 'quantity' | 'minimumStock' | 'expiryDate' | 'status'>,
  now = new Date(),
): StoreDisplayStatus {
  if (item.status === 'quarantined') return 'quarantined';
  if (item.status === 'inactive') return 'inactive';
  if (item.status === 'expired') return 'expired';
  if (item.expiryDate) {
    const expiry = new Date(item.expiryDate);
    if (expiry < now) return 'expired';
    const warn = new Date(now);
    warn.setDate(warn.getDate() + EXPIRY_WARNING_DAYS);
    if (expiry <= warn) return 'expiring_soon';
  }
  if (item.quantity <= 0 || item.status === 'depleted') return 'out_of_stock';
  if (item.quantity <= item.minimumStock || item.status === 'low_stock') return 'low_stock';
  return 'available';
}

export function deriveReagentResultInterpretation(
  acceptanceConfigured: boolean,
  oldResult?: number | null,
  newResult?: number | null,
): LotInterpretation {
  if (!acceptanceConfigured) return 'criteria_not_configured';
  if (oldResult == null || newResult == null) return 'incomplete';
  return 'manual_review';
}

export function computeDifference(oldVal?: number | null, newVal?: number | null): {
  differenceUnits?: number;
  differencePercent?: number;
} {
  if (oldVal == null || newVal == null) return {};
  const differenceUnits = newVal - oldVal;
  const differencePercent = oldVal === 0 ? undefined : (Math.abs(differenceUnits) / Math.abs(oldVal)) * 100;
  return { differenceUnits, differencePercent };
}

export function storeStatusChipVariant(status: StoreDisplayStatus): 'success' | 'danger' | 'warning' | 'info' | 'neutral' {
  switch (status) {
    case 'available':
      return 'success';
    case 'low_stock':
    case 'expiring_soon':
      return 'warning';
    case 'out_of_stock':
    case 'expired':
      return 'danger';
    case 'quarantined':
      return 'info';
    default:
      return 'neutral';
  }
}
