import { notFound } from 'next/navigation';
import { LiveMonthlyLogView } from '@/components/environmental-monitoring/live-monthly-log-view';
import { normalizeEnvLiveAssetCode } from '@/lib/environmental-monitoring/live-asset-codes';

interface EnvLiveMonthlyLogPageProps {
  params: Promise<{ locale: string; assetCode: string }>;
}

export default async function EnvLiveMonthlyLogPage({ params }: EnvLiveMonthlyLogPageProps) {
  const { assetCode } = await params;
  const normalized = normalizeEnvLiveAssetCode(decodeURIComponent(assetCode));

  if (!normalized) {
    notFound();
  }

  return (
    <div className="container max-w-7xl py-6 px-4">
      <LiveMonthlyLogView assetCode={normalized} />
    </div>
  );
}
