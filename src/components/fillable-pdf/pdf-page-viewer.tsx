'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchPdfArrayBuffer, loadPdfJs } from '@/lib/fillable-pdf/pdf-client';
import type { FillablePdfField } from '@/types/modules';
import { PdfFieldOverlay } from '@/components/fillable-pdf/pdf-field-overlay';

interface PdfPageViewerProps {
  pdfUrl: string;
  pageNumber?: number;
  scale?: number;
  fields: FillablePdfField[];
  mode: 'design' | 'fill' | 'preview';
  values?: Record<string, string>;
  selectedFieldId?: string | null;
  onSelectField?: (fieldId: string | null) => void;
  onFieldChange?: (fieldKey: string, value: string) => void;
  onPageMetrics?: (metrics: { width: number; height: number }) => void;
  onCanvasClick?: (pageNumber: number, xNorm: number, yNorm: number) => void;
  onFieldMove?: (fieldId: string, patch: Partial<Pick<FillablePdfField, 'posX' | 'posY' | 'width' | 'height'>>) => void;
}

export function PdfPageViewer({
  pdfUrl,
  pageNumber = 1,
  scale = 1,
  fields,
  mode,
  values = {},
  selectedFieldId,
  onSelectField,
  onFieldChange,
  onPageMetrics,
  onCanvasClick,
  onFieldMove,
}: PdfPageViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });

  const renderPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const buffer = await fetchPdfArrayBuffer(pdfUrl);
      const pdfjs = await loadPdfJs();
      const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      setPageSize({ width: viewport.width, height: viewport.height });
      onPageMetrics?.({ width: viewport.width, height: viewport.height });

      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: context, viewport, canvas }).promise;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to render PDF');
    } finally {
      setLoading(false);
    }
  }, [pdfUrl, pageNumber, scale, onPageMetrics]);

  useEffect(() => {
    void renderPage();
  }, [renderPage]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'design' || !onCanvasClick || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    onCanvasClick(pageNumber, Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y)));
  };

  return (
    <div className="relative w-full overflow-auto rounded-lg border bg-muted/20">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="p-6 text-sm text-destructive">{error}</div>
      )}
      <div
        ref={containerRef}
        className="relative mx-auto"
        style={{ width: pageSize.width || undefined, height: pageSize.height || undefined }}
        onClick={handleCanvasClick}
      >
        <canvas ref={canvasRef} className="block max-w-full h-auto" />
        {pageSize.width > 0 && (
          <PdfFieldOverlay
            pageNumber={pageNumber}
            pageWidth={pageSize.width}
            pageHeight={pageSize.height}
            fields={fields.filter((f) => f.pageNumber === pageNumber)}
            mode={mode}
            values={values}
            selectedFieldId={selectedFieldId}
            onSelectField={onSelectField}
            onFieldChange={onFieldChange}
            onFieldMove={onFieldMove}
          />
        )}
      </div>
    </div>
  );
}
