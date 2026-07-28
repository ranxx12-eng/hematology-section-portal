'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { appendAuditLog } from '@/lib/page-utils';
import type { SystemSettings } from '@/types';

export default function SettingsPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loaded = getMockDatabase().settings;
    setSettings({
      ...loaded,
      rejectedSampleRetentionDays: loaded.rejectedSampleRetentionDays ?? 3,
    });
  }, []);

  if (!can('settings.manage')) {
    router.replace(`/${locale}/unauthorized`);
    return null;
  }

  if (!settings) return null;

  const update = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev);
  };

  const handleSave = () => {
    if (!settings) return;
    setSaving(true);
    const db = getMockDatabase();
    db.settings = settings;
    if (user) appendAuditLog(db, user.id, 'update', 'settings');
    saveMockDatabase(db);
    setSaving(false);
    toast.success('Settings saved');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">{tc('settings')}</h1>
        <p className="text-muted-foreground">System configuration</p>
      </div>

      <Card>
        <CardHeader><CardTitle>General</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Laboratory Name</Label>
            <Input value={settings.laboratoryName} onChange={(e) => update('laboratoryName', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Section Name</Label>
            <Input value={settings.sectionName} onChange={(e) => update('sectionName', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Default Language</Label>
            <Select value={settings.defaultLanguage} onValueChange={(v) => update('defaultLanguage', v as 'en' | 'ar')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Input value={settings.timezone} onChange={(e) => update('timezone', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Date Format</Label>
              <Input value={settings.dateFormat} onChange={(e) => update('dateFormat', e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>TAT Targets (minutes)</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(Object.keys(settings.tatTargets) as (keyof SystemSettings['tatTargets'])[]).map((key) => (
            <div key={key} className="space-y-2">
              <Label className="capitalize">{key}</Label>
              <Input
                type="number"
                value={settings.tatTargets[key]}
                onChange={(e) => update('tatTargets', { ...settings.tatTargets, [key]: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Evaluation Weights</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(Object.keys(settings.evaluationWeights) as (keyof SystemSettings['evaluationWeights'])[]).map((key) => (
            <div key={key} className="space-y-2">
              <Label className="capitalize">{key}</Label>
              <Input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={settings.evaluationWeights[key]}
                onChange={(e) => update('evaluationWeights', { ...settings.evaluationWeights, [key]: parseFloat(e.target.value) || 0 })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sample Rejection</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Label>Rejected Sample Retention Period (calendar days)</Label>
          <Input
            type="number"
            min={1}
            value={settings.rejectedSampleRetentionDays}
            onChange={(e) => update('rejectedSampleRetentionDays', parseInt(e.target.value, 10) || 3)}
          />
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? tc('loading') : tc('save')}
      </Button>
    </div>
  );
}
