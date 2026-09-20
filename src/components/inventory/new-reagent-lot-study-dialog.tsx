'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { resolveFormHema022Reagent } from '@/lib/inventory/form-hema-022/reagent-mapping';
import { FORM_HEMA_022_CODE } from '@/lib/inventory/form-hema-022/constants';
import { fetchInstruments } from '@/lib/clinical/instruments';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import { formatInstrumentSelectorLabel } from '@/lib/ppm-calibration/instrument-display';
import type { InventoryItem, Instrument, Profile } from '@/types';

interface NewReagentLotStudyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: InventoryItem[];
  user: Profile;
  initialNewItemId?: string;
}

export function NewReagentLotStudyDialog({
  open,
  onOpenChange,
  items,
  user,
  initialNewItemId,
}: NewReagentLotStudyDialogProps) {
  const locale = useLocale();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [form, setForm] = useState({
    instrumentId: '',
    oldLotNumber: '',
    oldLotExpiry: '',
    newLotNumber: '',
    newLotExpiry: '',
    studyDate: new Date().toISOString().slice(0, 10),
    comments: '',
  });

  const mappedItems = useMemo(
    () => items.filter((item) => resolveFormHema022Reagent(item.itemName) != null),
    [items],
  );

  const selectedItem = mappedItems.find((item) => item.id === selectedItemId) ?? null;
  const mappedReagent = selectedItem ? resolveFormHema022Reagent(selectedItem.itemName) : null;

  useEffect(() => {
    if (!open) return;
    void fetchInstruments().then((res) => {
      if (res.data) setInstruments(res.data.filter((i) => i.active !== false));
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const preferred = initialNewItemId && mappedItems.some((i) => i.id === initialNewItemId)
      ? initialNewItemId
      : mappedItems[0]?.id ?? '';
    setSelectedItemId(preferred);
  }, [open, initialNewItemId, mappedItems]);

  useEffect(() => {
    if (!selectedItem) return;
    setForm((prev) => ({
      ...prev,
      newLotNumber: selectedItem.lotNumber ?? '',
      newLotExpiry: selectedItem.expiryDate ?? '',
    }));
  }, [selectedItem]);

  const submit = async () => {
    if (!selectedItem || !mappedReagent) {
      toast.error('Select a Form-Hema-022 mapped store item');
      return;
    }
    if (!form.oldLotNumber.trim() || !form.newLotNumber.trim()) {
      toast.error('Old lot and new lot numbers are required');
      return;
    }
    if (!form.instrumentId) {
      toast.error('Select the instrument for this lot-to-lot study');
      return;
    }
    setSaving(true);
    const staff = await resolveStaffContext(user);
    const instrument = instruments.find((i) => i.id === form.instrumentId);
    const res = await createReagentLotComparison(staff, {
      reagentName: selectedItem.itemName,
      instrumentId: form.instrumentId,
      instrumentName: instrument?.name,
      oldLotNumber: form.oldLotNumber.trim(),
      newLotNumber: form.newLotNumber.trim(),
      newStoreItemId: selectedItem.id,
      studyDate: form.studyDate,
      studyYear: new Date(form.studyDate).getFullYear(),
      sampleCount: 3,
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
          {mappedItems.length === 0 ? (
            <p className="text-amber-700 dark:text-amber-300">
              No Form-Hema-022 mapped reagents in Store. Add a store item whose name matches a controlled reagent (for example RETIC reagent) first.
            </p>
          ) : (
            <>
              <div>
                <Label>Store item / reagent</Label>
                <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                  <SelectTrigger><SelectValue placeholder="Select mapped reagent" /></SelectTrigger>
                  <SelectContent>
                    {mappedItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.itemName} · Lot {item.lotNumber ?? '—'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {mappedReagent && (
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <p className="font-medium">{FORM_HEMA_022_CODE} · {mappedReagent.definition.displayName}</p>
                  <p className="text-muted-foreground mt-1">
                    Tests: {mappedReagent.definition.tests.map((test) => test.label).join(', ')}
                  </p>
                  <p className="text-muted-foreground">
                    Layout: {mappedReagent.definition.instrumentHint} · 3 samples
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div><Label>Current lot #</Label><Input value={form.oldLotNumber} onChange={(e) => setForm({ ...form, oldLotNumber: e.target.value })} /></div>
                <div><Label>Current lot expiry</Label><Input type="date" value={form.oldLotExpiry} onChange={(e) => setForm({ ...form, oldLotExpiry: e.target.value })} /></div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div><Label>New lot #</Label><Input value={form.newLotNumber} onChange={(e) => setForm({ ...form, newLotNumber: e.target.value })} /></div>
                <div><Label>New lot expiry</Label><Input type="date" value={form.newLotExpiry} onChange={(e) => setForm({ ...form, newLotExpiry: e.target.value })} /></div>
              </div>

              <div><Label>Comparison date</Label><Input type="date" value={form.studyDate} onChange={(e) => setForm({ ...form, studyDate: e.target.value })} /></div>

              <div>
                <Label>Analyzer / Method</Label>
                <Select value={form.instrumentId} onValueChange={(v) => setForm({ ...form, instrumentId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select instrument" /></SelectTrigger>
                  <SelectContent>
                    {instruments.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>{formatInstrumentSelectorLabel(inst)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div><Label>Comments</Label><Textarea value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} rows={2} /></div>

              <Button className="w-full" disabled={saving || !mappedReagent} onClick={() => void submit()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Lot-to-Lot Study'}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
