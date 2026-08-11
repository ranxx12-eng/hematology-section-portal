'use client';

import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ExternalLink, Download, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getLiveViewUrl } from '@/lib/qc-records/live-slugs';
import { formatDate } from '@/lib/utils';

interface QRCodeCardProps {
  instrumentName: string;
  slug: string;
  locale: string;
}

export function QRCodeCard({ instrumentName, slug, locale }: QRCodeCardProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const liveUrl = getLiveViewUrl(locale, slug);
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
    link.download = `qc-live-${slug}.svg`;
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
      <html>
        <head>
          <title>QC Live — ${instrumentName}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: system-ui, sans-serif; display: flex; justify-content: center; padding: 24px; }
            .label {
              border: 2px solid #333;
              border-radius: 12px;
              padding: 24px;
              max-width: 320px;
              text-align: center;
            }
            h1 { font-size: 14px; letter-spacing: 0.05em; margin-bottom: 8px; }
            h2 { font-size: 18px; margin-bottom: 12px; }
            p { font-size: 12px; color: #444; margin-bottom: 8px; }
            .qr { margin: 16px auto; }
            .readonly { font-weight: bold; font-size: 11px; letter-spacing: 0.1em; margin-top: 12px; color: #666; }
            .date { font-size: 10px; color: #888; margin-top: 8px; }
          </style>
        </head>
        <body>
          ${content.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{instrumentName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm break-all text-muted-foreground">{liveUrl}</div>

        <div ref={printRef} className="mx-auto w-fit">
          <div className="label hidden print:block border rounded-xl p-6 text-center max-w-xs">
            <h1 className="text-sm font-bold tracking-wide">HEMATOLOGY QC LIVE VIEW</h1>
            <h2 className="text-lg font-semibold mt-2">{instrumentName}</h2>
            <p className="text-xs text-muted-foreground mt-2">Scan to view current QC records</p>
            <div className="qr my-4 flex justify-center">
              <QRCodeSVG value={liveUrl} size={160} level="M" includeMargin />
            </div>
            <p className="readonly text-xs font-bold tracking-widest">READ ONLY</p>
            <p className="date text-[10px] text-muted-foreground mt-2">Generated: {generatedDate}</p>
          </div>

          <div className="flex justify-center p-4 bg-white rounded-lg border">
            <QRCodeSVG value={liveUrl} size={180} level="M" includeMargin />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={downloadQr}>
            <Download className="h-4 w-4 me-1" />
            Download QR
          </Button>
          <Button variant="outline" size="sm" onClick={printLabel}>
            <Printer className="h-4 w-4 me-1" />
            Print Label
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={liveUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 me-1" />
              Preview Live View
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
