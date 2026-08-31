'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/providers/auth-provider';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import { createEnvironmentalReading } from '@/lib/clinical/environmental-monitoring';
import { findAssetByCode, resolveCurrentWindow } from '@/lib/environmental-monitoring/compliance';
import { formatEnvironmentalRange } from '@/lib/environmental-monitoring/permissions';
import { ENVIRONMENTAL_READING_STATUS_LABELS } from '@/lib/environmental-monitoring/constants';
import {
  environmentalReadingFormSchema,
  getLatestEffectiveReading,
  previewReadingStatus,
  type EnvironmentalReadingFormData,
} from '@/lib/environmental-monitoring/schema';
import type { EnvironmentalAsset, EnvironmentalExcursion, EnvironmentalMonitoringWindow, EnvironmentalReading } from '@/types/environmental-monitoring';
import { ExcursionWorkflowPanel } from '@/components/environmental-monitoring/excursion-workflow-panel';

interface RecordReadingPanelProps {
  assets: EnvironmentalAsset[];
  windows: EnvironmentalMonitoringWindow[];
  readings: EnvironmentalReading[];
  onSaved: () => Promise<void>;
}

export function RecordReadingPanel({ assets, windows, readings, onSaved }: RecordReadingPanelProps) {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const assetCode = searchParams.get('asset');
  const selectedAsset = useMemo(() => findAssetByCode(assets, assetCode), [assets, assetCode]);
  const [form, setForm] = useState<EnvironmentalReadingFormData>({
    assetId: selectedAsset?.id ?? '',
    temperature: '' as unknown as number,
    source: assetCode ? 'qr' : 'portal',
  });
  const [saving, setSaving] = useState(false);
  const [createdExcursion, setCreatedExcursion] = useState<EnvironmentalExcursion | null>(null);
  const [lastSuccess, setLastSuccess] = useState<EnvironmentalReading | null>(null);

  useEffect(() => {
    if (selectedAsset) {
      setForm((prev) => ({ ...prev, assetId: selectedAsset.id, source: assetCode ? 'qr' : 'portal' }));
    }
  }, [selectedAsset, assetCode]);

  const assetWindows = useMemo(
    () => windows.filter((window) => window.assetId === selectedAsset?.id && window.active),
    [windows, selectedAsset?.id],
  );
  const currentWindow = useMemo(() => resolveCurrentWindow(assetWindows), [assetWindows]);
  const assetReadings = useMemo(
    () => readings.filter((reading) => reading.assetId === selectedAsset?.id),
    [readings, selectedAsset?.id],
  );
  const latestReading = useMemo(() => getLatestEffectiveReading(assetReadings), [assetReadings]);

  const previewStatus = selectedAsset && form.temperature !== ('' as unknown as number)
    ? previewReadingStatus(Number(form.temperature), form.humidity, selectedAsset)
    : null;

  const saveReading = async () => {
    if (!user || !selectedAsset) return;
    const parsed = environmentalReadingFormSchema.safeParse({
      ...form,
      assetId: selectedAsset.id,
      monitoringWindowId: currentWindow?.id,
      source: assetCode ? 'qr' : 'portal',
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Please complete required fields');
      return;
    }

    setSaving(true);
    const staff = await resolveStaffContext(user);
    const result = await createEnvironmentalReading(staff, parsed.data);
    setSaving(false);

    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to save reading');
      return;
    }

    setLastSuccess(result.data.reading);
    setForm({ assetId: selectedAsset.id, temperature: '' as unknown as number, source: assetCode ? 'qr' : 'portal' });

    if (result.data.excursion) {
      setCreatedExcursion(result.data.excursion);
      toast.error('OUT OF RANGE — excursion opened');
    } else {
      toast.success('Reading saved — IN RANGE');
    }

    await onSaved();
  };

  if (!selectedAsset) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Select an asset from the QR link or Assets page to record a reading.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{selectedAsset.assetName}</CardTitle>
          <p className="text-sm text-muted-foreground">{selectedAsset.assetCode} · {selectedAsset.location ?? '—'}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Acceptable Range</p>
              <p className="font-medium">{formatEnvironmentalRange(selectedAsset.minTemperature, selectedAsset.maxTemperature)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Current Window</p>
              <p className="font-medium">{currentWindow ? `${currentWindow.windowName} (${currentWindow.startTime.slice(0, 5)}–${currentWindow.endTime.slice(0, 5)})` : 'No active window'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last Reading</p>
              <p className="font-medium">{latestReading ? `${latestReading.temperature}°C` : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last Status</p>
              <p className="font-medium">{latestReading ? ENVIRONMENTAL_READING_STATUS_LABELS[latestReading.calculatedStatus] : 'NO READING'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Record Reading</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="env-temperature">Temperature (°C) *</Label>
            <Input
              id="env-temperature"
              type="number"
              inputMode="decimal"
              step="0.1"
              className="text-lg"
              value={form.temperature === ('' as unknown as number) ? '' : form.temperature}
              onChange={(e) => setForm((prev) => ({ ...prev, temperature: e.target.value === '' ? ('' as unknown as number) : Number(e.target.value) }))}
            />
          </div>
          {selectedAsset.humidityRequired && (
            <div>
              <Label htmlFor="env-humidity">Humidity (%)</Label>
              <Input
                id="env-humidity"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={form.humidity ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, humidity: e.target.value === '' ? undefined : Number(e.target.value) }))}
              />
            </div>
          )}
          <div>
            <Label htmlFor="env-comment">Comment</Label>
            <Textarea
              id="env-comment"
              rows={2}
              value={form.comment ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, comment: e.target.value }))}
            />
          </div>
          {previewStatus && (
            <Badge variant={previewStatus === 'in_range' ? 'success' : 'destructive'} className="text-sm">
              {ENVIRONMENTAL_READING_STATUS_LABELS[previewStatus]}
            </Badge>
          )}
          <Button className="w-full h-12 text-base" onClick={() => void saveReading()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Reading'}
          </Button>
        </CardContent>
      </Card>

      {lastSuccess && lastSuccess.calculatedStatus === 'in_range' && !createdExcursion && (
        <Card className="border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20">
          <CardContent className="py-4">
            <p className="font-semibold text-emerald-800 dark:text-emerald-300">Reading saved successfully</p>
            <p className="text-sm">{lastSuccess.temperature}°C · IN RANGE</p>
          </CardContent>
        </Card>
      )}

      {createdExcursion && (
        <ExcursionWorkflowPanel excursion={createdExcursion} asset={selectedAsset} onUpdated={onSaved} />
      )}
    </div>
  );
}
