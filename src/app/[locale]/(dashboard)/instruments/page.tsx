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
import { INSTRUMENT_ITEM_TYPE_LABELS } from '@/lib/ppm-calibration/constants';
import {
  emptyExtendedInstrumentForm,
  extendedInstrumentFormSchema,
  type ExtendedInstrumentFormData,
} from '@/lib/ppm-calibration/schema';
import { INSTRUMENT_STATUSES } from '@/lib/instruments/schema';
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
  const [form, setForm] = useState<ExtendedInstrumentFormData>(() => emptyExtendedInstrumentForm());

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
    const parsed = extendedInstrumentFormSchema.safeParse(form);
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
    setForm(emptyExtendedInstrumentForm());
    toast.success('Item added');
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
    {
      id: 'itemType',
      header: 'Type',
      cell: ({ row }) => INSTRUMENT_ITEM_TYPE_LABELS[row.original.itemType ?? 'instrument'],
    },
    { accessorKey: 'assetCode', header: 'Asset Code', cell: ({ row }) => row.original.assetCode ?? '—' },
    { accessorKey: 'manufacturer', header: 'Manufacturer', cell: ({ row }) => row.original.manufacturer || '—' },
    { accessorKey: 'model', header: 'Model', cell: ({ row }) => row.original.model || '—' },
    { accessorKey: 'serialNumber', header: 'Serial #', cell: ({ row }) => row.original.serialNumber || '—' },
    { accessorKey: 'location', header: 'Location', cell: ({ row }) => row.original.location || '—' },
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
          <p className="text-muted-foreground">{instruments.length} items registered</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{tc('add')}</Button></DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{tc('add')} Item</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Type *</Label>
                  <Select value={form.itemType} onValueChange={(v) => setForm({ ...form, itemType: v as ExtendedInstrumentFormData['itemType'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instrument">{INSTRUMENT_ITEM_TYPE_LABELS.instrument}</SelectItem>
                      <SelectItem value="equipment">{INSTRUMENT_ITEM_TYPE_LABELS.equipment}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Asset Code</Label><Input value={form.assetCode ?? ''} onChange={(e) => setForm({ ...form, assetCode: e.target.value })} /></div>
                <div><Label>Manufacturer</Label><Input value={form.manufacturer ?? ''} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></div>
                <div><Label>Model</Label><Input value={form.model ?? ''} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
                <div><Label>Serial Number</Label><Input value={form.serialNumber ?? ''} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} /></div>
                <div><Label>Location</Label><Input value={form.location ?? ''} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                <div><Label>Section</Label><Input value={form.section ?? ''} onChange={(e) => setForm({ ...form, section: e.target.value })} /></div>
                <div><Label>Installation Date</Label><Input type="date" value={form.installationDate ?? ''} onChange={(e) => setForm({ ...form, installationDate: e.target.value })} /></div>
                <div><Label>Service Provider</Label><Input value={form.serviceProvider ?? ''} onChange={(e) => setForm({ ...form, serviceProvider: e.target.value })} /></div>
                <div><Label>PPM Frequency</Label><Input value={form.ppmFrequency ?? ''} onChange={(e) => setForm({ ...form, ppmFrequency: e.target.value })} placeholder="e.g. quarterly, not_required" /></div>
                <div><Label>Calibration Frequency</Label><Input value={form.calibrationFrequency ?? ''} onChange={(e) => setForm({ ...form, calibrationFrequency: e.target.value })} placeholder="e.g. annual, not_required" /></div>
                <div><Label>Notes</Label><Input value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
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
        <EmptyState title={tc('noData')} description="No instruments or equipment registered yet." />
      ) : (
        <DataTable data={instruments} columns={columns} searchKey="name" searchPlaceholder="Search items..." />
      )}
    </div>
  );
}
