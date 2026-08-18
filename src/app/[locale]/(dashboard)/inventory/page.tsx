'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { statusBadgeVariant } from '@/lib/page-utils';
import { formatDate } from '@/lib/utils';
import {
  createInventoryItem,
  fetchInventoryItems,
  softDeleteInventoryItem,
} from '@/lib/clinical/inventory';
import {
  emptyInventoryForm,
  INVENTORY_CATEGORIES,
  inventoryFormSchema,
  type InventoryFormData,
} from '@/lib/inventory/schema';
import type { InventoryItem } from '@/types';

export default function InventoryPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can, user } = useAuth();
  const canManage = can('inventory.manage');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<InventoryFormData>(() => emptyInventoryForm());

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchInventoryItems();
    setItems(result.data);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const accessDenied = !can('inventory.view');

  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  if (accessDenied) return null;

  const lowStockItems = useMemo(
    () => items.filter((i) => i.quantity <= i.minimumStock || i.status === 'low_stock'),
    [items],
  );
  const expiredItems = useMemo(() => items.filter((i) => i.status === 'expired'), [items]);

  const addItem = async () => {
    if (!canManage || !user) return;
    const parsed = inventoryFormSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid form');
      return;
    }
    setSaving(true);
    const result = await createInventoryItem(user.id, parsed.data);
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to add item');
      return;
    }
    setDialogOpen(false);
    setForm(emptyInventoryForm());
    toast.success('Inventory item added');
    void loadItems();
  };

  const deleteItem = async (id: string) => {
    if (!canManage || !confirm(tc('confirmDelete'))) return;
    const result = await softDeleteInventoryItem(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Item deleted');
    void loadItems();
  };

  const columns: ColumnDef<InventoryItem>[] = useMemo(() => [
    { accessorKey: 'itemName', header: 'Item' },
    { accessorKey: 'category', header: 'Category', cell: ({ row }) => <Badge variant="outline">{row.original.category}</Badge> },
    { accessorKey: 'quantity', header: 'Qty', cell: ({ row }) => (
      <span className={row.original.quantity <= row.original.minimumStock ? 'text-red-600 font-semibold' : ''}>
        {row.original.quantity} {row.original.unit}
      </span>
    )},
    { accessorKey: 'minimumStock', header: 'Min Stock' },
    { accessorKey: 'storageLocation', header: 'Location' },
    { accessorKey: 'expiryDate', header: 'Expiry', cell: ({ row }) => row.original.expiryDate ? formatDate(row.original.expiryDate, locale) : '—' },
    { accessorKey: 'status', header: tc('status'), cell: ({ row }) => <Badge variant={statusBadgeVariant(row.original.status)}>{row.original.status.replace('_', ' ')}</Badge> },
    {
      id: 'actions', header: tc('actions'),
      cell: ({ row }) => canManage ? (
        <Button size="sm" variant="ghost" onClick={() => deleteItem(row.original.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
      ) : null,
    },
  ], [canManage, locale, tc]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tc('inventory')}</h1>
          <p className="text-muted-foreground">{items.length} items tracked</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{tc('add')}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{tc('add')} Inventory Item</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Item Name</Label><Input value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} /></div>
                <div><Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{INVENTORY_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Quantity</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
                  <div><Label>Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
                </div>
                <div><Label>Min Stock</Label><Input type="number" value={form.minimumStock} onChange={(e) => setForm({ ...form, minimumStock: Number(e.target.value) })} /></div>
                <div><Label>Storage Location</Label><Input value={form.storageLocation} onChange={(e) => setForm({ ...form, storageLocation: e.target.value })} /></div>
                <Button onClick={addItem} className="w-full" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tc('save')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {(lowStockItems.length > 0 || expiredItems.length > 0) && (
        <div className="space-y-2">
          {lowStockItems.length > 0 && (
            <Card className="border-amber-500 bg-amber-50/50 dark:bg-amber-900/10">
              <CardContent className="flex items-center gap-2 py-3 text-sm text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" />
                {lowStockItems.length} item(s) below minimum stock: {lowStockItems.map((i) => i.itemName).join(', ')}
              </CardContent>
            </Card>
          )}
          {expiredItems.length > 0 && (
            <Card className="border-red-500 bg-red-50/50 dark:bg-red-900/10">
              <CardContent className="flex items-center gap-2 py-3 text-sm text-red-800 dark:text-red-300">
                <AlertTriangle className="h-4 w-4" />
                {expiredItems.length} expired item(s): {expiredItems.map((i) => i.itemName).join(', ')}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <EmptyState title="Failed to load inventory" description={error} />
      ) : items.length === 0 ? (
        <EmptyState title={tc('noData')} description="No inventory items yet." />
      ) : (
        <DataTable data={items} columns={columns} searchKey="itemName" searchPlaceholder="Search inventory..." />
      )}
    </div>
  );
}
