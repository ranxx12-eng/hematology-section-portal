'use client';

import { useState, useEffect } from 'react';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/components/providers/auth-provider';
import { fetchSystemSettings, saveSystemSettings } from '@/lib/clinical/system-settings';
import type { SystemSettings } from '@/types';

export default function SettingsPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can } = useAuth();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchSystemSettings().then(({ settings: loaded, error: loadError }) => {
      setSettings(loaded);
      setError(loadError);
      setLoading(false);
    });
  }, []);

  const accessDenied = !can('settings.manage');

  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  if (accessDenied) return null;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) return null;

  const handleSave = async () => {
    setSaving(true);
    const result = await saveSystemSettings(settings);
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Settings saved');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">{tc('settings')}</h1>
        <p className="text-muted-foreground">Laboratory, TAT, and evaluation configuration stored in Supabase</p>
      </div>

      {error && <EmptyState title="Partial load warning" description={error} />}

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="tat">TAT & Evaluation</TabsTrigger>
          <TabsTrigger value="extended">Extended</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>Department</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Laboratory Name</Label><Input value={settings.laboratoryName} onChange={(e) => setSettings({ ...settings, laboratoryName: e.target.value })} /></div>
              <div className="space-y-2"><Label>Section Name</Label><Input value={settings.sectionName} onChange={(e) => setSettings({ ...settings, sectionName: e.target.value })} /></div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Timezone</Label><Input value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} /></div>
                <div className="space-y-2"><Label>Date Format</Label><Input value={settings.dateFormat} onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Default Language</Label>
                <Select value={settings.defaultLanguage} onValueChange={(v) => setSettings({ ...settings, defaultLanguage: v as 'en' | 'ar' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="ar">العربية</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Rejected Sample Retention (days)</Label><Input type="number" min={1} value={settings.rejectedSampleRetentionDays} onChange={(e) => setSettings({ ...settings, rejectedSampleRetentionDays: parseInt(e.target.value, 10) || 3 })} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tat" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>TAT Targets (minutes)</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(Object.keys(settings.tatTargets) as (keyof SystemSettings['tatTargets'])[]).map((key) => (
                <div key={key} className="space-y-2"><Label className="capitalize">{key}</Label>
                  <Input type="number" value={settings.tatTargets[key]} onChange={(e) => setSettings({ ...settings, tatTargets: { ...settings.tatTargets, [key]: parseInt(e.target.value, 10) || 0 } })} />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Evaluation Weights</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(Object.keys(settings.evaluationWeights) as (keyof SystemSettings['evaluationWeights'])[]).map((key) => (
                <div key={key} className="space-y-2"><Label className="capitalize">{key}</Label>
                  <Input type="number" step="0.05" min="0" max="1" value={settings.evaluationWeights[key]} onChange={(e) => setSettings({ ...settings, evaluationWeights: { ...settings.evaluationWeights, [key]: parseFloat(e.target.value) || 0 } })} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="extended" className="mt-4">
          <EmptyState title="Extended settings pending schema" description="Hospital branding, theme colors, backup policy, and email templates require additional system_settings keys or CMS tables." />
        </TabsContent>
      </Tabs>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tc('save')}
      </Button>
    </div>
  );
}
