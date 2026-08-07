'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { appendAuditLog } from '@/lib/page-utils';
import type { SystemSettings } from '@/types';
import type { ExtendedSettings } from '@/types/modules';

export default function SettingsPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [extended, setExtended] = useState<ExtendedSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const db = getMockDatabase();
    setSettings({ ...db.settings, rejectedSampleRetentionDays: db.settings.rejectedSampleRetentionDays ?? 3 });
    setExtended(db.extendedSettings);
  }, []);

  const accessDenied = !can('settings.manage');


  useRouteReplace(accessDenied, `/${locale}/unauthorized`);


  if (accessDenied) return null;

  if (!settings || !extended) return null;

  const handleSave = () => {
    setSaving(true);
    const db = getMockDatabase();
    db.settings = settings;
    db.extendedSettings = extended;
    if (user) appendAuditLog(db, user.id, 'update', 'settings');
    saveMockDatabase(db);
    setSaving(false);
    toast.success('Settings saved');
  };

  const updateExt = <K extends keyof ExtendedSettings>(key: K, value: ExtendedSettings[K]) => {
    setExtended((prev) => prev ? { ...prev, [key]: value } : prev);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">{tc('settings')}</h1>
        <p className="text-muted-foreground">Hospital, department, theme, notifications, and system configuration</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="hospital">Hospital</TabsTrigger>
          <TabsTrigger value="theme">Theme</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
          <TabsTrigger value="tat">TAT & Evaluation</TabsTrigger>
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hospital" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>Hospital Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Hospital Name</Label><Input value={extended.hospitalName} onChange={(e) => updateExt('hospitalName', e.target.value)} /></div>
              <div className="space-y-2"><Label>Address</Label><Input value={extended.hospitalAddress} onChange={(e) => updateExt('hospitalAddress', e.target.value)} /></div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Department Phone</Label><Input value={extended.departmentPhone} onChange={(e) => updateExt('departmentPhone', e.target.value)} /></div>
                <div className="space-y-2"><Label>Department Email</Label><Input value={extended.departmentEmail} onChange={(e) => updateExt('departmentEmail', e.target.value)} /></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="theme" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>Color Theme</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Primary Color</Label><Input type="color" value={extended.primaryColor} onChange={(e) => updateExt('primaryColor', e.target.value)} /></div>
              <div className="space-y-2"><Label>Secondary Color</Label><Input type="color" value={extended.secondaryColor} onChange={(e) => updateExt('secondaryColor', e.target.value)} /></div>
              <div className="space-y-2"><Label>Accent Color</Label><Input type="color" value={extended.accentColor} onChange={(e) => updateExt('accentColor', e.target.value)} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>Email Templates</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {extended.emailTemplates.map((tpl, i) => (
                <div key={tpl.id} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="space-y-2"><Label>Template Name</Label><Input value={tpl.name} onChange={(e) => { const t = [...extended.emailTemplates]; t[i] = { ...tpl, name: e.target.value }; updateExt('emailTemplates', t); }} /></div>
                  <div className="space-y-2"><Label>Subject</Label><Input value={tpl.subject} onChange={(e) => { const t = [...extended.emailTemplates]; t[i] = { ...tpl, subject: e.target.value }; updateExt('emailTemplates', t); }} /></div>
                  <div className="space-y-2"><Label>Body</Label><Textarea rows={3} value={tpl.body} onChange={(e) => { const t = [...extended.emailTemplates]; t[i] = { ...tpl, body: e.target.value }; updateExt('emailTemplates', t); }} /></div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>Backup & Retention</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2"><Switch checked={extended.backupEnabled} onCheckedChange={(v) => updateExt('backupEnabled', v)} /><Label>Enable Automatic Backup</Label></div>
              <div className="space-y-2"><Label>Backup Frequency</Label>
                <Select value={extended.backupFrequency} onValueChange={(v) => updateExt('backupFrequency', v as ExtendedSettings['backupFrequency'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Audit Log Retention (days)</Label><Input type="number" value={extended.auditRetentionDays} onChange={(e) => updateExt('auditRetentionDays', parseInt(e.target.value, 10) || 365)} /></div>
                <div className="space-y-2"><Label>Document Retention (days)</Label><Input type="number" value={extended.documentRetentionDays} onChange={(e) => updateExt('documentRetentionDays', parseInt(e.target.value, 10) || 1825)} /></div>
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
      </Tabs>

      <Button onClick={handleSave} disabled={saving}>{saving ? tc('loading') : tc('save')}</Button>
    </div>
  );
}
