'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { QcLotConfirmDialog } from '@/components/inventory/qc-lot-confirm-dialog';
import { StatusChip } from '@/components/ui/status-chip';
import { Button } from '@/components/ui/button';
import { closeLotUsage, fetchLotUsageRecords } from '@/lib/clinical/inventory-lot-usage';
import { LOT_USAGE_STATUS_LABELS } from '@/lib/inventory/constants';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import { useAuth } from '@/components/providers/auth-provider';
import { formatDate } from '@/lib/utils';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import type { InventoryLotUsage } from '@/types/inventory-module';
import type { InventoryItem } from '@/types';

function lotUsageToItem(record: InventoryLotUsage): InventoryItem {
  return {
    id: record.inventoryItemId,
    itemName: record.itemNameSnapshot,
    category: record.categorySnapshot,
    lotNumber: record.lotNumberSnapshot,
    quantity: record.quantityRemaining ?? 0,
    unit: '',
    minimumStock: 0,
    maximumStock: 0,
    storageLocation: '',
    status: 'available',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export default function LotInUsePage() {
  const locale = useLocale();
  const { can, user } = useAuth();
  const canManage = can('inventory.manage');
  const [records, setRecords] = useState<InventoryLotUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmRecord, setConfirmRecord] = useState<InventoryLotUsage | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchLotUsageRecords();
    setRecords(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const closeLot = async (id: string) => {
    if (!user || !canManage) return;
    const staff = await resolveStaffContext(user);
    const res = await closeLotUsage(staff, id);
    if (res.error) toast.error(res.error);
    else {
      toast.success('Lot closed');
      void load();
    }
  };

  const isQcMaterial = (record: InventoryLotUsage) =>
    record.categorySnapshot === 'qc_materials' || record.categorySnapshot === 'controls';

  const columns: ColumnDef<InventoryLotUsage>[] = [
    { accessorKey: 'itemNameSnapshot', header: 'Material' },
    { accessorKey: 'lotNumberSnapshot', header: 'Lot' },
    { accessorKey: 'categorySnapshot', header: 'Category' },
    { accessorKey: 'instrumentNameSnapshot', header: 'Instrument', cell: ({ row }) => row.original.instrumentNameSnapshot ?? '—' },
    { accessorKey: 'testParameter', header: 'Test/Level', cell: ({ row }) => row.original.testParameter ?? '—' },
    { accessorKey: 'startDate', header: 'Start', cell: ({ row }) => row.original.startDate ? formatDate(row.original.startDate, locale) : '—' },
    { accessorKey: 'expiryDate', header: 'Expiry', cell: ({ row }) => row.original.expiryDate ? formatDate(row.original.expiryDate, locale) : '—' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusChip
          variant={row.original.status === 'active' ? 'success' : row.original.status === 'expired' ? 'danger' : 'neutral'}
          label={LOT_USAGE_STATUS_LABELS[row.original.status] ?? row.original.status}
        />
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {canManage && isQcMaterial(row.original) && user && (
            <Button size="sm" variant="outline" onClick={() => setConfirmRecord(row.original)}>Using This Lot?</Button>
          )}
          {canManage && row.original.status === 'active' && (
            <Button size="sm" variant="outline" onClick={() => void closeLot(row.original.id)}>Close</Button>
          )}
        </div>
      ),
    },
  ];

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (records.length === 0) {
    return <EmptyState title="No active lots configured" description="Activate a lot from Store or after approved verification." />;
  }

  return (
    <>
      <DataTable data={records} columns={columns} searchKey="itemNameSnapshot" searchPlaceholder="Search active lots…" />
      {confirmRecord && user && (
        <QcLotConfirmDialog
          open={Boolean(confirmRecord)}
          onOpenChange={(o) => !o && setConfirmRecord(null)}
          expectedItem={lotUsageToItem(confirmRecord)}
          instrumentId={confirmRecord.instrumentId}
          instrumentName={confirmRecord.instrumentNameSnapshot}
          user={user}
          onContinue={() => setConfirmRecord(null)}
        />
      )}
    </>
  );
}
