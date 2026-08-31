'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/providers/auth-provider';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import { correctEnvironmentalReading } from '@/lib/clinical/environmental-monitoring';
import { canCorrectEnvironmental } from '@/lib/environmental-monitoring/permissions';
import { environmentalCorrectionFormSchema } from '@/lib/environmental-monitoring/schema';
import type { EnvironmentalReading, EnvironmentalReadingCorrection } from '@/types/environmental-monitoring';

interface ReadingCorrectionDialogProps {
  reading: EnvironmentalReading;
  corrections: EnvironmentalReadingCorrection[];
  onSaved: () => Promise<void>;
}

export function ReadingCorrectionDialog({ reading, corrections, onSaved }: ReadingCorrectionDialogProps) {
  const { can, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [newTemperature, setNewTemperature] = useState<number | ''>('');
  const [newHumidity, setNewHumidity] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  if (!canCorrectEnvironmental(can)) return null;

  const latestCorrection = corrections
    .filter((item) => item.readingId === reading.id)
    .sort((a, b) => b.correctedAt.localeCompare(a.correctedAt))[0];

  const save = async () => {
    if (!user) return;
    const parsed = environmentalCorrectionFormSchema.safeParse({
      newTemperature,
      newHumidity: newHumidity === '' ? undefined : newHumidity,
      correctionReason: reason,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Complete correction fields');
      return;
    }
    setSaving(true);
    const staff = await resolveStaffContext(user);
    const result = await correctEnvironmentalReading(reading.id, staff, parsed.data);
    setSaving(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success('Correction recorded');
      setOpen(false);
      await onSaved();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Correct</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Correct Reading</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <p>Original Reading: {reading.temperature}°C</p>
          {latestCorrection && (
            <p>Latest Correction: {latestCorrection.newTemperature}°C ({latestCorrection.correctionReason})</p>
          )}
          <div><Label>New Temperature (°C)</Label><Input type="number" step="0.1" value={newTemperature} onChange={(e) => setNewTemperature(e.target.value === '' ? '' : Number(e.target.value))} /></div>
          {reading.humidity != null && (
            <div><Label>New Humidity (%)</Label><Input type="number" step="0.1" value={newHumidity} onChange={(e) => setNewHumidity(e.target.value === '' ? '' : Number(e.target.value))} /></div>
          )}
          <div><Label>Correction Reason</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /></div>
          <Button className="w-full" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save Correction'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
