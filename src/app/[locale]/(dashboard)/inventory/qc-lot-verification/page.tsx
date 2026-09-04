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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchInventoryItems } from '@/lib/clinical/inventory';
import { createQcLotVerificationStudy, fetchQcLotVerificationStudies } from '@/lib/clinical/qc-lot-verification';
import { fetchInstruments } from '@/lib/clinical/instruments';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import { useAuth } from '@/components/providers/auth-provider';
import { buildRunProgress, buildParameterSummary } from '@/lib/qc-lot-verification/cbc-calculation';
import {
  QC_VERIFICATION_STATUS_LABELS,
  QC_VERIFICATION_TYPE_LABELS,
} from '@/lib/qc-lot-verification/constants';
import { formatInstrumentSelectorLabel } from '@/lib/ppm-calibration/instrument-display';
import { toast } from 'sonner';
import type { QcLotVerificationStudy } from '@/types/qc-lot-verification';
import type { InventoryItem, Instrument } from '@/types';

export default function QcLotVerificationListPage() {
  const locale = useLocale();
  const searchParams = useSearchParams();
  const { can, user } = useAuth();
  const canManage = can('inventory.manage');
  const [studies, setStudies] = useState<QcLotVerificationStudy[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    verificationType: 'cbc' as 'cbc' | 'coagulation',
    qcMaterialName: '',
    lotNumber: '',
    inventoryItemId: '',
    instrumentId: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [studiesRes, itemsRes, instRes] = await Promise.all([
      fetchQcLotVerificationStudies(),
      fetchInventoryItems(),
      fetchInstruments(),
    ]);
    setStudies(studiesRes.data);
    setItems(itemsRes.data.filter((i) => i.category === 'qc_materials' || i.category === 'controls'));
    setInstruments(instRes.data.filter((i) => i.active !== false));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const startId = searchParams.get('start');
    if (!startId || items.length === 0) return;
    const item = items.find((i) => i.id === startId);
    if (!item) return;
    setForm({
      verificationType: 'cbc',
      qcMaterialName: item.itemName,
      lotNumber: item.lotNumber ?? '',
      inventoryItemId: item.id,
      instrumentId: '',
    });
    setOpen(true);
  }, [searchParams, items]);

  const createStudy = async () => {
    if (!user) return;
    if (form.verificationType === 'coagulation') {
      toast.error('Coagulation QC Verification will be implemented separately.');
      return;
    }
    const staff = await resolveStaffContext(user);
    const instrument = instruments.find((i) => i.id === form.instrumentId);
    const res = await createQcLotVerificationStudy(staff, {
      verificationType: 'cbc',
      qcMaterialName: form.qcMaterialName,
      lotNumber: form.lotNumber,
      inventoryItemId: form.inventoryItemId || undefined,
      instrumentId: form.instrumentId || undefined,
      instrumentName: instrument?.name,
    });
    if (res.error || !res.data) {
      toast.error(res.error ?? 'Failed to create study');
      return;
    }
    toast.success('CBC QC verification study created');
    setOpen(false);
    void load();
  };

  const columns: ColumnDef<QcLotVerificationStudy>[] = [
    {
      accessorKey: 'verificationType',
      header: 'Discipline',
      cell: ({ row }) => QC_VERIFICATION_TYPE_LABELS[row.original.verificationType],
    },
    { accessorKey: 'qcMaterialName', header: 'QC Material' },
    { accessorKey: 'lotNumber', header: 'Lot' },
    { accessorKey: 'instrumentNameSnapshot', header: 'Instrument', cell: ({ row }) => row.original.instrumentNameSnapshot ?? '—' },
    {
      id: 'runProgress',
      header: 'Run Progress',
      cell: ({ row }) => {
        const p = buildRunProgress(row.original.runs);
        return `${p.completedRuns}/${p.totalRuns}`;
      },
    },
    {
      id: 'paramStatus',
      header: 'Parameters',
      cell: ({ row }) => {
        const s = buildParameterSummary(row.original.parameters);
        return `${s.totalParameters - s.incomplete}/${s.totalParameters}`;
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusChip variant="info" label={QC_VERIFICATION_STATUS_LABELS[row.original.status]} />
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => row.original.verificationType === 'cbc' ? (
        <Button size="sm" variant="outline" asChild>
          <Link href={`/${locale}/inventory/qc-lot-verification/cbc/${row.original.id}`}>Open</Link>
        </Button>
      ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      {canManage && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 me-2" />New QC Lot Verification</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New QC Lot Verification</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Workflow</Label>
                <Select value={form.verificationType} onValueChange={(v) => setForm({ ...form, verificationType: v as 'cbc' | 'coagulation' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cbc">CBC QC Verification (Form-Hema-020)</SelectItem>
                    <SelectItem value="coagulation" disabled>Coagulation QC Verification (Coming soon)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>QC Material</Label><Input value={form.qcMaterialName} onChange={(e) => setForm({ ...form, qcMaterialName: e.target.value })} /></div>
              <div><Label>Lot Number</Label><Input value={form.lotNumber} onChange={(e) => setForm({ ...form, lotNumber: e.target.value })} /></div>
              <div>
                <Label>Instrument</Label>
                <Select value={form.instrumentId} onValueChange={(v) => setForm({ ...form, instrumentId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select instrument" /></SelectTrigger>
                  <SelectContent>
                    {instruments.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>{formatInstrumentSelectorLabel(inst)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => void createStudy()}>Create Study</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : studies.length === 0 ? (
        <EmptyState title="No QC lot verifications yet" description="Create a CBC verification study (Form-Hema-020) when a new QC lot requires verification before use." />
      ) : (
        <DataTable data={studies} columns={columns} searchKey="studyNumber" />
      )}
    </div>
  );
}
