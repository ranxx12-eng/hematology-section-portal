'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronRight, Loader2, Thermometer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/providers/auth-provider';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import { createEnvironmentalReading } from '@/lib/clinical/environmental-monitoring';
import {
  findAssetByCode,
  getWindowInstanceComplianceStatus,
  getOperationalDayKey,
  resolveCurrentWindow,
} from '@/lib/environmental-monitoring/compliance';
import { formatEnvironmentalRange } from '@/lib/environmental-monitoring/permissions';
import { ENVIRONMENTAL_READING_STATUS_LABELS, OUT_OF_RANGE_PARAMETER_LABELS } from '@/lib/environmental-monitoring/constants';
import {
  environmentalReadingFormSchema,
  getLatestEffectiveReading,
  previewOutOfRangeParameters,
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

function emptyReadingForm(assetId: string, source: 'qr' | 'portal'): EnvironmentalReadingFormData {
  return {
    assetId,
    temperature: '' as unknown as number,
    source,
  };
}

export function RecordReadingPanel({ assets, windows, readings, onSaved }: RecordReadingPanelProps) {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const assetCodeFromUrl = searchParams.get('asset');
  const urlAsset = useMemo(
    () => findAssetByCode(assets, assetCodeFromUrl),
    [assets, assetCodeFromUrl],
  );
  const activeAssets = useMemo(
    () => assets.filter((asset) => asset.active).sort((a, b) => a.assetCode.localeCompare(b.assetCode)),
    [assets],
  );

  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [readingSource, setReadingSource] = useState<'qr' | 'portal'>('portal');
  const [form, setForm] = useState<EnvironmentalReadingFormData>(emptyReadingForm('', 'portal'));
  const [saving, setSaving] = useState(false);
  const [createdExcursion, setCreatedExcursion] = useState<EnvironmentalExcursion | null>(null);
  const [lastSuccess, setLastSuccess] = useState<EnvironmentalReading | null>(null);

  const selectedAsset = useMemo(
    () => activeAssets.find((asset) => asset.id === selectedAssetId),
    [activeAssets, selectedAssetId],
  );

  useEffect(() => {
    if (urlAsset) {
      setSelectedAssetId(urlAsset.id);
      setReadingSource('qr');
      setForm(emptyReadingForm(urlAsset.id, 'qr'));
      setCreatedExcursion(null);
      setLastSuccess(null);
    }
  }, [urlAsset]);

  const selectAsset = (asset: EnvironmentalAsset) => {
    const source = urlAsset?.id === asset.id ? 'qr' : 'portal';
    setSelectedAssetId(asset.id);
    setReadingSource(source);
    setForm(emptyReadingForm(asset.id, source));
    setCreatedExcursion(null);
    setLastSuccess(null);
  };

  const changeAsset = () => {
    setSelectedAssetId(null);
    setForm(emptyReadingForm('', 'portal'));
    setCreatedExcursion(null);
    setLastSuccess(null);
  };

  const assetWindows = useMemo(
    () => windows.filter((window) => window.assetId === selectedAsset?.id && window.active),
    [windows, selectedAsset?.id],
  );
  const now = useMemo(() => new Date(), [readings.length, selectedAssetId]);
  const currentWindow = useMemo(() => resolveCurrentWindow(assetWindows, now), [assetWindows, now]);
  const assetReadings = useMemo(
    () => readings.filter((reading) => reading.assetId === selectedAsset?.id),
    [readings, selectedAsset?.id],
  );
  const latestReading = useMemo(() => getLatestEffectiveReading(assetReadings), [assetReadings]);

  const dueStatus = useMemo(() => {
    if (!currentWindow) return 'No active shift';
    const operationalDayKey = getOperationalDayKey(now, currentWindow);
    const status = getWindowInstanceComplianceStatus(currentWindow, operationalDayKey, assetReadings, now);
    return status.toUpperCase();
  }, [currentWindow, assetReadings, now]);

  const hasTemperature = form.temperature !== ('' as unknown as number);
  const previewStatus = selectedAsset && hasTemperature
    ? previewReadingStatus(Number(form.temperature), form.humidity, selectedAsset)
    : null;
  const previewParameters = selectedAsset && hasTemperature
    ? previewOutOfRangeParameters(Number(form.temperature), form.humidity, selectedAsset)
    : null;

  const saveReading = async () => {
    if (!user || !selectedAsset) return;

    if (selectedAsset.humidityRequired && form.humidity == null) {
      toast.error('Humidity is required for this asset');
      return;
    }

    const parsed = environmentalReadingFormSchema.safeParse({
      ...form,
      assetId: selectedAsset.id,
      monitoringWindowId: currentWindow?.id,
      source: readingSource,
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
    setForm(emptyReadingForm(selectedAsset.id, readingSource));

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
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Select Monitoring Area</h2>
          <p className="text-sm text-muted-foreground">
            Choose the refrigerator, room, or storage area you are checking.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {activeAssets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => selectAsset(asset)}
              className="flex min-h-[4.5rem] items-center justify-between rounded-xl border bg-card px-4 py-4 text-start shadow-sm transition-colors hover:border-primary hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-semibold leading-tight">{asset.assetName}</p>
                <p className="text-sm text-muted-foreground">{asset.assetCode}{asset.location ? ` · ${asset.location}` : ''}</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
        {activeAssets.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No active monitoring assets are configured.
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Record Reading</h2>
          <p className="text-sm text-muted-foreground">
            {selectedAsset.assetName} · {selectedAsset.assetCode}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={changeAsset}>
          Change Asset
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Thermometer className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-xl">{selectedAsset.assetName}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {selectedAsset.assetCode} · {selectedAsset.location ?? '—'}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Acceptable Temperature Range</p>
              <p className="font-medium">{formatEnvironmentalRange(selectedAsset.minTemperature, selectedAsset.maxTemperature)}</p>
            </div>
            {selectedAsset.humidityRequired && selectedAsset.humidityMin != null && selectedAsset.humidityMax != null && (
              <div>
                <p className="text-xs text-muted-foreground">Acceptable Humidity Range</p>
                <p className="font-medium">{selectedAsset.humidityMin}–{selectedAsset.humidityMax}%</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Current Shift</p>
              <p className="font-medium">
                {currentWindow
                  ? `${currentWindow.windowName} (${currentWindow.startTime.slice(0, 5)}–${currentWindow.endTime.slice(0, 5)})`
                  : 'No active shift'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Current Due Status</p>
              <p className="font-medium">{dueStatus}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Last Reading</p>
              <p className="font-medium">
                {latestReading
                  ? `${latestReading.temperature}°C${latestReading.humidity != null ? ` / ${latestReading.humidity}% RH` : ''} · ${ENVIRONMENTAL_READING_STATUS_LABELS[latestReading.calculatedStatus]}`
                  : 'No reading yet'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle>Enter Measurement</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="env-temperature">Temperature (°C) *</Label>
            <Input
              id="env-temperature"
              type="number"
              inputMode="decimal"
              step="0.1"
              className="mt-1 text-lg"
              value={form.temperature === ('' as unknown as number) ? '' : form.temperature}
              onChange={(e) => setForm((prev) => ({ ...prev, temperature: e.target.value === '' ? ('' as unknown as number) : Number(e.target.value) }))}
            />
          </div>
          {selectedAsset.humidityRequired && (
            <div>
              <Label htmlFor="env-humidity">Humidity (%) *</Label>
              <Input
                id="env-humidity"
                type="number"
                inputMode="decimal"
                step="0.1"
                className="mt-1 text-lg"
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
              className="mt-1"
              value={form.comment ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, comment: e.target.value }))}
            />
          </div>
          {previewStatus && (
            <div className="space-y-1">
              <Badge variant={previewStatus === 'in_range' ? 'success' : 'destructive'} className="text-sm">
                {ENVIRONMENTAL_READING_STATUS_LABELS[previewStatus]}
              </Badge>
              {previewParameters && (
                <p className="text-sm text-destructive">{OUT_OF_RANGE_PARAMETER_LABELS[previewParameters]}</p>
              )}
            </div>
          )}
          <Button className="h-12 w-full text-base" onClick={() => void saveReading()} disabled={saving}>
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
        <ExcursionWorkflowPanel excursion={createdExcursion} asset={selectedAsset} currentWindow={currentWindow} onUpdated={onSaved} />
      )}
    </div>
  );
}
