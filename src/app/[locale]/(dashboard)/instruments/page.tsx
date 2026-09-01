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
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/providers/auth-provider';
import { statusBadgeVariant } from '@/lib/page-utils';
import {
  createInstrument,
  fetchInstruments,
  softDeleteInstrument,
} from '@/lib/clinical/instruments';
import {
  EQUIPMENT_CATEGORY_LABELS,
  EQUIPMENT_CATEGORY_VALUES,
  INSTRUMENT_ITEM_TYPE_LABELS,
  OPERATIONAL_STATUS_LABELS,
  OPERATIONAL_STATUS_VALUES,
  PPM_FREQUENCY_LABELS,
  PPM_FREQUENCY_VALUES,
} from '@/lib/ppm-calibration/constants';
import {
  emptyExtendedInstrumentForm,
  extendedInstrumentFormSchema,
  type ExtendedInstrumentFormData,
} from '@/lib/ppm-calibration/schema';
import { formatMaintenanceFrequency } from '@/lib/ppm-calibration/constants';
import { canManageEquipment, canViewEquipment } from '@/lib/ppm-calibration/permissions';
import type { Instrument } from '@/types';

type ItemTypeFilter = 'all' | 'instrument' | 'equipment';

export default function InstrumentsPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const canManage = canManageEquipment(can);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemTypeFilter>('all');
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

  const accessDenied = !canViewEquipment(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);
  if (accessDenied) return null;

  const filteredInstruments = useMemo(() => {
    if (itemTypeFilter === 'all') return instruments;
    return instruments.filter((item) => (item.itemType ?? 'instrument') === itemTypeFilter);
  }, [instruments, itemTypeFilter]);

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
      toast.error(result.error ?? 'Failed to add item');
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
    toast.success('Item deleted');
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
    {
      id: 'technicalSpecification',
      header: 'Technical Spec',
      cell: ({ row }) => row.original.technicalSpecification ?? '—',
    },
    { accessorKey: 'serialNumber', header: 'Serial #', cell: ({ row }) => row.original.serialNumber || '—' },
    { accessorKey: 'location', header: 'Location', cell: ({ row }) => row.original.location || '—' },
    {
      id: 'ppmFrequency',
      header: 'PPM Frequency',
      cell: ({ row }) => formatMaintenanceFrequency(row.original.ppmFrequency),
    },
    {
      id: 'active',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.active === false ? 'secondary' : statusBadgeVariant(row.original.status)}>
          {row.original.active === false ? 'Inactive' : row.original.status.replace('_', ' ')}
        </Badge>
      ),
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
          <p className="text-muted-foreground">{filteredInstruments.length} items registered</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={itemTypeFilter} onValueChange={(v) => setItemTypeFilter(v as ItemTypeFilter)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Filter type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="instrument">Instruments</SelectItem>
              <SelectItem value="equipment">Equipment</SelectItem>
            </SelectContent>
          </Select>
          {canManage && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{tc('add')}</Button></DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{tc('add')} Instrument / Equipment</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div><Label>Item Type *</Label>
                    <Select value={form.itemType} onValueChange={(v) => setForm({ ...form, itemType: v as ExtendedInstrumentFormData['itemType'] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="instrument">{INSTRUMENT_ITEM_TYPE_LABELS.instrument}</SelectItem>
                        <SelectItem value="equipment">{INSTRUMENT_ITEM_TYPE_LABELS.equipment}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.itemType === 'equipment' && (
                    <div><Label>Category</Label>
                      <Select value={form.equipmentCategory ?? 'none'} onValueChange={(v) => setForm({ ...form, equipmentCategory: v === 'none' ? undefined : v as ExtendedInstrumentFormData['equipmentCategory'] })}>
                        <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {EQUIPMENT_CATEGORY_VALUES.map((value) => (
                            <SelectItem key={value} value={value}>{EQUIPMENT_CATEGORY_LABELS[value]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div><Label>Asset Code</Label><Input value={form.assetCode ?? ''} onChange={(e) => setForm({ ...form, assetCode: e.target.value })} /></div>
                  <div><Label>Manufacturer</Label><Input value={form.manufacturer ?? ''} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></div>
                  <div><Label>Model</Label><Input value={form.model ?? ''} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
                  <div><Label>Serial Number</Label><Input value={form.serialNumber ?? ''} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} /></div>
                  <div><Label>Location</Label><Input value={form.location ?? ''} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                  <div><Label>Section</Label><Input value={form.section ?? ''} onChange={(e) => setForm({ ...form, section: e.target.value })} /></div>
                  <div><Label>Installation Date</Label><Input type="date" value={form.installationDate ?? ''} onChange={(e) => setForm({ ...form, installationDate: e.target.value })} /></div>
                  <div><Label>Service Provider</Label><Input value={form.serviceProvider ?? ''} onChange={(e) => setForm({ ...form, serviceProvider: e.target.value })} /></div>
                  <div><Label>PPM Frequency</Label>
                    <Select value={form.ppmFrequency ?? 'none'} onValueChange={(v) => setForm({ ...form, ppmFrequency: v === 'none' ? undefined : v as ExtendedInstrumentFormData['ppmFrequency'] })}>
                      <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {PPM_FREQUENCY_VALUES.map((value) => (
                          <SelectItem key={value} value={value}>{PPM_FREQUENCY_LABELS[value]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Calibration Frequency</Label>
                    <Select value={form.calibrationFrequency ?? 'none'} onValueChange={(v) => setForm({ ...form, calibrationFrequency: v === 'none' ? undefined : v as ExtendedInstrumentFormData['calibrationFrequency'] })}>
                      <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {PPM_FREQUENCY_VALUES.map((value) => (
                          <SelectItem key={value} value={value}>{PPM_FREQUENCY_LABELS[value]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Technical Specification</Label><Input value={form.technicalSpecification ?? ''} onChange={(e) => setForm({ ...form, technicalSpecification: e.target.value })} placeholder="e.g. 10 µL for pipettes" /></div>
                  <div><Label>Notes</Label><Textarea value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
                  <div><Label>Status *</Label>
                    <Select value={form.operationalStatus} onValueChange={(v) => setForm({ ...form, operationalStatus: v as ExtendedInstrumentFormData['operationalStatus'] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OPERATIONAL_STATUS_VALUES.map((value) => (
                          <SelectItem key={value} value={value}>{OPERATIONAL_STATUS_LABELS[value]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => void addInstrument()} className="w-full" disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tc('save')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <EmptyState title="Failed to load instruments & equipment" description={error} />
      ) : filteredInstruments.length === 0 ? (
        <EmptyState title={tc('noData')} description="No instruments or equipment registered yet." />
      ) : (
        <DataTable data={filteredInstruments} columns={columns} searchKey="name" searchPlaceholder="Search items..." />
      )}
    </div>
  );
}
