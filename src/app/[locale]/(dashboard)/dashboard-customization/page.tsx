'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { GripVertical, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/providers/auth-provider';
import { fetchDashboardLayout, saveDashboardLayout } from '@/lib/clinical/dashboard-layouts';
import { ALL_DASHBOARD_WIDGET_TYPES, createDefaultDashboardWidgetLayout, getWidgetLabel, normalizeDashboardWidgets } from '@/lib/dashboard/widget-registry';
import { generateId } from '@/lib/utils';
import type { DashboardWidget, DashboardWidgetType } from '@/types/modules';

export default function DashboardCustomizationPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can, user } = useAuth();
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadLayout = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const result = await fetchDashboardLayout(user.id);
    const layoutWidgets = result.data?.widgets ?? [];
    setWidgets(
      layoutWidgets.length > 0
        ? normalizeDashboardWidgets(layoutWidgets)
        : createDefaultDashboardWidgetLayout(),
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadLayout();
  }, [loadLayout]);

  const accessDenied = !can('settings.manage');

  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  if (accessDenied) return null;

  const enabledTypes = new Set(widgets.map((w) => w.type));
  const available = ALL_DASHBOARD_WIDGET_TYPES.filter((t) => !enabledTypes.has(t));

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

  const saveLayout = async () => {
    if (!user) return;
    setSaving(true);
    const layoutResult = await saveDashboardLayout(user.id, { widgets });
    setSaving(false);
    if (layoutResult.error) {
      toast.error(layoutResult.error);
      return;
    }
    toast.success('Dashboard layout saved');
    void loadLayout();
  };

  const addWidget = (type: DashboardWidgetType) => {
    setWidgets([...widgets, { id: generateId(), type, w: 3, h: 1, x: 0, y: widgets.length }]);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Customization</h1>
          <p className="text-muted-foreground">Add, remove, and reorder dashboard widgets</p>
        </div>
        <Button onClick={saveLayout} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Save className="h-4 w-4 me-2" />}
          {tc('save')}
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Active Widgets</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {widgets.map((w, i) => (
              <div key={w.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium">{getWidgetLabel(w.type)}</span>
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
            {ALL_DASHBOARD_WIDGET_TYPES.map((type) => (
              <div key={type} className="flex items-center justify-between rounded-lg border border-border p-3">
                <Label>{getWidgetLabel(type)}</Label>
                <Switch checked={enabledTypes.has(type)} onCheckedChange={(v) => toggleWidget(type, v)} />
              </div>
            ))}
            {available.length > 0 && (
              <div className="pt-4 border-t border-border">
                <p className="text-sm font-medium mb-2">Quick Add</p>
                <div className="flex flex-wrap gap-2">
                  {available.map((t) => (
                    <Button key={t} size="sm" variant="outline" onClick={() => addWidget(t)}><Plus className="h-3 w-3 me-1" />{getWidgetLabel(t)}</Button>
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
