export type StoreDisplayStatus =
  | 'available'
  | 'low_stock'
  | 'out_of_stock'
  | 'expiring_soon'
  | 'expired'
  | 'quarantined'
  | 'inactive';

export type LotUsageStatus =
  | 'active'
  | 'due_to_expire'
  | 'expired'
  | 'replacement_pending'
  | 'closed'
  | 'superseded';

export type LotStudyStatus =
  | 'draft'
  | 'submitted'
  | 'pending_review'
  | 'pending_approval'
  | 'approved'
  | 'returned'
  | 'rejected';

export type LotInterpretation =
  | 'incomplete'
  | 'criteria_not_configured'
  | 'acceptable'
  | 'not_acceptable'
  | 'manual_review';

export interface InventoryLotUsage {
  id: string;
  inventoryItemId: string;
  itemNameSnapshot: string;
  categorySnapshot: string;
  lotNumberSnapshot: string;
  manufacturerSnapshot?: string;
  contextKey: string;
  instrumentId?: string;
  instrumentNameSnapshot?: string;
  testParameter?: string;
  methodName?: string;
  startDate?: string;
  openDate?: string;
  expiryDate?: string;
  openVialExpiryDate?: string;
  quantityRemaining?: number;
  status: LotUsageStatus;
  startedByName?: string;
  startedByStaffId?: string;
  reagentComparisonId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReagentLotComparison {
  id: string;
  studyNumber: string;
  status: LotStudyStatus;
  instrumentId?: string;
  instrumentNameSnapshot?: string;
  reagentName: string;
  testParameter?: string;
  oldLotNumber: string;
  newLotNumber: string;
  oldStoreItemId?: string;
  newStoreItemId?: string;
  studyDate?: string;
  acceptanceCriteriaConfigured: boolean;
  conclusion?: string;
  comments?: string;
  preparedByName?: string;
  reviewedByName?: string;
  approvedByName?: string;
  activatedAt?: string;
  results: ReagentLotComparisonResult[];
  createdAt: string;
}

export interface ReagentLotComparisonResult {
  id: string;
  comparisonId: string;
  sampleNumber: number;
  oldResult?: number;
  newResult?: number;
  differenceUnits?: number;
  differencePercent?: number;
  acceptanceCriterionText?: string;
  interpretation: LotInterpretation;
  comment?: string;
}

export interface InventoryAuditEvent {
  id: string;
  entityType: string;
  entityId: string;
  inventoryItemId?: string;
  lotNumber?: string;
  action: string;
  userName?: string;
  comment?: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface InventoryModuleSummary {
  totalItems: number;
  lowStock: number;
  expiringSoon: number;
  expired: number;
  outOfStock: number;
  activeLots: number;
  pendingReagentStudies: number;
  pendingQcStudies: number;
}
