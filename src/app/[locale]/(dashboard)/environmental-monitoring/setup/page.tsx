'use client';

import { useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { Loader2, Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { useEnvironmentalMonitoring } from '@/hooks/use-environmental-monitoring';
import { useAuth } from '@/components/providers/auth-provider';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { canManageEnvironmentalAssets } from '@/lib/environmental-monitoring/permissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import { upsertEnvironmentalAsset, upsertEnvironmentalWindow } from '@/lib/clinical/environmental-monitoring';
import {
  assetToForm,
  environmentalAssetFormSchema,
  environmentalWindowFormSchema,
  windowToForm,
  type EnvironmentalAssetFormData,
  type EnvironmentalWindowFormData,
} from '@/lib/environmental-monitoring/schema';
import { ENVIRONMENTAL_ASSET_TYPE_LABELS, ENVIRONMENTAL_ASSET_TYPES } from '@/lib/environmental-monitoring/constants';
import type { EnvironmentalAsset, EnvironmentalMonitoringWindow } from '@/types/environmental-monitoring';

const emptyAssetForm = (): EnvironmentalAssetFormData => ({
  assetCode: '',
  assetName: '',
  assetType: 'refrigerator',
  location: '',
  serialNumber: '',
  description: '',
  minTemperature: 2,
  maxTemperature: 8,
  humidityRequired: false,
  monitoringFrequency: 'daily',
  active: true,
});

const emptyWindowForm = (): EnvironmentalWindowFormData => ({
  windowName: '',
  startTime: '06:00',
  endTime: '10:00',
  required: true,
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  active: true,
});

export default function EnvironmentalSetupPage() {
  const locale = useLocale();
  const { can, user } = useAuth();
  const accessDenied = !canManageEnvironmentalAssets(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);
  const { assets, windows, loading, reload } = useEnvironmentalMonitoring();
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [windowDialogOpen, setWindowDialogOpen] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editingWindowId, setEditingWindowId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [assetForm, setAssetForm] = useState<EnvironmentalAssetFormData>(emptyAssetForm());
  const [windowForm, setWindowForm] = useState<EnvironmentalWindowFormData>(emptyWindowForm());
  const [saving, setSaving] = useState(false);

  const windowsByAsset = useMemo(() => {
    const map: Record<string, EnvironmentalMonitoringWindow[]> = {};
    for (const window of windows) {
      map[window.assetId] = [...(map[window.assetId] ?? []), window];
    }
    return map;
  }, [windows]);

  const openAssetEditor = (asset?: EnvironmentalAsset) => {
    setEditingAssetId(asset?.id ?? null);
    setAssetForm(asset ? assetToForm(asset) : emptyAssetForm());
    setAssetDialogOpen(true);
  };

  const openWindowEditor = (assetId: string, window?: EnvironmentalMonitoringWindow) => {
    setSelectedAssetId(assetId);
    setEditingWindowId(window?.id ?? null);
    setWindowForm(window ? windowToForm(window) : emptyWindowForm());
    setWindowDialogOpen(true);
  };

  const saveAsset = async () => {
    if (!user) return;
    const parsed = environmentalAssetFormSchema.safeParse(assetForm);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid asset form');
      return;
    }
    setSaving(true);
    const staff = await resolveStaffContext(user);
    const result = await upsertEnvironmentalAsset(staff, parsed.data, editingAssetId ?? undefined);
    setSaving(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success('Asset saved');
      setAssetDialogOpen(false);
      await reload();
    }
  };

  const saveWindow = async () => {
    if (!selectedAssetId) return;
    const parsed = environmentalWindowFormSchema.safeParse(windowForm);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid window form');
      return;
    }
    setSaving(true);
    const result = await upsertEnvironmentalWindow(parsed.data, selectedAssetId, editingWindowId ?? undefined);
    setSaving(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success('Monitoring window saved');
      setWindowDialogOpen(false);
      await reload();
    }
  };

  if (accessDenied) return null;

  return (
    <PageContentSections
      pageKey="environmental_monitoring"
      fallbackTitle="Setup"
      fallbackSubtitle="Configure monitored assets, acceptable ranges, and monitoring windows"
    >
      <div className="flex justify-end">
        <Button onClick={() => openAssetEditor()}><Plus className="h-4 w-4 me-2" />Add Asset</Button>
      </div>

      {loading && <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}

      {!loading && assets.map((asset) => (
        <Card key={asset.id}>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>{asset.assetName}</CardTitle>
              <p className="text-sm text-muted-foreground">{asset.assetCode} · {ENVIRONMENTAL_ASSET_TYPE_LABELS[asset.assetType]}</p>
            </div>
            <div className="flex gap-2">
              <Badge variant={asset.active ? 'success' : 'secondary'}>{asset.active ? 'Active' : 'Inactive'}</Badge>
              <Button size="sm" variant="outline" onClick={() => openAssetEditor(asset)}><Pencil className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
              <p>Location: {asset.location ?? '—'}</p>
              <p>Range: {asset.minTemperature}°C – {asset.maxTemperature}°C</p>
              <p>Frequency: {asset.monitoringFrequency}</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Monitoring Windows</h3>
                <Button size="sm" variant="outline" onClick={() => openWindowEditor(asset.id)}>Add Window</Button>
              </div>
              <div className="space-y-2">
                {(windowsByAsset[asset.id] ?? []).map((window) => (
                  <div key={window.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                    <div>
                      <p className="font-medium">{window.windowName}</p>
                      <p className="text-muted-foreground">{window.startTime.slice(0, 5)} – {window.endTime.slice(0, 5)} · {window.required ? 'Required' : 'Optional'}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => openWindowEditor(asset.id, window)}><Pencil className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={assetDialogOpen} onOpenChange={setAssetDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingAssetId ? 'Edit Asset' : 'Add Asset'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Asset Code</Label><Input value={assetForm.assetCode} onChange={(e) => setAssetForm((p) => ({ ...p, assetCode: e.target.value }))} /></div>
            <div><Label>Asset Name</Label><Input value={assetForm.assetName} onChange={(e) => setAssetForm((p) => ({ ...p, assetName: e.target.value }))} /></div>
            <div><Label>Asset Type</Label>
              <Select value={assetForm.assetType} onValueChange={(v) => setAssetForm((p) => ({ ...p, assetType: v as EnvironmentalAssetFormData['assetType'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENVIRONMENTAL_ASSET_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{ENVIRONMENTAL_ASSET_TYPE_LABELS[type]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Location</Label><Input value={assetForm.location ?? ''} onChange={(e) => setAssetForm((p) => ({ ...p, location: e.target.value }))} /></div>
            <div><Label>Serial Number</Label><Input value={assetForm.serialNumber ?? ''} onChange={(e) => setAssetForm((p) => ({ ...p, serialNumber: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Min Temperature (°C)</Label><Input type="number" step="0.1" value={assetForm.minTemperature} onChange={(e) => setAssetForm((p) => ({ ...p, minTemperature: Number(e.target.value) }))} /></div>
              <div><Label>Max Temperature (°C)</Label><Input type="number" step="0.1" value={assetForm.maxTemperature} onChange={(e) => setAssetForm((p) => ({ ...p, maxTemperature: Number(e.target.value) }))} /></div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={assetForm.humidityRequired} onChange={(e) => setAssetForm((p) => ({ ...p, humidityRequired: e.target.checked }))} id="humidity-required" />
              <Label htmlFor="humidity-required">Humidity monitoring required</Label>
            </div>
            {assetForm.humidityRequired && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Humidity Min (%)</Label><Input type="number" step="0.1" value={assetForm.humidityMin ?? ''} onChange={(e) => setAssetForm((p) => ({ ...p, humidityMin: e.target.value ? Number(e.target.value) : undefined }))} /></div>
                <div><Label>Humidity Max (%)</Label><Input type="number" step="0.1" value={assetForm.humidityMax ?? ''} onChange={(e) => setAssetForm((p) => ({ ...p, humidityMax: e.target.value ? Number(e.target.value) : undefined }))} /></div>
              </div>
            )}
            <div><Label>Description</Label><Textarea value={assetForm.description ?? ''} onChange={(e) => setAssetForm((p) => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={assetForm.active} onChange={(e) => setAssetForm((p) => ({ ...p, active: e.target.checked }))} id="asset-active" />
              <Label htmlFor="asset-active">Active</Label>
            </div>
            <Button className="w-full" disabled={saving} onClick={() => void saveAsset()}>{saving ? 'Saving…' : 'Save Asset'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={windowDialogOpen} onOpenChange={setWindowDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingWindowId ? 'Edit Window' : 'Add Window'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Window Name</Label><Input value={windowForm.windowName} onChange={(e) => setWindowForm((p) => ({ ...p, windowName: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start Time</Label><Input type="time" value={windowForm.startTime} onChange={(e) => setWindowForm((p) => ({ ...p, startTime: e.target.value }))} /></div>
              <div><Label>End Time</Label><Input type="time" value={windowForm.endTime} onChange={(e) => setWindowForm((p) => ({ ...p, endTime: e.target.value }))} /></div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={windowForm.required} onChange={(e) => setWindowForm((p) => ({ ...p, required: e.target.checked }))} id="window-required" />
              <Label htmlFor="window-required">Required for compliance</Label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={windowForm.active} onChange={(e) => setWindowForm((p) => ({ ...p, active: e.target.checked }))} id="window-active" />
              <Label htmlFor="window-active">Active</Label>
            </div>
            <Button className="w-full" disabled={saving} onClick={() => void saveWindow()}>{saving ? 'Saving…' : 'Save Window'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContentSections>
  );
}
