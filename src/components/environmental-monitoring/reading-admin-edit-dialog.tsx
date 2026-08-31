'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/providers/auth-provider';
import { adminUpdateEnvironmentalReading } from '@/lib/clinical/environmental-monitoring';
import { canAdminEditEnvironmental } from '@/lib/environmental-monitoring/permissions';
import { environmentalAdminEditFormSchema } from '@/lib/environmental-monitoring/schema';
import type { EnvironmentalReading } from '@/types/environmental-monitoring';

interface ReadingAdminEditDialogProps {
  reading: EnvironmentalReading;
  onSaved: () => Promise<void>;
}

export function ReadingAdminEditDialog({ reading, onSaved }: ReadingAdminEditDialogProps) {
  const { role } = useAuth();
  const [open, setOpen] = useState(false);
  const [newTemperature, setNewTemperature] = useState<number | ''>(reading.temperature);
  const [newHumidity, setNewHumidity] = useState<number | ''>(reading.humidity ?? '');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  if (!canAdminEditEnvironmental(role)) return null;

  const save = async () => {
    const parsed = environmentalAdminEditFormSchema.safeParse({
      newTemperature,
      newHumidity: newHumidity === '' ? undefined : newHumidity,
      adminChangeReason: reason,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Complete administrative edit fields');
      return;
    }
    setSaving(true);
    const result = await adminUpdateEnvironmentalReading(reading.id, parsed.data);
    setSaving(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success('Administrative edit applied');
      setOpen(false);
      setReason('');
      await onSaved();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive">Admin Edit</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Administrative Reading Edit</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive">
            System admin override. This directly updates the protected reading record and creates an immutable audit event.
            Use <strong>Correct</strong> for normal operational corrections.
          </p>
          <div><Label>Original Temperature</Label><p>{reading.temperature}°C</p></div>
          {reading.humidity != null && (
            <div><Label>Original Humidity</Label><p>{reading.humidity}%</p></div>
          )}
          <div><Label>New Temperature (°C)</Label><Input type="number" step="0.1" value={newTemperature} onChange={(e) => setNewTemperature(e.target.value === '' ? '' : Number(e.target.value))} /></div>
          {reading.humidity != null && (
            <div><Label>New Humidity (%)</Label><Input type="number" step="0.1" value={newHumidity} onChange={(e) => setNewHumidity(e.target.value === '' ? '' : Number(e.target.value))} /></div>
          )}
          <div><Label>Reason for Administrative Change *</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Required before save" /></div>
          <Button className="w-full" disabled={saving || !reason.trim()} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save Administrative Edit'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
