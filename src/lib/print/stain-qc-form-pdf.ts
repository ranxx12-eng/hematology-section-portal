import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';
import { monthName } from '@/lib/shared/month-names';
import { formatChangeStainPdfLine } from '@/lib/stain-qc/change-stain';
import {
  FORM_HEMA_021_FOOTER,
  stainQcPdfLegendBlock,
} from '@/lib/stain-qc/constants';
import { buildStainQcPdfGrid } from '@/lib/stain-qc/display';
import {
  drawStainQcPdfCellSymbol,
  isStainQcPdfMarker,
  stainQcPdfMarkerToSymbol,
} from '@/lib/print/stain-qc-pdf-symbols';
import { PRINT_PAGE_MARGIN_MM } from '@/lib/print/landscape-layout';
import {
  QC_PRINT_DEPARTMENT,
  QC_PRINT_HOSPITAL,
  QC_PRINT_SECTION,
} from '@/lib/print/qc-print-templates';
import { loadOfficialLogoForPdf } from '@/lib/portal/official-logo';
import type { StainQcMonthlySheetDetail } from '@/types/stain-qc';

async function drawHeader(doc: jsPDF, sheet: StainQcMonthlySheetDetail): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 10;
  const logo = await loadOfficialLogoForPdf();
  if (logo.dataUrl && logo.dimensions) {
    doc.addImage(logo.dataUrl, logo.dimensions.format, pageWidth / 2 - logo.dimensions.width / 2, 6, logo.dimensions.width, logo.dimensions.height);
    y = 24;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(QC_PRINT_HOSPITAL, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text(QC_PRINT_DEPARTMENT, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text(QC_PRINT_SECTION, pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(sheet.formCode, pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.text(sheet.formTitle.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `${monthName(sheet.sheetMonth)} ${sheet.sheetYear} · ${sheet.stainName} · Lot ${sheet.lotNumber} · Exp ${sheet.expiryDate}`,
    pageWidth / 2,
    y,
    { align: 'center' },
  );
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Coding / Legend', pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.text(stainQcPdfLegendBlock(), pageWidth / 2, y, { align: 'center' });
  return y + 8;
}

export function getStainQcPdfLegendBlock(): string {
  return stainQcPdfLegendBlock();
}

export { buildStainQcPdfGrid } from '@/lib/stain-qc/display';

export async function renderStainQcFormPdf(sheet: StainQcMonthlySheetDetail): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const startY = await drawHeader(doc, sheet);
  const { head, body } = buildStainQcPdfGrid(sheet);

  const dayColumnStyles = Object.fromEntries(
    Array.from({ length: 31 }, (_, index) => [
      index + 3,
      { halign: 'center' as const, cellWidth: 6.2, overflow: 'linebreak' as const },
    ]),
  );

  autoTable(doc, {
    startY,
    head,
    body,
    styles: {
      fontSize: 6,
      cellPadding: 0.8,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: { fillColor: [230, 230, 230], textColor: 20, fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 42, halign: 'left' },
      1: { cellWidth: 24, halign: 'left' },
      2: { cellWidth: 26, halign: 'left' },
      ...dayColumnStyles,
    },
    margin: { left: PRINT_PAGE_MARGIN_MM, right: PRINT_PAGE_MARGIN_MM },
    didParseCell(data) {
      if (data.section !== 'body' || data.column.index < 3) return;
      const raw = data.cell.raw;
      if (isStainQcPdfMarker(raw)) {
        data.cell.text = [];
        data.cell.styles.halign = 'center';
      }
    },
    didDrawCell(data) {
      if (data.section !== 'body' || data.column.index < 3) return;
      const raw = data.cell.raw;
      if (!isStainQcPdfMarker(raw)) return;
      const symbol = stainQcPdfMarkerToSymbol(String(raw));
      if (!symbol) return;
      drawStainQcPdfCellSymbol(
        doc,
        symbol,
        data.cell.x,
        data.cell.y,
        data.cell.width,
        data.cell.height,
      );
    },
  });

  const finalY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY) + 8;
  doc.setFontSize(9);
  doc.text(`Reviewed By: ${sheet.reviewedByName ?? '—'}${sheet.reviewedAt ? ` · ${new Date(sheet.reviewedAt).toLocaleString()}` : ''}`, PRINT_PAGE_MARGIN_MM, finalY);
  doc.text(`Approved By: ${sheet.approvedByName ?? '—'}${sheet.approvedAt ? ` · ${new Date(sheet.approvedAt).toLocaleString()}` : ''}`, PRINT_PAGE_MARGIN_MM, finalY + 5);

  if (sheet.correctiveActions.length > 0) {
    doc.text('Corrective Actions:', PRINT_PAGE_MARGIN_MM, finalY + 12);
    sheet.correctiveActions.forEach((action, index) => {
      doc.text(
        formatChangeStainPdfLine(action),
        PRINT_PAGE_MARGIN_MM,
        finalY + 17 + index * 4,
      );
    });
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.text(FORM_HEMA_021_FOOTER, pageWidth / 2, pageHeight - 6, { align: 'center' });

  return doc.output('blob');
}
