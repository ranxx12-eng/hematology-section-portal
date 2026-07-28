'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { getMockDatabase, getDashboardStats } from '@/lib/mock/store';
import { DashboardWidgets } from '@/components/dashboard/dashboard-widgets';
import type { DashboardWidgetType } from '@/types/modules';

export default function DashboardPage() {
  const locale = useLocale();
  const db = useMemo(() => getMockDatabase(), []);
  const stats = useMemo(() => getDashboardStats(db), [db]);
  const homepage = db.cmsAdmin.homepage;
  const images = db.portalContent.dashboardImages;
  const settings = db.settings;

  const enabledWidgets = useMemo(() => db.cmsAdmin.dashboardWidgets
    .filter((w) => w.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((w) => w.type) as DashboardWidgetType[], [db.cmsAdmin.dashboardWidgets]);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-border brand-gradient text-white shadow-lg">
        <div className="grid lg:grid-cols-2 gap-6 p-6 md:p-8">
          <div className="space-y-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images.hospitalLogo} alt="Hospital Logo" className="h-16 w-16 rounded-xl bg-white/10 p-2 object-contain" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">{homepage.heroTitle || settings.laboratoryName}</h1>
              <p className="text-lg text-white/90 mt-1">{homepage.heroSubtitle || settings.sectionName}</p>
              <p className="text-sm text-white/70 mt-2">{db.cmsAdmin.branding.appTitle}</p>
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

      <DashboardWidgets enabledWidgets={enabledWidgets} db={db} stats={stats} locale={locale} />
    </div>
  );
}
