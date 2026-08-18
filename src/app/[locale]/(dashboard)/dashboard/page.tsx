'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { fetchCmsAdminState, fetchPortalContentAdmin, saveCmsAdminState, savePortalContentAdmin, softDeleteNewsletter } from '@/lib/clinical/cms-admin';
import { fetchDefaultDashboardWidgets } from '@/lib/clinical/dashboard-layouts';
import { fetchDashboardStats, fetchDashboardWidgetData, type DashboardWidgetData } from '@/lib/clinical/reports-data';
import { fetchSystemSettings } from '@/lib/clinical/system-settings';
import { DEFAULT_DASHBOARD_IMAGES } from '@/lib/portal-content/defaults';
import { DashboardWidgets } from '@/components/dashboard/dashboard-widgets';
import { Badge } from '@/components/ui/badge';
import type { SystemSettings, DashboardStats } from '@/types';
import type { DashboardWidgetType } from '@/types/modules';
import type { DashboardImages } from '@/types/portal-content';

export default function DashboardPage() {
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [homepage, setHomepage] = useState({ heroTitle: '', heroSubtitle: '', showSpecialtyBadges: true, specialtyBadges: [] as string[] });
  const [branding, setBranding] = useState({ appTitle: 'Hematology Section Portal' });
  const [images, setImages] = useState<DashboardImages>({ ...DEFAULT_DASHBOARD_IMAGES });
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [widgetData, setWidgetData] = useState<DashboardWidgetData | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [enabledWidgets, setEnabledWidgets] = useState<DashboardWidgetType[]>([]);

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
      setHomepage(cmsResult.data.homepage);
      setBranding(cmsResult.data.branding);
      setImages(contentResult.data.dashboardImages);
      setEnabledWidgets(widgets.map((w) => w.type));
      setStats(dashboardStats);

      const data = await fetchDashboardWidgetData(settingsResult.settings, contentResult.data.dashboardImages);
      setWidgetData(data);
      setLoading(false);
    })();
  }, []);

  const heroTitle = useMemo(
    () => homepage.heroTitle || settings?.laboratoryName || 'Central Laboratory',
    [homepage.heroTitle, settings?.laboratoryName],
  );

  if (loading || !widgetData || !stats || !settings) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-border brand-gradient text-white shadow-lg">
        <div className="grid lg:grid-cols-2 gap-6 p-6 md:p-8">
          <div className="space-y-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images.hospitalLogo} alt="Hospital Logo" className="h-16 w-16 rounded-xl bg-white/10 p-2 object-contain" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">{heroTitle}</h1>
              <p className="text-lg text-white/90 mt-1">{homepage.heroSubtitle || settings.sectionName}</p>
              <p className="text-sm text-white/70 mt-2">{branding.appTitle}</p>
            </div>
            {homepage.showSpecialtyBadges && (
              <div className="flex flex-wrap gap-2">
                {homepage.specialtyBadges.map((badge) => (
                  <Badge key={badge} className="bg-white/15 text-white border-0">{badge}</Badge>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images.hospitalBuilding} alt="Hospital" className="rounded-xl object-cover h-36 w-full border border-white/20" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images.hematologyLab} alt="Hematology Lab" className="rounded-xl object-cover h-36 w-full border border-white/20" />
          </div>
        </div>
      </section>

      <DashboardWidgets enabledWidgets={enabledWidgets} db={widgetData} stats={stats} locale={locale} />
    </div>
  );
}
