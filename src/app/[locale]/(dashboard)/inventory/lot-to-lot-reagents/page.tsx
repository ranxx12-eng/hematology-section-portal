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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createReagentLotComparison, fetchReagentLotComparisons } from '@/lib/clinical/inventory-reagent-lot';
import { fetchInventoryItems } from '@/lib/clinical/inventory';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import { useAuth } from '@/components/providers/auth-provider';
import { LOT_STUDY_STATUS_LABELS } from '@/lib/inventory/constants';
import { toast } from 'sonner';
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
  const [form, setForm] = useState({ reagentName: '', testParameter: '', oldLot: '', newLot: '', oldItemId: '', newItemId: '' });

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
    if (!newItemId || items.length === 0) return;
    const item = items.find((i) => i.id === newItemId);
    if (!item) return;
    setForm({
      reagentName: item.itemName,
      testParameter: '',
      oldLot: '',
      newLot: item.lotNumber ?? '',
      oldItemId: '',
      newItemId: item.id,
    });
    setOpen(true);
  }, [searchParams, items]);

  const createStudy = async () => {
    if (!user) return;
    const staff = await resolveStaffContext(user);
    const res = await createReagentLotComparison(staff, {
      reagentName: form.reagentName,
      testParameter: form.testParameter || undefined,
      oldLotNumber: form.oldLot,
      newLotNumber: form.newLot,
      oldStoreItemId: form.oldItemId || undefined,
      newStoreItemId: form.newItemId || undefined,
    });
    if (res.error || !res.data) {
      toast.error(res.error ?? 'Failed to create study');
      return;
    }
    toast.success('Reagent lot comparison created');
    setOpen(false);
    void load();
  };

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
      id: 'link',
      header: '',
      cell: ({ row }) => <Button size="sm" variant="outline" asChild><Link href={`/${locale}/inventory/lot-to-lot-reagents/${row.original.id}`}>Open</Link></Button>,
    },
  ];

  return (
    <div className="space-y-4">
      {canManage && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />New Reagent Lot Comparison</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Reagent Lot-to-Lot Study</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Reagent</Label><Input value={form.reagentName} onChange={(e) => setForm({ ...form, reagentName: e.target.value })} /></div>
              <div><Label>Test / Parameter</Label><Input value={form.testParameter} onChange={(e) => setForm({ ...form, testParameter: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Old Lot</Label><Input value={form.oldLot} onChange={(e) => setForm({ ...form, oldLot: e.target.value })} /></div>
                <div><Label>New Lot</Label><Input value={form.newLot} onChange={(e) => setForm({ ...form, newLot: e.target.value })} /></div>
              </div>
              <Button className="w-full" onClick={() => void createStudy()}>Create Draft</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : studies.length === 0 ? (
        <EmptyState title="No reagent lot comparisons yet" description="Create a study to compare old and new reagent lots before switching operational use." />
      ) : (
        <DataTable data={studies} columns={columns} searchKey="studyNumber" />
      )}
    </div>
  );
}
