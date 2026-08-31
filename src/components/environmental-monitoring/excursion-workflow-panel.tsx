'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/components/providers/auth-provider';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import {
  recheckEnvironmentalExcursion,
  resolveEnvironmentalExcursion,
  reviewEnvironmentalExcursion,
  updateEnvironmentalExcursionAction,
} from '@/lib/clinical/environmental-monitoring';
import { formatEnvironmentalRange } from '@/lib/environmental-monitoring/permissions';
import {
  environmentalExcursionActionSchema,
  environmentalExcursionRecheckSchema,
  environmentalExcursionResolutionSchema,
  environmentalExcursionReviewSchema,
} from '@/lib/environmental-monitoring/schema';
import type { EnvironmentalAsset, EnvironmentalExcursion } from '@/types/environmental-monitoring';

interface ExcursionWorkflowPanelProps {
  excursion: EnvironmentalExcursion;
  asset: EnvironmentalAsset;
  onUpdated: () => Promise<void>;
}

export function ExcursionWorkflowPanel({ excursion, asset, onUpdated }: ExcursionWorkflowPanelProps) {
  const { user, can } = useAuth();
  const [saving, setSaving] = useState(false);
  const [actionForm, setActionForm] = useState({
    immediateAction: excursion.immediateAction ?? '',
    affectedMaterial: excursion.affectedMaterial ?? '',
    maintenanceTicketNumber: excursion.maintenanceTicketNumber ?? '',
    additionalComment: excursion.additionalComment ?? '',
  });
  const [recheckForm, setRecheckForm] = useState({
    recheckTemperature: excursion.recheckTemperature ?? ('' as unknown as number),
    recheckHumidity: excursion.recheckHumidity,
    recheckAt: excursion.recheckAt ?? new Date().toISOString().slice(0, 16),
  });
  const [resolutionForm, setResolutionForm] = useState({
    resolutionStatus: excursion.resolutionStatus ?? '',
    resolutionComment: excursion.resolutionComment ?? '',
  });
  const [reviewForm, setReviewForm] = useState({
    reviewDecision: excursion.reviewDecision ?? 'accept',
    reviewComment: excursion.reviewComment ?? '',
  });

  const runStep = async (label: string, action: () => Promise<void>) => {
    setSaving(true);
    await action();
    setSaving(false);
  };

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">OUT OF RANGE — Environmental Excursion</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><p className="text-xs text-muted-foreground">Detected Temperature</p><p className="font-medium">{excursion.detectedTemperature}°C</p></div>
          <div><p className="text-xs text-muted-foreground">Acceptable Range</p><p className="font-medium">{formatEnvironmentalRange(excursion.rangeMinAtDetection, excursion.rangeMaxAtDetection)}</p></div>
          <div><p className="text-xs text-muted-foreground">Status</p><Badge variant="destructive">{excursion.status}</Badge></div>
        </div>

        <section className="space-y-2">
          <h3 className="font-semibold">Immediate Action</h3>
          <div><Label>Immediate Action *</Label><Textarea value={actionForm.immediateAction} onChange={(e) => setActionForm((p) => ({ ...p, immediateAction: e.target.value }))} rows={2} /></div>
          <div><Label>Affected Material</Label><Input value={actionForm.affectedMaterial} onChange={(e) => setActionForm((p) => ({ ...p, affectedMaterial: e.target.value }))} /></div>
          <div><Label>Maintenance Ticket Number</Label><Input value={actionForm.maintenanceTicketNumber} onChange={(e) => setActionForm((p) => ({ ...p, maintenanceTicketNumber: e.target.value }))} /></div>
          <div><Label>Comment</Label><Textarea value={actionForm.additionalComment} onChange={(e) => setActionForm((p) => ({ ...p, additionalComment: e.target.value }))} rows={2} /></div>
          {can('environmental.record') && (
            <Button disabled={saving} onClick={() => void runStep('action', async () => {
              if (!user) return;
              const parsed = environmentalExcursionActionSchema.safeParse(actionForm);
              if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? 'Complete action fields'); return; }
              const staff = await resolveStaffContext(user);
              const result = await updateEnvironmentalExcursionAction(excursion.id, staff, parsed.data);
              if (result.error) toast.error(result.error); else { toast.success('Immediate action saved'); await onUpdated(); }
            })}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Immediate Action'}
            </Button>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">Recheck</h3>
          <div><Label>Recheck Temperature</Label><Input type="number" step="0.1" value={recheckForm.recheckTemperature === ('' as unknown as number) ? '' : recheckForm.recheckTemperature} onChange={(e) => setRecheckForm((p) => ({ ...p, recheckTemperature: Number(e.target.value) }))} /></div>
          {asset.humidityRequired && <div><Label>Recheck Humidity</Label><Input type="number" step="0.1" value={recheckForm.recheckHumidity ?? ''} onChange={(e) => setRecheckForm((p) => ({ ...p, recheckHumidity: e.target.value ? Number(e.target.value) : undefined }))} /></div>}
          <div><Label>Recheck Date/Time</Label><Input type="datetime-local" value={recheckForm.recheckAt} onChange={(e) => setRecheckForm((p) => ({ ...p, recheckAt: e.target.value }))} /></div>
          {(can('environmental.record') || can('environmental.resolve')) && (
            <Button variant="outline" disabled={saving} onClick={() => void runStep('recheck', async () => {
              if (!user) return;
              const parsed = environmentalExcursionRecheckSchema.safeParse(recheckForm);
              if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? 'Complete recheck fields'); return; }
              const staff = await resolveStaffContext(user);
              const result = await recheckEnvironmentalExcursion(excursion.id, staff, parsed.data);
              if (result.error) toast.error(result.error); else { toast.success('Recheck saved'); await onUpdated(); }
            })}>Save Recheck</Button>
          )}
        </section>

        {can('environmental.resolve') && (
          <section className="space-y-2">
            <h3 className="font-semibold">Resolution</h3>
            <div><Label>Resolution Status *</Label><Input value={resolutionForm.resolutionStatus} onChange={(e) => setResolutionForm((p) => ({ ...p, resolutionStatus: e.target.value }))} /></div>
            <div><Label>Resolution Comment *</Label><Textarea value={resolutionForm.resolutionComment} onChange={(e) => setResolutionForm((p) => ({ ...p, resolutionComment: e.target.value }))} rows={2} /></div>
            <Button disabled={saving} onClick={() => void runStep('resolve', async () => {
              if (!user) return;
              const parsed = environmentalExcursionResolutionSchema.safeParse(resolutionForm);
              if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? 'Complete resolution fields'); return; }
              const staff = await resolveStaffContext(user);
              const result = await resolveEnvironmentalExcursion(excursion.id, staff, parsed.data);
              if (result.error) toast.error(result.error); else { toast.success('Excursion resolved'); await onUpdated(); }
            })}>Mark Resolved</Button>
          </section>
        )}

        {can('environmental.review') && excursion.status === 'resolved' && excursion.reviewStatus !== 'Reviewed' && (
          <section className="space-y-2">
            <h3 className="font-semibold">Review</h3>
            <div><Label>Review Decision</Label>
              <select className="w-full rounded-md border px-3 py-2 text-sm" value={reviewForm.reviewDecision} onChange={(e) => setReviewForm((p) => ({ ...p, reviewDecision: e.target.value as typeof reviewForm.reviewDecision }))}>
                <option value="accept">Accept</option>
                <option value="not_accept">Not Accept</option>
                <option value="need_follow_up">Need Follow Up</option>
              </select>
            </div>
            <div><Label>Review Comment</Label><Textarea value={reviewForm.reviewComment} onChange={(e) => setReviewForm((p) => ({ ...p, reviewComment: e.target.value }))} rows={2} /></div>
            <Button variant="secondary" disabled={saving} onClick={() => void runStep('review', async () => {
              if (!user) return;
              const parsed = environmentalExcursionReviewSchema.safeParse(reviewForm);
              if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? 'Complete review fields'); return; }
              const staff = await resolveStaffContext(user);
              const result = await reviewEnvironmentalExcursion(excursion.id, staff, parsed.data);
              if (result.error) toast.error(result.error); else { toast.success('Excursion reviewed'); await onUpdated(); }
            })}>Submit Review</Button>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
