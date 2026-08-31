'use client';

import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, ExternalLink, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { buildAssetQrPath } from '@/lib/environmental-monitoring/compliance';
import { buildAssetLiveMonthlyLogPath } from '@/lib/environmental-monitoring/live-view';
import type { EnvironmentalAsset } from '@/types/environmental-monitoring';

interface AssetQrCardProps {
  asset: EnvironmentalAsset;
  locale: string;
}

interface QrSectionProps {
  title: string;
  subtitle: string;
  printTitle: string;
  printLines: string[];
  url: string;
  filePrefix: string;
}

function QrSection({ title, subtitle, printTitle, printLines, url, filePrefix }: QrSectionProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const generatedDate = formatDate(new Date(), 'en');

  const downloadQr = () => {
    const svg = printRef.current?.querySelector('svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `${filePrefix}.svg`;
    link.click();
    URL.revokeObjectURL(blobUrl);
  };

  const printLabel = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>${printTitle}</title>
      <style>
        body { font-family: system-ui, sans-serif; display: flex; justify-content: center; padding: 24px; }
        .label { border: 2px solid #333; border-radius: 12px; padding: 24px; max-width: 320px; text-align: center; }
        h1 { font-size: 14px; margin-bottom: 8px; }
        h2 { font-size: 18px; margin-bottom: 8px; }
        p { font-size: 12px; color: #444; margin-bottom: 8px; }
      </style></head><body>${content.innerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
        <p className="text-xs break-all text-muted-foreground mt-1">{url}</p>
      </div>
      <div ref={printRef} className="mx-auto w-fit">
        <div className="hidden border rounded-xl p-6 text-center max-w-xs">
          {printLines.map((line) => (
            <p key={line} className={line.includes('LIVE') ? 'text-sm font-bold tracking-wide' : 'text-xs text-muted-foreground mt-2'}>{line}</p>
          ))}
          <div className="my-4 flex justify-center">
            <QRCodeSVG value={url} size={160} level="M" includeMargin />
          </div>
          <p className="text-[10px] text-muted-foreground">Generated: {generatedDate}</p>
        </div>
        <div className="flex justify-center p-4 bg-white rounded-lg border">
          <QRCodeSVG value={url} size={160} level="M" includeMargin />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={downloadQr}><Download className="h-4 w-4 me-1" />Show QR</Button>
        <Button variant="outline" size="sm" onClick={printLabel}><Printer className="h-4 w-4 me-1" />Print QR</Button>
        <Button variant="outline" size="sm" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 me-1" />Open</a>
        </Button>
      </div>
    </div>
  );
}

export function AssetQrCard({ asset, locale }: AssetQrCardProps) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const recordPath = buildAssetQrPath(locale, asset.assetCode);
  const livePath = buildAssetLiveMonthlyLogPath(locale, asset.assetCode);
  const recordUrl = `${origin}${recordPath}`;
  const liveUrl = `${origin}${livePath}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{asset.assetName}</CardTitle>
        <p className="text-sm text-muted-foreground">{asset.assetCode}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <QrSection
          title="Record Reading"
          subtitle="Scan to enter a temperature/humidity reading"
          printTitle={`Record Reading — ${asset.assetName}`}
          printLines={[
            asset.assetCode,
            asset.assetName,
            'ENVIRONMENTAL MONITORING',
            'Scan to record reading',
            'Hematology Section',
          ]}
          url={recordUrl}
          filePrefix={`env-record-${asset.assetCode}`}
        />
        <QrSection
          title="Live Monthly Log"
          subtitle="Scan to view the read-only current month monitoring log"
          printTitle={`Live Monthly Log — ${asset.assetName}`}
          printLines={[
            asset.assetCode,
            asset.assetName,
            'LIVE MONTHLY MONITORING LOG',
            'Scan to view current month monitoring record',
            'Hematology Section',
          ]}
          url={liveUrl}
          filePrefix={`env-live-${asset.assetCode}`}
        />
      </CardContent>
    </Card>
  );
}
