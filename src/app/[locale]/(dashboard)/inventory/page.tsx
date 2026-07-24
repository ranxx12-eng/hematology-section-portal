'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { appendAuditLog, statusBadgeVariant } from '@/lib/page-utils';
import { formatDate, generateId } from '@/lib/utils';
import type { InventoryItem } from '@/types';

export default function InventoryPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const canManage = can('inventory.manage');
  const [db, setDb] = useState(() => getMockDatabase());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ itemName: '', category: 'reagents', quantity: '10', unit: 'box', minimumStock: '5', storageLocation: '' });
  const refresh = useCallback(() => setDb(getMockDatabase()), []);

  if (!can('inventory.view')) {
    router.replace(`/${locale}/unauthorized`);
    return null;
  }

  const lowStockItems = useMemo(() => db.inventoryItems.filter((i) => i.quantity <= i.minimumStock || i.status === 'low_stock'), [db.inventoryItems]);
  const expiredItems = useMemo(() => db.inventoryItems.filter((i) => i.status === 'expired'), [db.inventoryItems]);

  const addItem = () => {
    if (!form.itemName || !canManage) return;
    const now = new Date().toISOString();
    const qty = parseInt(form.quantity, 10);
    const min = parseInt(form.minimumStock, 10);
    const item: InventoryItem = {
      id: generateId(),
      itemName: form.itemName,
      category: form.category,
      quantity: qty,
      unit: form.unit,
      minimumStock: min,
      maximumStock: 50,
      storageLocation: form.storageLocation || 'Shelf A-1',
      status: qty <= min ? 'low_stock' : 'available',
      createdAt: now,
    };
    db.inventoryItems.unshift(item);
    if (user) appendAuditLog(db, user.id, 'create', 'inventory', item.id);
    saveMockDatabase(db);
    refresh();
    setDialogOpen(false);
    toast.success('Inventory item added');
  };

  const deleteItem = (id: string) => {
    if (!canManage || !confirm(tc('confirmDelete'))) return;
    db.inventoryItems = db.inventoryItems.filter((i) => i.id !== id);
    if (user) appendAuditLog(db, user.id, 'delete', 'inventory', id);
    saveMockDatabase(db);
    refresh();
    toast.success('Item deleted');
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
          <p className="text-muted-foreground">{db.inventoryItems.length} items tracked</p>
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
                    <SelectContent>{['reagents', 'controls', 'calibrators', 'consumables', 'ppe'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Quantity</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
                  <div><Label>Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
                </div>
                <div><Label>Min Stock</Label><Input type="number" value={form.minimumStock} onChange={(e) => setForm({ ...form, minimumStock: e.target.value })} /></div>
                <div><Label>Storage Location</Label><Input value={form.storageLocation} onChange={(e) => setForm({ ...form, storageLocation: e.target.value })} /></div>
                <Button onClick={addItem} className="w-full">{tc('save')}</Button>
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

      <DataTable data={db.inventoryItems} columns={columns} searchKey="itemName" searchPlaceholder="Search inventory..." />
    </div>
  );
}
