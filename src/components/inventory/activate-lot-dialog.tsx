'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { activateLotFromStore } from '@/lib/clinical/inventory-lot-usage';
import { fetchInstruments } from '@/lib/clinical/instruments';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import type { InventoryItem, Profile } from '@/types';
import { useEffect } from 'react';
import { formatInstrumentSelectorLabel } from '@/lib/ppm-calibration/instrument-display';
import type { Instrument } from '@/types';

interface ActivateLotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem;
  user: Profile;
  onComplete: () => void;
}

export function ActivateLotDialog({ open, onOpenChange, item, user, onComplete }: ActivateLotDialogProps) {
  const [saving, setSaving] = useState(false);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [instrumentId, setInstrumentId] = useState('');
  const [testParameter, setTestParameter] = useState('');
  const [methodName, setMethodName] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [openDate, setOpenDate] = useState('');
  const [kind, setKind] = useState<'reagent' | 'qc'>('reagent');

  useEffect(() => {
    if (!open) return;
    void fetchInstruments().then((res) => {
      if (res.data) setInstruments(res.data.filter((i) => i.active !== false));
    });
  }, [open]);

  const submit = async () => {
    setSaving(true);
    const staff = await resolveStaffContext(user);
    const instrument = instruments.find((i) => i.id === instrumentId);
    const result = await activateLotFromStore(staff, item, {
      inventoryItemId: item.id,
      instrumentId: instrumentId || undefined,
      instrumentName: instrument?.name,
      testParameter: testParameter || undefined,
      methodName: methodName || undefined,
      startDate,
      openDate: openDate || undefined,
      kind,
      qcLevel: kind === 'qc' ? testParameter : undefined,
    });
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to activate lot');
      return;
    }
    toast.success('Lot activated in Lot in Use');
    onComplete();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set as Lot in Use</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {item.itemName} · Lot {item.lotNumber ?? '—'} · {item.category}
          </p>
          <div><Label>Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as 'reagent' | 'qc')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reagent">Reagent</SelectItem>
                <SelectItem value="qc">QC Material</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Instrument</Label>
            <Select value={instrumentId} onValueChange={setInstrumentId}>
              <SelectTrigger><SelectValue placeholder="Select instrument" /></SelectTrigger>
              <SelectContent>
                {instruments.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id}>{formatInstrumentSelectorLabel(inst)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>{kind === 'qc' ? 'QC Level' : 'Test / Parameter'}</Label>
            <Input value={testParameter} onChange={(e) => setTestParameter(e.target.value)} />
          </div>
          <div><Label>Method</Label><Input value={methodName} onChange={(e) => setMethodName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Start Date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div><Label>Open Date</Label><Input type="date" value={openDate} onChange={(e) => setOpenDate(e.target.value)} /></div>
          </div>
          <Button className="w-full" disabled={saving} onClick={() => void submit()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Activate Lot'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
