'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ppmRecordFormSchema, type PpmRecordFormData } from '@/lib/ppm-calibration/schema';
import { EQUIPMENT_MAINTENANCE_RESULTS } from '@/lib/ppm-calibration/constants';

interface RecordPpmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instruments: Array<{ id: string; name: string }>;
  onSave: (form: PpmRecordFormData, attachment?: File) => Promise<void>;
}

export function RecordPpmDialog({ open, onOpenChange, instruments, onSave }: RecordPpmDialogProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PpmRecordFormData>({
    instrumentEquipmentId: '',
    performedDate: new Date().toISOString().slice(0, 10),
    result: 'pass',
  });
  const [attachment, setAttachment] = useState<File | undefined>();

  const save = async () => {
    const parsed = ppmRecordFormSchema.safeParse(form);
    if (!parsed.success) return;
    setSaving(true);
    await onSave(parsed.data, attachment);
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Record PPM</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Instrument / Equipment *</Label>
            <Select value={form.instrumentEquipmentId} onValueChange={(v) => setForm((p) => ({ ...p, instrumentEquipmentId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
              <SelectContent>
                {instruments.map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Performed Date *</Label><Input type="date" value={form.performedDate} onChange={(e) => setForm((p) => ({ ...p, performedDate: e.target.value }))} /></div>
          <div><Label>Next Due Date</Label><Input type="date" value={form.nextDueDate ?? ''} onChange={(e) => setForm((p) => ({ ...p, nextDueDate: e.target.value || undefined }))} /></div>
          <div><Label>Service Provider</Label><Input value={form.serviceProvider ?? ''} onChange={(e) => setForm((p) => ({ ...p, serviceProvider: e.target.value }))} /></div>
          <div><Label>Engineer Name</Label><Input value={form.engineerName ?? ''} onChange={(e) => setForm((p) => ({ ...p, engineerName: e.target.value }))} /></div>
          <div><Label>Work Order / Ticket Number</Label><Input value={form.workOrderNumber ?? form.ticketNumber ?? ''} onChange={(e) => setForm((p) => ({ ...p, workOrderNumber: e.target.value, ticketNumber: e.target.value }))} /></div>
          <div>
            <Label>Result *</Label>
            <Select value={form.result} onValueChange={(v) => setForm((p) => ({ ...p, result: v as PpmRecordFormData['result'] }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EQUIPMENT_MAINTENANCE_RESULTS.map((r) => (
                  <SelectItem key={r} value={r}>{r.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Comments</Label><Textarea value={form.comment ?? ''} onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))} rows={2} /></div>
          <div><Label>Service Report (PDF/Image)</Label><Input type="file" accept=".pdf,image/*" onChange={(e) => setAttachment(e.target.files?.[0])} /></div>
          <Button className="w-full" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save PPM'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
