'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { createDefaultCmsAdmin } from '@/lib/cms/defaults';
import { DEFAULT_DASHBOARD_IMAGES } from '@/lib/portal-content/defaults';
import type { MockDatabase } from '@/lib/mock/store';
import type { DashboardStats } from '@/types';
import { DashboardWidgets } from '@/components/dashboard/dashboard-widgets';
import type { DashboardWidgetType } from '@/types/modules';

const cmsAdmin = createDefaultCmsAdmin();

const DEFAULT_SETTINGS = {
  laboratoryName: 'Central Laboratory',
  sectionName: 'Hematology Section',
  defaultLanguage: 'en' as const,
  timezone: 'Asia/Riyadh',
  dateFormat: 'dd/MM/yyyy',
  tatTargets: { stat: 60, routine: 240, dDimer: 60, er: 90, icu: 90 },
  evaluationWeights: { fte: 0.4, staff: 0.3, supervisor: 0.1, labManager: 0.1, labDirector: 0.1 },
  rejectedSampleRetentionDays: 3,
};

const EMPTY_STATS: DashboardStats = {
  totalSamples: 0,
  routineSamples: 0,
  statSamples: 0,
  criticalValues: 0,
  sampleRejections: 0,
  correctedResults: 0,
  pendingSamples: 0,
  activeInstruments: 0,
  instrumentsUnderMaintenance: 0,
  expiringInventory: 0,
  trainingCompletionRate: 0,
  openTasks: 0,
};

const dashboardDb = {
  settings: DEFAULT_SETTINGS,
  portalContent: {
    leadership: [],
    missionVision: [],
    newsletters: [],
    dashboardImages: DEFAULT_DASHBOARD_IMAGES,
  },
  criticalValues: [],
  sampleRejections: [],
  pendingSamples: [],
  tatRecords: [],
  announcements: [],
  calendarEvents: [],
  tasks: [],
  cmsAdmin,
} as unknown as MockDatabase;

export default function DashboardPage() {
  const locale = useLocale();
  const homepage = cmsAdmin.homepage;
  const images = DEFAULT_DASHBOARD_IMAGES;
  const settings = DEFAULT_SETTINGS;

  const enabledWidgets = useMemo(() => cmsAdmin.dashboardWidgets
    .filter((w) => w.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((w) => w.type) as DashboardWidgetType[], []);

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
              <p className="text-sm text-white/70 mt-2">{cmsAdmin.branding.appTitle}</p>
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

      <DashboardWidgets enabledWidgets={enabledWidgets} db={dashboardDb} stats={EMPTY_STATS} locale={locale} />
    </div>
  );
}
