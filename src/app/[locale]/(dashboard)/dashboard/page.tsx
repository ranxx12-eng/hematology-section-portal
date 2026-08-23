'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { fetchCmsAdminState } from '@/lib/clinical/cms-admin';
import { resolveDashboardWidgetTypes } from '@/lib/clinical/dashboard-layouts';
import { fetchOperationalDashboardMetrics, type OperationalDashboardMetrics } from '@/lib/clinical/reports-data';
import { fetchSystemSettings } from '@/lib/clinical/system-settings';
import { CmsDashboardSections } from '@/components/dashboard/cms-dashboard-sections';
import { DashboardWidgets } from '@/components/dashboard/dashboard-widgets';
import type { DashboardWidgetType } from '@/types/modules';

export default function DashboardPage() {
  const locale = useLocale();
  const { user, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState({ appTitle: 'Hematology Section Portal' });
  const [metrics, setMetrics] = useState<OperationalDashboardMetrics | null>(null);
  const [enabledWidgets, setEnabledWidgets] = useState<DashboardWidgetType[]>([]);
  const [fallbackTitle, setFallbackTitle] = useState('Central Laboratory');
  const [fallbackSubtitle, setFallbackSubtitle] = useState<string | undefined>();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    void (async () => {
      const [settingsResult, cmsResult, widgetTypes, dashboardMetrics] = await Promise.all([
        fetchSystemSettings(),
        fetchCmsAdminState(),
        resolveDashboardWidgetTypes(user.id),
        fetchOperationalDashboardMetrics(),
      ]);

      setBranding(cmsResult.data.branding);
      setFallbackTitle(cmsResult.data.homepage.heroTitle || settingsResult.settings?.laboratoryName || 'Central Laboratory');
      setFallbackSubtitle(cmsResult.data.homepage.heroSubtitle || settingsResult.settings?.sectionName);
      setEnabledWidgets(widgetTypes);
      setMetrics(dashboardMetrics);
      setLoading(false);
    })();
  }, [authLoading, user]);

  if (authLoading || loading || !metrics || !user) {
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
      <DashboardWidgets enabledWidgets={enabledWidgets} metrics={metrics} locale={locale} />
    </div>
  );
}
