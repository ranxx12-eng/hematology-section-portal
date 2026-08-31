'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { AssetQrCard } from '@/components/environmental-monitoring/asset-qr-card';
import { useEnvironmentalMonitoring } from '@/hooks/use-environmental-monitoring';
import { ENVIRONMENTAL_ASSET_TYPE_LABELS } from '@/lib/environmental-monitoring/constants';
import { formatEnvironmentalRange } from '@/lib/environmental-monitoring/permissions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export default function EnvironmentalAssetsPage() {
  const locale = useLocale();
  const { assets, loading, error } = useEnvironmentalMonitoring();

  const activeAssets = useMemo(() => assets.filter((asset) => asset.active), [assets]);

  return (
    <PageContentSections
      pageKey="environmental_monitoring"
      fallbackTitle="Environmental Assets"
      fallbackSubtitle="Monitored assets with Record Reading and Live Monthly Log QR codes"
    >
      {loading && <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}
      {!loading && error && <p className="text-destructive">{error}</p>}
      {!loading && !error && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {activeAssets.map((asset) => (
              <Card key={asset.id}>
                <CardContent className="pt-6 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{asset.assetName}</p>
                      <p className="text-sm text-muted-foreground">{asset.assetCode}</p>
                    </div>
                    <Badge variant="outline">{ENVIRONMENTAL_ASSET_TYPE_LABELS[asset.assetType]}</Badge>
                  </div>
                  <p className="text-sm">Location: {asset.location ?? '—'}</p>
                  <p className="text-sm">Range: {formatEnvironmentalRange(asset.minTemperature, asset.maxTemperature)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {activeAssets.map((asset) => (
              <AssetQrCard key={asset.id} asset={asset} locale={locale} />
            ))}
          </div>
        </div>
      )}
    </PageContentSections>
  );
}
