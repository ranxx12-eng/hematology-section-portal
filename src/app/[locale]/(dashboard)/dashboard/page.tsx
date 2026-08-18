'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { fetchCmsAdminState, fetchPortalContentAdmin } from '@/lib/clinical/cms-admin';
import { fetchDefaultDashboardWidgets } from '@/lib/clinical/dashboard-layouts';
import { fetchDashboardStats, fetchDashboardWidgetData, type DashboardWidgetData } from '@/lib/clinical/reports-data';
import { fetchSystemSettings } from '@/lib/clinical/system-settings';
import { CmsDashboardSections } from '@/components/dashboard/cms-dashboard-sections';
import { DashboardWidgets } from '@/components/dashboard/dashboard-widgets';
import type { SystemSettings, DashboardStats } from '@/types';
import type { DashboardWidgetType } from '@/types/modules';

export default function DashboardPage() {
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState({ appTitle: 'Hematology Section Portal' });
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [widgetData, setWidgetData] = useState<DashboardWidgetData | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [enabledWidgets, setEnabledWidgets] = useState<DashboardWidgetType[]>([]);
  const [fallbackTitle, setFallbackTitle] = useState('Central Laboratory');
  const [fallbackSubtitle, setFallbackSubtitle] = useState<string | undefined>();

  useEffect(() => {
    void (async () => {
      const [settingsResult, cmsResult, contentResult, widgets, dashboardStats] = await Promise.all([
        fetchSystemSettings(),
        fetchCmsAdminState(),
        fetchPortalContentAdmin(),
        fetchDefaultDashboardWidgets(),
        fetchDashboardStats(),
      ]);

      setSettings(settingsResult.settings);
      setBranding(cmsResult.data.branding);
      setFallbackTitle(cmsResult.data.homepage.heroTitle || settingsResult.settings?.laboratoryName || 'Central Laboratory');
      setFallbackSubtitle(cmsResult.data.homepage.heroSubtitle || settingsResult.settings?.sectionName);
      setEnabledWidgets(widgets.map((w) => w.type));
      setStats(dashboardStats);

      const data = await fetchDashboardWidgetData(settingsResult.settings, contentResult.data.dashboardImages);
      setWidgetData(data);
      setLoading(false);
    })();
  }, []);

  if (loading || !widgetData || !stats || !settings) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CmsDashboardSections
        fallbackTitle={fallbackTitle}
        fallbackSubtitle={fallbackSubtitle}
        brandingTitle={branding.appTitle}
      />
      <DashboardWidgets enabledWidgets={enabledWidgets} db={widgetData} stats={stats} locale={locale} />
    </div>
  );
}
