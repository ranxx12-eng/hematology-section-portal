'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Eye, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { appendAuditLog, statusBadgeVariant } from '@/lib/page-utils';
import { formatDate, generateId } from '@/lib/utils';
import type { Instrument } from '@/types';

export default function InstrumentsPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const canManage = can('instruments.manage');
  const [db, setDb] = useState(() => getMockDatabase());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', manufacturer: '', model: '', serialNumber: '', location: '', status: 'operational' as Instrument['status'] });
  const refresh = useCallback(() => setDb(getMockDatabase()), []);

  const accessDenied = !can('instruments.view');


  useRouteReplace(accessDenied, `/${locale}/unauthorized`);


  if (accessDenied) return null;

  const addInstrument = () => {
    if (!form.name || !canManage) return;
    const now = new Date().toISOString();
    const inst: Instrument = {
      id: generateId(),
      name: form.name,
      manufacturer: form.manufacturer,
      model: form.model,
      serialNumber: form.serialNumber,
      location: form.location,
      installationDate: now,
      status: form.status,
      createdAt: now,
      updatedAt: now,
    };
    db.instruments.push(inst);
    if (user) appendAuditLog(db, user.id, 'create', 'instruments', inst.id);
    saveMockDatabase(db);
    refresh();
    setDialogOpen(false);
    setForm({ name: '', manufacturer: '', model: '', serialNumber: '', location: '', status: 'operational' });
    toast.success('Instrument added');
  };

  const deleteInstrument = (id: string) => {
    if (!canManage || !confirm(tc('confirmDelete'))) return;
    db.instruments = db.instruments.filter((i) => i.id !== id);
    if (user) appendAuditLog(db, user.id, 'delete', 'instruments', id);
    saveMockDatabase(db);
    refresh();
    toast.success('Instrument deleted');
  };

  const columns: ColumnDef<Instrument>[] = useMemo(() => [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'manufacturer', header: 'Manufacturer' },
    { accessorKey: 'model', header: 'Model' },
    { accessorKey: 'serialNumber', header: 'Serial #' },
    { accessorKey: 'location', header: 'Location' },
    {
      accessorKey: 'status', header: tc('status'),
      cell: ({ row }) => <Badge variant={statusBadgeVariant(row.original.status)}>{row.original.status.replace('_', ' ')}</Badge>,
    },
    {
      id: 'actions', header: tc('actions'),
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => router.push(`/${locale}/instruments/${row.original.id}`)}><Eye className="h-4 w-4" /></Button>
          {canManage && <Button size="sm" variant="ghost" onClick={() => deleteInstrument(row.original.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>}
        </div>
      ),
    },
  ], [canManage, locale, router, tc]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tc('instruments')}</h1>
          <p className="text-muted-foreground">{db.instruments.length} instruments registered</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{tc('add')}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{tc('add')} Instrument</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Manufacturer</Label><Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></div>
                <div><Label>Model</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
                <div><Label>Serial Number</Label><Input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} /></div>
                <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                <div><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Instrument['status'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(['operational', 'warning', 'under_maintenance', 'out_of_service', 'decommissioned'] as const).map((s) => (
                        <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={addInstrument} className="w-full">{tc('save')}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <DataTable data={db.instruments} columns={columns} searchKey="name" searchPlaceholder="Search instruments..." />
    </div>
  );
}
