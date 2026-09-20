'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Loader2, Plus } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/status-chip';
import { NewReagentLotStudyDialog } from '@/components/inventory/new-reagent-lot-study-dialog';
import { fetchReagentLotComparisons } from '@/lib/clinical/inventory-reagent-lot';
import { fetchInventoryItems } from '@/lib/clinical/inventory';
import { useAuth } from '@/components/providers/auth-provider';
import { LOT_STUDY_STATUS_LABELS } from '@/lib/inventory/constants';
import type { ReagentLotComparison } from '@/types/inventory-module';
import type { InventoryItem } from '@/types';

export default function ReagentLotComparisonListPage() {
  const locale = useLocale();
  const searchParams = useSearchParams();
  const { can, user } = useAuth();
  const canManage = can('inventory.manage');
  const [studies, setStudies] = useState<ReagentLotComparison[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [initialNewItemId, setInitialNewItemId] = useState<string | undefined>();

  const load = useCallback(async () => {
    setLoading(true);
    const [studiesRes, itemsRes] = await Promise.all([
      fetchReagentLotComparisons(),
      fetchInventoryItems(),
    ]);
    setStudies(studiesRes.data);
    setItems(itemsRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const newItemId = searchParams.get('newItem');
    if (!newItemId) return;
    setInitialNewItemId(newItemId);
    setOpen(true);
  }, [searchParams]);

  const columns: ColumnDef<ReagentLotComparison>[] = [
    { accessorKey: 'studyNumber', header: 'Study #' },
    { accessorKey: 'reagentName', header: 'Reagent' },
    { accessorKey: 'oldLotNumber', header: 'Old Lot' },
    { accessorKey: 'newLotNumber', header: 'New Lot' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusChip variant="info" label={LOT_STUDY_STATUS_LABELS[row.original.status] ?? row.original.status} />,
    },
    {
      id: 'form',
      header: 'Form',
      cell: ({ row }) => (
        row.original.schemaVersion === 2
          ? <StatusChip variant="success" label="Form-Hema-022" />
          : <StatusChip variant="neutral" label="Legacy" />
      ),
    },
    {
      id: 'link',
      header: '',
      cell: ({ row }) => <Button size="sm" variant="outline" asChild><Link href={`/${locale}/inventory/lot-to-lot-reagents/${row.original.id}`}>Open</Link></Button>,
    },
  ];

  return (
    <div className="space-y-4">
      {canManage && user && (
        <>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 me-2" />Start Lot-to-Lot
          </Button>
          <NewReagentLotStudyDialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) setInitialNewItemId(undefined);
            }}
            items={items}
            user={user}
            initialNewItemId={initialNewItemId}
          />
        </>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : studies.length === 0 ? (
        <EmptyState
          title="No reagent lot comparisons yet"
          description="Start a Form-Hema-022 lot-to-lot study from a mapped store reagent, or use Inventory Store → Start Lot-to-Lot."
        />
      ) : (
        <DataTable data={studies} columns={columns} searchKey="studyNumber" />
      )}
    </div>
  );
}
