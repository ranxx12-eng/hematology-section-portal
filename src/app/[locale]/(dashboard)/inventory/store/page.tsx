'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { History, Loader2, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { LotHistoryDrawer } from '@/components/inventory/lot-history-drawer';
import { ActivateLotDialog } from '@/components/inventory/activate-lot-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusChip } from '@/components/ui/status-chip';
import { useAuth } from '@/components/providers/auth-provider';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import {
  adjustInventoryQuantity,
  createInventoryItem,
  fetchInventoryItems,
  setInventoryItemStatus,
  softDeleteInventoryItem,
  updateInventoryItem,
} from '@/lib/clinical/inventory';
import {
  deriveStoreDisplayStatus,
  STORE_CATEGORIES,
  STORE_STATUS_LABELS,
  storeStatusChipVariant,
} from '@/lib/inventory/constants';
import {
  emptyInventoryForm,
  inventoryFormSchema,
  inventoryItemToForm,
  type InventoryFormData,
} from '@/lib/inventory/schema';
import { formatDate } from '@/lib/utils';
import type { InventoryItem } from '@/types';
import type { StoreDisplayStatus } from '@/types/inventory-module';

function StoreItemForm({
  form,
  setForm,
  onSave,
  saving,
  saveLabel,
}: {
  form: InventoryFormData;
  setForm: React.Dispatch<React.SetStateAction<InventoryFormData>>;
  onSave: () => void;
  saving: boolean;
  saveLabel: string;
}) {
  const tc = useTranslations('common');
  return (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
      <div><Label>Item Name</Label><Input value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Item Code</Label><Input value={form.itemCode} onChange={(e) => setForm({ ...form, itemCode: e.target.value })} /></div>
        <div><Label>Lot Number</Label><Input value={form.lotNumber} onChange={(e) => setForm({ ...form, lotNumber: e.target.value })} /></div>
      </div>
      <div><Label>Category</Label>
        <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{STORE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Manufacturer</Label><Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></div>
        <div><Label>Supplier</Label><Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Quantity</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
        <div><Label>Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Min Stock</Label><Input type="number" value={form.minimumStock} onChange={(e) => setForm({ ...form, minimumStock: Number(e.target.value) })} /></div>
        <div><Label>Reorder Level</Label><Input type="number" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) })} /></div>
      </div>
      <div><Label>Storage Location</Label><Input value={form.storageLocation} onChange={(e) => setForm({ ...form, storageLocation: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Received Date</Label><Input type="date" value={form.receivedDate} onChange={(e) => setForm({ ...form, receivedDate: e.target.value })} /></div>
        <div><Label>Expiry Date</Label><Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /></div>
      </div>
      <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
      <Button onClick={onSave} className="w-full" disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saveLabel || tc('save')}
      </Button>
    </div>
  );
}

export default function InventoryStorePage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can, user } = useAuth();
  const canManage = can('inventory.manage');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<InventoryFormData>(() => emptyInventoryForm());
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('');
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [activateItem, setActivateItem] = useState<InventoryItem | null>(null);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustDelta, setAdjustDelta] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    const result = await fetchInventoryItems();
    setItems(result.data);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => { void loadItems(); }, [loadItems]);

  const enriched = useMemo(() => items.map((item) => ({
    ...item,
    displayStatus: deriveStoreDisplayStatus(item),
  })), [items]);

  const filtered = useMemo(() => enriched.filter((item) => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && item.displayStatus !== statusFilter) return false;
    if (locationFilter && !item.storageLocation.toLowerCase().includes(locationFilter.toLowerCase())) return false;
    return true;
  }), [enriched, categoryFilter, statusFilter, locationFilter]);

  const storeStats = useMemo(() => ({
    total: enriched.length,
    lowStock: enriched.filter((i) => i.displayStatus === 'low_stock').length,
    expiringSoon: enriched.filter((i) => i.displayStatus === 'expiring_soon').length,
    expired: enriched.filter((i) => i.displayStatus === 'expired').length,
    outOfStock: enriched.filter((i) => i.displayStatus === 'out_of_stock').length,
  }), [enriched]);

  const saveItem = async () => {
    if (!canManage || !user) return;
    const parsed = inventoryFormSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid form');
      return;
    }
    setSaving(true);
    const staff = await resolveStaffContext(user);
    const result = editItem
      ? await updateInventoryItem(staff, editItem.id, parsed.data)
      : await createInventoryItem(staff, parsed.data);
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to save');
      return;
    }
    setDialogOpen(false);
    setEditItem(null);
    setForm(emptyInventoryForm());
    toast.success(editItem ? 'Item updated' : 'Item added');
    void loadItems();
  };

  const deleteItem = async (id: string) => {
    if (!canManage || !user || !confirm(tc('confirmDelete'))) return;
    const staff = await resolveStaffContext(user);
    const result = await softDeleteInventoryItem(staff, id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Item retired');
    void loadItems();
  };

  const quarantineItem = async (item: InventoryItem) => {
    if (!canManage || !user) return;
    const staff = await resolveStaffContext(user);
    const result = await setInventoryItemStatus(staff, item.id, 'quarantined', 'Marked quarantined from Store');
    if (result.error) toast.error(result.error);
    else {
      toast.success('Item quarantined');
      void loadItems();
    }
  };

  const adjustQuantity = async () => {
    if (!canManage || !user || !adjustItem) return;
    const delta = Number(adjustDelta);
    if (!Number.isFinite(delta) || delta === 0) {
      toast.error('Enter a non-zero quantity change');
      return;
    }
    const staff = await resolveStaffContext(user);
    const result = await adjustInventoryQuantity(staff, adjustItem.id, delta, adjustReason || undefined);
    if (result.error) toast.error(result.error);
    else {
      toast.success(delta > 0 ? 'Stock received' : 'Quantity adjusted');
      setAdjustItem(null);
      setAdjustDelta('');
      setAdjustReason('');
      void loadItems();
    }
  };

  const columns: ColumnDef<InventoryItem & { displayStatus: StoreDisplayStatus }>[] = useMemo(() => [
    { accessorKey: 'itemName', header: 'Item' },
    { accessorKey: 'lotNumber', header: 'Lot', cell: ({ row }) => row.original.lotNumber ?? '—' },
    { accessorKey: 'category', header: 'Category' },
    { accessorKey: 'quantity', header: 'Qty', cell: ({ row }) => `${row.original.quantity} ${row.original.unit}` },
    { accessorKey: 'storageLocation', header: 'Location' },
    { accessorKey: 'expiryDate', header: 'Expiry', cell: ({ row }) => row.original.expiryDate ? formatDate(row.original.expiryDate, locale) : '—' },
    {
      accessorKey: 'displayStatus',
      header: tc('status'),
      cell: ({ row }) => (
        <StatusChip
          variant={storeStatusChipVariant(row.original.displayStatus)}
          label={STORE_STATUS_LABELS[row.original.displayStatus]}
        />
      ),
    },
    {
      id: 'actions',
      header: tc('actions'),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="ghost" onClick={() => setHistoryItem(row.original)}><History className="h-4 w-4" /></Button>
          {canManage && (
            <>
              <Button size="sm" variant="outline" onClick={() => { setEditItem(row.original); setForm(inventoryItemToForm(row.original)); setDialogOpen(true); }}>Edit</Button>
              <Button size="sm" variant="outline" onClick={() => { setAdjustItem(row.original); setAdjustDelta(''); setAdjustReason(''); }}>Adjust Qty</Button>
              <Button size="sm" variant="outline" onClick={() => setActivateItem(row.original)}>Set Lot in Use</Button>
              <Button size="sm" variant="outline" asChild>
                <Link href={
                  row.original.category === 'qc_materials' || row.original.category === 'controls'
                    ? `/${locale}/inventory/qc-lot-verification?start=${row.original.id}`
                    : `/${locale}/inventory/lot-to-lot-reagents?newItem=${row.original.id}`
                }>
                  {row.original.category === 'qc_materials' || row.original.category === 'controls' ? 'QC Verification' : 'Lot-to-Lot'}
                </Link>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void quarantineItem(row.original)}><ShieldAlert className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => void deleteItem(row.original.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
            </>
          )}
        </div>
      ),
    },
  ], [canManage, locale, tc]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        {[
          ['Total Items', storeStats.total],
          ['Low Stock', storeStats.lowStock],
          ['Expiring Soon', storeStats.expiringSoon],
          ['Expired', storeStats.expired],
          ['Out of Stock', storeStats.outOfStock],
        ].map(([label, value]) => (
          <Card key={label as string} className="rounded-2xl">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Category</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {STORE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {Object.entries(STORE_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Location</Label>
          <Input className="h-9 w-40" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} placeholder="Filter location" />
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditItem(null); setForm(emptyInventoryForm()); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 me-2" />Add Item</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editItem ? 'Edit Item' : 'Add Store Item'}</DialogTitle></DialogHeader>
              <StoreItemForm form={form} setForm={setForm} onSave={() => void saveItem()} saving={saving} saveLabel={editItem ? 'Update' : 'Add'} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <EmptyState title="Failed to load store" description={error} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No store items" description="Add stock items to begin tracking inventory." />
      ) : (
        <DataTable data={filtered} columns={columns} searchKey="itemName" searchPlaceholder="Search items, lots, codes…" />
      )}

      <LotHistoryDrawer
        open={Boolean(historyItem)}
        onOpenChange={(o) => !o && setHistoryItem(null)}
        itemId={historyItem?.id}
        lotNumber={historyItem?.lotNumber}
        title={historyItem ? `${historyItem.itemName} · Lot ${historyItem.lotNumber ?? '—'}` : undefined}
      />

      {activateItem && user && (
        <ActivateLotDialog
          open={Boolean(activateItem)}
          onOpenChange={(o) => !o && setActivateItem(null)}
          item={activateItem}
          user={user}
          onComplete={() => { setActivateItem(null); void loadItems(); }}
        />
      )}

      <Dialog open={Boolean(adjustItem)} onOpenChange={(o) => !o && setAdjustItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{adjustItem ? `Adjust Quantity · ${adjustItem.itemName}` : 'Adjust Quantity'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Current: {adjustItem?.quantity} {adjustItem?.unit}. Use positive values to receive stock, negative to issue.</p>
            <div><Label>Quantity change</Label><Input type="number" value={adjustDelta} onChange={(e) => setAdjustDelta(e.target.value)} /></div>
            <div><Label>Reason (optional)</Label><Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} /></div>
            <Button className="w-full" onClick={() => void adjustQuantity()}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
