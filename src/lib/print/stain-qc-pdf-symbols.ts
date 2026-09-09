import type { jsPDF } from 'jspdf';
import type { StainQcCellStatus } from '@/types/stain-qc';

/** Internal PDF table markers — never shown as text; rendered as vector symbols. */
export const STAIN_QC_PDF_MARKERS = {
  ACCEPTABLE: '@@STAIN_QC_ACCEPTABLE@@',
  NOT_ACCEPTABLE: '@@STAIN_QC_NOT_ACCEPTABLE@@',
} as const;

export type StainQcPdfDrawnSymbol = 'acceptable' | 'not_acceptable';

export function isStainQcPdfMarker(value: unknown): value is string {
  return typeof value === 'string'
    && (value === STAIN_QC_PDF_MARKERS.ACCEPTABLE || value === STAIN_QC_PDF_MARKERS.NOT_ACCEPTABLE);
}

export function stainQcPdfMarkerFromStatus(status: StainQcCellStatus | null | undefined): string {
  switch (status) {
    case 'acceptable':
      return STAIN_QC_PDF_MARKERS.ACCEPTABLE;
    case 'not_acceptable':
      return STAIN_QC_PDF_MARKERS.NOT_ACCEPTABLE;
    case 'na':
      return 'N/A';
    default:
      return '';
  }
}

export function stainQcPdfMarkerToSymbol(marker: string): StainQcPdfDrawnSymbol | null {
  if (marker === STAIN_QC_PDF_MARKERS.ACCEPTABLE) return 'acceptable';
  if (marker === STAIN_QC_PDF_MARKERS.NOT_ACCEPTABLE) return 'not_acceptable';
  return null;
}

export function drawStainQcPdfCellSymbol(
  doc: jsPDF,
  symbol: StainQcPdfDrawnSymbol,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const size = Math.min(width, height) * 0.28;
  drawStainQcPdfSymbolAt(doc, symbol, cx, cy, size);
}

/** Draw a vector check or cross centered at (cx, cy). */
export function drawStainQcPdfSymbolAt(
  doc: jsPDF,
  symbol: StainQcPdfDrawnSymbol,
  cx: number,
  cy: number,
  size: number,
): void {
  doc.setDrawColor(20);
  doc.setLineWidth(0.35);

  if (symbol === 'acceptable') {
    doc.line(cx - size, cy, cx - size * 0.25, cy + size * 0.85);
    doc.line(cx - size * 0.25, cy + size * 0.85, cx + size, cy - size * 0.65);
    return;
  }

  doc.line(cx - size, cy - size, cx + size, cy + size);
  doc.line(cx - size, cy + size, cx + size, cy - size);
}

const PDF_LEGEND_ITEMS: Array<{ symbol?: StainQcPdfDrawnSymbol; label: string }> = [
  { symbol: 'acceptable', label: ': ACCEPTABLE' },
  { symbol: 'not_acceptable', label: ': NOT ACCEPTABLE' },
  { label: 'N/A : NOT APPLICABLE' },
];

/** Draw the Form-Hema-021 PDF legend with vector symbols for check and cross. */
export function drawStainQcPdfLegend(doc: jsPDF, centerX: number, baselineY: number): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  const symbolSize = 1.1;
  const symbolBox = symbolSize * 2.4;
  const gap = 4;
  const segmentWidths = PDF_LEGEND_ITEMS.map((item) => {
    const labelWidth = doc.getTextWidth(item.label);
    return (item.symbol ? symbolBox : 0) + labelWidth;
  });
  const totalWidth = segmentWidths.reduce((sum, width) => sum + width, 0) + gap * (PDF_LEGEND_ITEMS.length - 1);
  let x = centerX - totalWidth / 2;

  for (const [index, item] of PDF_LEGEND_ITEMS.entries()) {
    if (item.symbol) {
      drawStainQcPdfSymbolAt(doc, item.symbol, x + symbolBox / 2, baselineY - symbolSize * 0.15, symbolSize);
      doc.text(item.label, x + symbolBox, baselineY);
    } else {
      doc.text(item.label, x, baselineY);
    }
    x += segmentWidths[index]! + gap;
  }
}
