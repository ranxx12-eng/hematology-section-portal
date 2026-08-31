'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { RecordReadingPanel } from '@/components/environmental-monitoring/record-reading-panel';
import { useEnvironmentalMonitoring } from '@/hooks/use-environmental-monitoring';
import { useAuth } from '@/components/providers/auth-provider';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale } from 'next-intl';
import { canRecordEnvironmental } from '@/lib/environmental-monitoring/permissions';

function RecordReadingContent() {
  const { assets, windows, readings, loading, reload } = useEnvironmentalMonitoring();

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return <RecordReadingPanel assets={assets} windows={windows} readings={readings} onSaved={reload} />;
}

export default function EnvironmentalRecordPage() {
  const locale = useLocale();
  const { can } = useAuth();
  const accessDenied = !canRecordEnvironmental(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  if (accessDenied) return null;

  return (
    <PageContentSections
      pageKey="environmental_monitoring"
      fallbackTitle="Record Reading"
      fallbackSubtitle="Select a monitoring area or scan a QR code to record temperature and humidity"
    >
      <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
        <RecordReadingContent />
      </Suspense>
    </PageContentSections>
  );
}
