'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { createCentrifugePppCalibrationDraft } from '@/lib/clinical/centrifuge-ppp-calibration';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import { isCentrifugePppInstrument } from '@/lib/ppm-calibration/centrifuge-detection';
import {
  CALIBRATION_PERFORMER_TYPE_LABELS,
  CALIBRATION_PERFORMER_TYPES,
  EQUIPMENT_MAINTENANCE_RESULTS,
} from '@/lib/ppm-calibration/constants';
import { calibrationRecordFormSchema, type CalibrationRecordFormData } from '@/lib/ppm-calibration/schema';
import { useAuth } from '@/components/providers/auth-provider';

interface RecordCalibrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instruments: Array<{ id: string; name: string; label?: string; serialNumber?: string; assetCode?: string; equipmentCategory?: string }>;
  onSave: (form: CalibrationRecordFormData, attachment?: File) => Promise<void>;
}

export function RecordCalibrationDialog({ open, onOpenChange, instruments, onSave }: RecordCalibrationDialogProps) {
  const locale = useLocale();
  const router = useRouter();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CalibrationRecordFormData>({
    instrumentEquipmentId: '',
    performedDate: new Date().toISOString().slice(0, 10),
    performedByType: 'internal_staff',
    result: 'pass',
  });
  const [attachment, setAttachment] = useState<File | undefined>();

  useEffect(() => {
    if (!open) {
      setForm({
        instrumentEquipmentId: '',
        performedDate: new Date().toISOString().slice(0, 10),
        performedByType: 'internal_staff',
        result: 'pass',
      });
      setAttachment(undefined);
    }
  }, [open]);

  const isInternal = form.performedByType === 'internal_staff';

  const selectedInstrument = instruments.find((item) => item.id === form.instrumentEquipmentId);
  const isCentrifuge = selectedInstrument
    ? isCentrifugePppInstrument({
      serialNumber: selectedInstrument.serialNumber,
      assetCode: selectedInstrument.assetCode,
      name: selectedInstrument.name,
      equipmentCategory: selectedInstrument.equipmentCategory as import('@/types').Instrument['equipmentCategory'],
    })
    : false;

  const save = async () => {
    if (isCentrifuge) {
      if (!user) return;
      setSaving(true);
      const staff = await resolveStaffContext(user);
      const result = await createCentrifugePppCalibrationDraft(staff, form.instrumentEquipmentId);
      if (result.error || !result.data) {
        toast.error(result.error ?? 'Failed to open Centrifuge PPP workflow');
        setSaving(false);
        return;
      }
      onOpenChange(false);
      router.push(`/${locale}/ppm-calibration/centrifuge-ppp/${result.data.id}`);
      setSaving(false);
      return;
    }

    const parsed = calibrationRecordFormSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid form');
      return;
    }
    setSaving(true);
    await onSave(parsed.data, attachment);
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Record Calibration</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Instrument / Equipment *</Label>
            <Select value={form.instrumentEquipmentId} onValueChange={(v) => setForm((p) => ({ ...p, instrumentEquipmentId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
              <SelectContent>
                {instruments.map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.label ?? item.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isCentrifuge ? (
            <p className="text-sm rounded-md border border-primary/30 bg-primary/5 p-3">
              The official Centrifuge uses the dedicated Form-Hema-009 PPP workflow with five verification samples.
              Saving will open Centrifuge Calibration for PPP instead of the generic calibration form.
            </p>
          ) : (
            <>
          <div><Label>Calibration Date *</Label><Input type="date" value={form.performedDate} onChange={(e) => setForm((p) => ({ ...p, performedDate: e.target.value }))} /></div>
          <div><Label>Next Due Date</Label><Input type="date" value={form.nextDueDate ?? ''} onChange={(e) => setForm((p) => ({ ...p, nextDueDate: e.target.value || undefined }))} /></div>
          <div>
            <Label>Performed By Type *</Label>
            <Select value={form.performedByType} onValueChange={(v) => setForm((p) => ({ ...p, performedByType: v as CalibrationRecordFormData['performedByType'] }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CALIBRATION_PERFORMER_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>{CALIBRATION_PERFORMER_TYPE_LABELS[type]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isInternal ? (
            <p className="text-sm text-muted-foreground rounded-md border p-3">
              Internal staff calibration will automatically record your name and staff ID. Engineer and vendor fields are not required.
            </p>
          ) : (
            <>
              <div><Label>Service Provider</Label><Input value={form.serviceProvider ?? ''} onChange={(e) => setForm((p) => ({ ...p, serviceProvider: e.target.value }))} /></div>
              <div><Label>Engineer Name</Label><Input value={form.engineerName ?? ''} onChange={(e) => setForm((p) => ({ ...p, engineerName: e.target.value }))} /></div>
              <div><Label>Work Order / Ticket Number</Label><Input value={form.workOrderNumber ?? form.ticketNumber ?? ''} onChange={(e) => setForm((p) => ({ ...p, workOrderNumber: e.target.value, ticketNumber: e.target.value }))} /></div>
            </>
          )}
          <div><Label>Certificate Number</Label><Input value={form.certificateNumber ?? ''} onChange={(e) => setForm((p) => ({ ...p, certificateNumber: e.target.value }))} /></div>
          <div>
            <Label>Result *</Label>
            <Select value={form.result} onValueChange={(v) => setForm((p) => ({ ...p, result: v as CalibrationRecordFormData['result'] }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EQUIPMENT_MAINTENANCE_RESULTS.map((r) => (
                  <SelectItem key={r} value={r}>{r.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Comments</Label><Textarea value={form.comment ?? ''} onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))} rows={2} /></div>
          <div><Label>Calibration Certificate (PDF/Image)</Label><Input type="file" accept=".pdf,image/*" onChange={(e) => setAttachment(e.target.files?.[0])} /></div>
            </>
          )}
          <Button className="w-full" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : isCentrifuge ? 'Open Centrifuge PPP Workflow' : 'Save Calibration'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
