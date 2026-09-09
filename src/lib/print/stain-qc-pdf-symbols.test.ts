import { describe, expect, it, vi } from 'vitest';
import {
  STAIN_QC_PDF_MARKERS,
  drawStainQcPdfCellSymbol,
  drawStainQcPdfLegend,
  isStainQcPdfMarker,
  stainQcPdfMarkerFromStatus,
  stainQcPdfMarkerToSymbol,
} from '@/lib/print/stain-qc-pdf-symbols';

describe('stain-qc PDF symbols', () => {
  it('maps statuses to internal markers instead of unsupported unicode glyphs', () => {
    expect(stainQcPdfMarkerFromStatus('acceptable')).toBe(STAIN_QC_PDF_MARKERS.ACCEPTABLE);
    expect(stainQcPdfMarkerFromStatus('not_acceptable')).toBe(STAIN_QC_PDF_MARKERS.NOT_ACCEPTABLE);
    expect(stainQcPdfMarkerFromStatus('na')).toBe('N/A');
    expect(stainQcPdfMarkerFromStatus(null)).toBe('');
  });

  it('never uses dash as acceptable fallback', () => {
    expect(stainQcPdfMarkerFromStatus('acceptable')).not.toBe('-');
    expect(stainQcPdfMarkerFromStatus('acceptable')).not.toBe('✓');
  });

  it('draws vector check and cross marks', () => {
    const doc = {
      setDrawColor: vi.fn(),
      setLineWidth: vi.fn(),
      line: vi.fn(),
    };
    drawStainQcPdfCellSymbol(doc as never, 'acceptable', 10, 10, 8, 8);
    drawStainQcPdfCellSymbol(doc as never, 'not_acceptable', 20, 10, 8, 8);
    expect(doc.line).toHaveBeenCalledTimes(4);
    expect(isStainQcPdfMarker(STAIN_QC_PDF_MARKERS.ACCEPTABLE)).toBe(true);
    expect(stainQcPdfMarkerToSymbol(STAIN_QC_PDF_MARKERS.ACCEPTABLE)).toBe('acceptable');
  });

  it('draws the PDF legend with vector symbols instead of unsupported unicode', () => {
    const doc = {
      setFont: vi.fn(),
      setFontSize: vi.fn(),
      getTextWidth: vi.fn((text: string) => text.length * 2),
      text: vi.fn(),
      setDrawColor: vi.fn(),
      setLineWidth: vi.fn(),
      line: vi.fn(),
    };
    drawStainQcPdfLegend(doc as never, 100, 20);
    expect(doc.text).toHaveBeenCalledWith(': ACCEPTABLE', expect.any(Number), 20);
    expect(doc.text).toHaveBeenCalledWith(': NOT ACCEPTABLE', expect.any(Number), 20);
    expect(doc.text).toHaveBeenCalledWith('N/A : NOT APPLICABLE', expect.any(Number), 20);
    expect(doc.line.mock.calls.length).toBeGreaterThanOrEqual(4);
  });
});
