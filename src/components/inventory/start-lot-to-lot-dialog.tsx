'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createReagentLotComparison } from '@/lib/clinical/inventory-reagent-lot';
import { fetchLotUsageRecords } from '@/lib/clinical/inventory-lot-usage';
import { fetchInstruments } from '@/lib/clinical/instruments';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import { formatInstrumentSelectorLabel } from '@/lib/ppm-calibration/instrument-display';
import type { InventoryItem, Profile, Instrument } from '@/types';

interface StartLotToLotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem;
  user: Profile;
}

export function StartLotToLotDialog({ open, onOpenChange, item, user }: StartLotToLotDialogProps) {
  const locale = useLocale();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [form, setForm] = useState({
    instrumentId: '',
    testParameter: '',
    oldLotNumber: '',
    oldLotExpiry: '',
    newLotNumber: item.lotNumber ?? '',
    newLotExpiry: item.expiryDate ?? '',
    studyDate: new Date().toISOString().slice(0, 10),
    sampleCount: '3',
    acceptanceMaxDiffPercent: '',
    comments: '',
  });

  useEffect(() => {
    if (!open) return;
    setForm((prev) => ({
      ...prev,
      newLotNumber: item.lotNumber ?? '',
      newLotExpiry: item.expiryDate ?? '',
    }));
    void fetchInstruments().then((res) => {
      if (res.data) setInstruments(res.data.filter((i) => i.active !== false));
    });
    void fetchLotUsageRecords('active').then((res) => {
      const match = res.data.find(
        (r) => r.inventoryItemId !== item.id
          && r.itemNameSnapshot.toLowerCase() === item.itemName.toLowerCase()
          && r.status === 'active',
      );
      if (match) {
        setForm((prev) => ({
          ...prev,
          oldLotNumber: match.lotNumberSnapshot,
          oldLotExpiry: match.expiryDate ?? '',
          testParameter: match.testParameter ?? prev.testParameter,
          instrumentId: match.instrumentId ?? prev.instrumentId,
        }));
      }
    });
  }, [open, item]);

  const submit = async () => {
    if (!form.oldLotNumber.trim() || !form.newLotNumber.trim()) {
      toast.error('Old lot and new lot numbers are required');
      return;
    }
    setSaving(true);
    const staff = await resolveStaffContext(user);
    const instrument = instruments.find((i) => i.id === form.instrumentId);
    const res = await createReagentLotComparison(staff, {
      reagentName: item.itemName,
      testParameter: form.testParameter || undefined,
      instrumentId: form.instrumentId || undefined,
      instrumentName: instrument?.name,
      oldLotNumber: form.oldLotNumber.trim(),
      newLotNumber: form.newLotNumber.trim(),
      newStoreItemId: item.id,
      studyDate: form.studyDate,
      sampleCount: Number(form.sampleCount) || 3,
      acceptanceMaxDifferencePercent: form.acceptanceMaxDiffPercent
        ? Number(form.acceptanceMaxDiffPercent)
        : undefined,
      comments: form.comments || undefined,
      oldLotExpiry: form.oldLotExpiry || undefined,
      newLotExpiry: form.newLotExpiry || undefined,
    });
    setSaving(false);
    if (res.error || !res.data) {
      toast.error(res.error ?? 'Failed to create study');
      return;
    }
    toast.success('Lot-to-Lot study created');
    onOpenChange(false);
    router.push(`/${locale}/inventory/lot-to-lot-reagents/${res.data.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start Lot-to-Lot</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">{item.itemName} · {item.category}</p>

          <div><Label>Item / Reagent</Label><Input value={item.itemName} disabled /></div>

          <div className="grid grid-cols-2 gap-2">
            <div><Label>Current lot #</Label><Input value={form.oldLotNumber} onChange={(e) => setForm({ ...form, oldLotNumber: e.target.value })} placeholder="Old lot" /></div>
            <div><Label>Current lot expiry</Label><Input type="date" value={form.oldLotExpiry} onChange={(e) => setForm({ ...form, oldLotExpiry: e.target.value })} /></div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div><Label>New lot #</Label><Input value={form.newLotNumber} onChange={(e) => setForm({ ...form, newLotNumber: e.target.value })} /></div>
            <div><Label>New lot expiry</Label><Input type="date" value={form.newLotExpiry} onChange={(e) => setForm({ ...form, newLotExpiry: e.target.value })} /></div>
          </div>

          <div><Label>Comparison date</Label><Input type="date" value={form.studyDate} onChange={(e) => setForm({ ...form, studyDate: e.target.value })} /></div>

          <div><Label>Analyzer / Method</Label>
            <Select value={form.instrumentId} onValueChange={(v) => setForm({ ...form, instrumentId: v })}>
              <SelectTrigger><SelectValue placeholder="Select instrument" /></SelectTrigger>
              <SelectContent>
                {instruments.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id}>{formatInstrumentSelectorLabel(inst)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div><Label>Test / Parameter / QC level</Label><Input value={form.testParameter} onChange={(e) => setForm({ ...form, testParameter: e.target.value })} /></div>

          <div className="grid grid-cols-2 gap-2">
            <div><Label>Sample count</Label><Input type="number" min={1} max={20} value={form.sampleCount} onChange={(e) => setForm({ ...form, sampleCount: e.target.value })} /></div>
            <div><Label>Max diff % (acceptance)</Label><Input type="number" step="0.01" value={form.acceptanceMaxDiffPercent} onChange={(e) => setForm({ ...form, acceptanceMaxDiffPercent: e.target.value })} placeholder="e.g. 10" /></div>
          </div>

          <div><Label>Comments</Label><Textarea value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} rows={2} /></div>

          <Button className="w-full" disabled={saving} onClick={() => void submit()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Lot-to-Lot Study'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
