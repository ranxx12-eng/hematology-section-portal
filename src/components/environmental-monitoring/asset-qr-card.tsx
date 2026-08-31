'use client';

import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, ExternalLink, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { buildAssetQrPath } from '@/lib/environmental-monitoring/compliance';
import type { EnvironmentalAsset } from '@/types/environmental-monitoring';

interface AssetQrCardProps {
  asset: EnvironmentalAsset;
  locale: string;
}

export function AssetQrCard({ asset, locale }: AssetQrCardProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const recordUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${buildAssetQrPath(locale, asset.assetCode)}`
    : buildAssetQrPath(locale, asset.assetCode);
  const generatedDate = formatDate(new Date(), locale);

  const downloadQr = () => {
    const svg = printRef.current?.querySelector('svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `env-${asset.assetCode}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const printLabel = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Environmental Monitoring — ${asset.assetName}</title>
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
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{asset.assetName}</CardTitle>
        <p className="text-sm text-muted-foreground">{asset.assetCode}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm break-all text-muted-foreground">{recordUrl}</div>
        <div ref={printRef} className="mx-auto w-fit">
          <div className="hidden border rounded-xl p-6 text-center max-w-xs">
            <h1 className="text-sm font-bold tracking-wide">ENVIRONMENTAL MONITORING</h1>
            <h2 className="text-lg font-semibold mt-2">{asset.assetName}</h2>
            <p className="text-xs text-muted-foreground mt-2">Scan to record temperature</p>
            <div className="my-4 flex justify-center">
              <QRCodeSVG value={recordUrl} size={160} level="M" includeMargin />
            </div>
            <p className="text-[10px] text-muted-foreground">Generated: {generatedDate}</p>
          </div>
          <div className="flex justify-center p-4 bg-white rounded-lg border">
            <QRCodeSVG value={recordUrl} size={180} level="M" includeMargin />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={downloadQr}><Download className="h-4 w-4 me-1" />Download QR</Button>
          <Button variant="outline" size="sm" onClick={printLabel}><Printer className="h-4 w-4 me-1" />Print Label</Button>
          <Button variant="outline" size="sm" asChild>
            <a href={recordUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 me-1" />Open Record Page</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
