'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Eye, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { statusBadgeVariant } from '@/lib/page-utils';
import {
  createInstrument,
  fetchInstruments,
  softDeleteInstrument,
} from '@/lib/clinical/instruments';
import {
  emptyInstrumentForm,
  INSTRUMENT_STATUSES,
  instrumentFormSchema,
  type InstrumentFormData,
} from '@/lib/instruments/schema';
import type { Instrument } from '@/types';

export default function InstrumentsPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const canManage = can('instruments.manage');
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<InstrumentFormData>(() => emptyInstrumentForm());

  const loadInstruments = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchInstruments();
    setInstruments(result.data);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadInstruments();
  }, [loadInstruments]);

  const accessDenied = !can('instruments.view');

  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  if (accessDenied) return null;

  const addInstrument = async () => {
    if (!canManage || !user) return;
    const parsed = instrumentFormSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid form');
      return;
    }
    setSaving(true);
    const result = await createInstrument(user.id, parsed.data);
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to add instrument');
      return;
    }
    setDialogOpen(false);
    setForm(emptyInstrumentForm());
    toast.success('Instrument added');
    void loadInstruments();
  };

  const deleteInstrument = async (id: string) => {
    if (!canManage || !confirm(tc('confirmDelete'))) return;
    const result = await softDeleteInstrument(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Instrument deleted');
    void loadInstruments();
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
          <p className="text-muted-foreground">{instruments.length} instruments registered</p>
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
                <div><Label>Installation Date</Label><Input type="date" value={form.installationDate} onChange={(e) => setForm({ ...form, installationDate: e.target.value })} /></div>
                <div><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Instrument['status'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INSTRUMENT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={addInstrument} className="w-full" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tc('save')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <EmptyState title="Failed to load instruments" description={error} />
      ) : instruments.length === 0 ? (
        <EmptyState title={tc('noData')} description="No instruments registered yet." />
      ) : (
        <DataTable data={instruments} columns={columns} searchKey="name" searchPlaceholder="Search instruments..." />
      )}
    </div>
  );
}
