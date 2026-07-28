'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { GripVertical, Plus, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { appendAuditLog } from '@/lib/page-utils';
import { generateId } from '@/lib/utils';
import type { DashboardWidget, DashboardWidgetType } from '@/types/modules';

const WIDGET_LABELS: Record<DashboardWidgetType, string> = {
  stats_critical: 'Critical Values Stat',
  stats_rejections: 'Sample Rejections Stat',
  stats_pending: 'Pending Samples Stat',
  stats_tasks: 'Open Tasks Stat',
  tat_summary: 'TAT Performance',
  quick_links: 'Quick Access Links',
  announcements: 'Pinned Announcements',
  calendar: 'Upcoming Events',
  tasks_summary: 'Task Summary',
};

const ALL_WIDGETS: DashboardWidgetType[] = Object.keys(WIDGET_LABELS) as DashboardWidgetType[];

export default function DashboardCustomizationPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const [db, setDb] = useState(() => getMockDatabase());
  const userId = user?.id ?? 'default';
  const layoutIdx = db.dashboardLayouts.findIndex((l) => l.userId === userId);
  const [widgets, setWidgets] = useState<DashboardWidget[]>(() => {
    const dbInit = getMockDatabase();
    const idx = dbInit.dashboardLayouts.findIndex((l) => l.userId === userId);
    return idx >= 0 ? [...dbInit.dashboardLayouts[idx].widgets] : [];
  });
  const refresh = useCallback(() => setDb(getMockDatabase()), []);

  if (!can('settings.manage')) {
    router.replace(`/${locale}/unauthorized`);
    return null;
  }

  const enabledTypes = new Set(widgets.map((w) => w.type));
  const available = ALL_WIDGETS.filter((t) => !enabledTypes.has(t));

  const toggleWidget = (type: DashboardWidgetType, enabled: boolean) => {
    if (enabled) {
      setWidgets([...widgets, { id: generateId(), type, w: 3, h: 1, x: 0, y: widgets.length }]);
    } else {
      setWidgets(widgets.filter((w) => w.type !== type));
    }
  };

  const removeWidget = (id: string) => setWidgets(widgets.filter((w) => w.id !== id));

  const moveWidget = (index: number, direction: -1 | 1) => {
    const next = [...widgets];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setWidgets(next);
  };

  const saveLayout = () => {
    if (!user) return;
    const layout = { userId: user.id, widgets, updatedAt: new Date().toISOString() };
    if (layoutIdx >= 0) db.dashboardLayouts[layoutIdx] = layout;
    else db.dashboardLayouts.push(layout);
    db.cmsAdmin.dashboardWidgets = widgets.map((w, i) => ({
      type: w.type,
      enabled: true,
      sortOrder: i,
    }));
    appendAuditLog(db, user.id, 'update', 'dashboard_layout');
    saveMockDatabase(db);
    refresh();
    toast.success('Dashboard layout saved');
  };

  const addWidget = (type: DashboardWidgetType) => {
    setWidgets([...widgets, { id: generateId(), type, w: 3, h: 1, x: 0, y: widgets.length }]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Customization</h1>
          <p className="text-muted-foreground">Add, remove, and reorder dashboard widgets</p>
        </div>
        <Button onClick={saveLayout}><Save className="h-4 w-4 me-2" />Save Layout</Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Active Widgets</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {widgets.map((w, i) => (
              <div key={w.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium">{WIDGET_LABELS[w.type]}</span>
                <Button size="sm" variant="ghost" onClick={() => moveWidget(i, -1)} disabled={i === 0}>↑</Button>
                <Button size="sm" variant="ghost" onClick={() => moveWidget(i, 1)} disabled={i === widgets.length - 1}>↓</Button>
                <Button size="sm" variant="ghost" onClick={() => removeWidget(w.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
            {widgets.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No widgets enabled</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Available Widgets</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {ALL_WIDGETS.map((type) => (
              <div key={type} className="flex items-center justify-between rounded-lg border border-border p-3">
                <Label>{WIDGET_LABELS[type]}</Label>
                <Switch checked={enabledTypes.has(type)} onCheckedChange={(v) => toggleWidget(type, v)} />
              </div>
            ))}
            {available.length > 0 && (
              <div className="pt-4 border-t border-border">
                <p className="text-sm font-medium mb-2">Quick Add</p>
                <div className="flex flex-wrap gap-2">
                  {available.map((t) => (
                    <Button key={t} size="sm" variant="outline" onClick={() => addWidget(t)}><Plus className="h-3 w-3 me-1" />{WIDGET_LABELS[t]}</Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
