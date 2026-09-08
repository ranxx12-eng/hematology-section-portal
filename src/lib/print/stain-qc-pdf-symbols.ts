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
