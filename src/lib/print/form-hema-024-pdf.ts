import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { checklistMonthLabel, daysInMonth } from '@/lib/qc-records/alinity-checklist/calendar';
import {
  FORM_HEMA_024_FOOTER,
  FORM_HEMA_024_QID,
  HEMA_024_ACCEPT_MARKER,
  HEMA_024_REJECT_MARKER,
} from '@/lib/qc-records/alinity-checklist/constants';
import {
  formatIdentityCodes,
  runMarkMarker,
  type BuiltChecklist,
} from '@/lib/qc-records/alinity-checklist/aggregate';
import { drawStainQcPdfCellSymbol, stainQcPdfMarkerToSymbol } from '@/lib/print/stain-qc-pdf-symbols';
import { PRINT_LANDSCAPE_PAGE, PRINT_PAGE_MARGIN_MM } from '@/lib/print/landscape-layout';
import { loadOfficialLogoForPdf } from '@/lib/portal/official-logo';
import { createQCReportPdf } from '@/lib/print/qc-report';
import type { Instrument, QCRecord } from '@/types';

export interface FormHema024SignOff {
  fullName?: string;
  staffId?: string;
  signedAt?: string;
}

export interface FormHema024CoverInput {
  instrumentName: string;
  year: number;
  month: number;
  comment?: string;
  checklist: BuiltChecklist;
  reviewedBy?: FormHema024SignOff;
  supervisor?: FormHema024SignOff;
}

function markerSymbol(value: unknown): 'acceptable' | 'not_acceptable' | null {
  if (value === HEMA_024_ACCEPT_MARKER) return 'acceptable';
  if (value === HEMA_024_REJECT_MARKER) return 'not_acceptable';
  return stainQcPdfMarkerToSymbol(String(value ?? ''));
}

function signOffLine(label: string, signOff?: FormHema024SignOff): string {
  if (!signOff?.fullName?.trim()) return `${label}:`;
  const staff = signOff.staffId?.trim() ? `Staff ID ${signOff.staffId.trim()}` : 'Staff ID not recorded';
  const when = signOff.signedAt ? new Date(signOff.signedAt).toISOString() : 'time not recorded';
  return `${label}: ${signOff.fullName.trim()} · ${staff} · ${when}`;
}

export async function createFormHema024CoverPdf(input: FormHema024CoverInput): Promise<jsPDF> {
  const doc = new jsPDF(PRINT_LANDSCAPE_PAGE);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const logo = await loadOfficialLogoForPdf();
  let y = 8;
  if (logo.dataUrl && logo.dimensions) {
    doc.addImage(
      logo.dataUrl,
      logo.dimensions.format,
      pageWidth / 2 - logo.dimensions.width / 2,
      y,
      logo.dimensions.width,
      logo.dimensions.height,
    );
    y += logo.dimensions.height + 2;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DR SULAIMAN AL HABIB', pageWidth / 2, y, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('AL SAHAFA HOSPITAL', pageWidth / 2, y + 4, { align: 'center' });
  doc.text('Laboratory Department', pageWidth / 2, y + 8, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text('HEMATOLOGY', pageWidth / 2, y + 12, { align: 'center' });
  doc.setFontSize(11);
  doc.text('QC Checklist', pageWidth / 2, y + 17, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Instrument: ${input.instrumentName}`, PRINT_PAGE_MARGIN_MM, y + 22);
  doc.text(checklistMonthLabel(input.year, input.month), pageWidth - PRINT_PAGE_MARGIN_MM, y + 22, { align: 'right' });

  const legendY = y + 27;
  drawStainQcPdfCellSymbol(doc, 'acceptable', PRINT_PAGE_MARGIN_MM, legendY - 2.2, 8, 4);
  doc.setFontSize(7);
  doc.text('Accept', PRINT_PAGE_MARGIN_MM + 6, legendY);
  drawStainQcPdfCellSymbol(doc, 'not_acceptable', PRINT_PAGE_MARGIN_MM + 22, legendY - 2.2, 8, 4);
  doc.text('Reject', PRINT_PAGE_MARGIN_MM + 28, legendY);
  doc.text('Blank = not recorded', PRINT_PAGE_MARGIN_MM + 48, legendY);

  const dayCount = daysInMonth(input.year, input.month);
  const { checklist } = input;
  const head = [['', ...Array.from({ length: dayCount }, (_, index) => String(index + 1))]];
  const row = (label: string, values: string[]) => [label, ...values];
  const body = [
    row('1st Run QC check', checklist.days.map((day) => runMarkMarker(day.run1.mark))),
    row('Lab-tech int', checklist.days.map((day) => formatIdentityCodes(day.run1.technicians, checklist.legend))),
    row('QC correction / If applicable', checklist.days.map((day) => day.run1.correction)),
    row('2nd Run QC check', checklist.days.map((day) => runMarkMarker(day.run2.mark))),
    row('Lab-tech int', checklist.days.map((day) => formatIdentityCodes(day.run2.technicians, checklist.legend))),
    row('QC correction / If applicable', checklist.days.map((day) => day.run2.correction)),
    row('QC Check', checklist.days.map((day) => (day.qcCheck ? HEMA_024_ACCEPT_MARKER : ''))),
    row('CV Monitoring', checklist.days.map((day) => (day.cvMonitoring ? formatIdentityCodes([day.cvMonitoring], checklist.legend) : ''))),
    row('Senior int', checklist.days.map((day) => formatIdentityCodes(day.seniors, checklist.legend))),
  ];

  const tableWidth = pageWidth - PRINT_PAGE_MARGIN_MM * 2;
  const labelWidth = 34;
  const dayWidth = (tableWidth - labelWidth) / dayCount;
  autoTable(doc, {
    startY: legendY + 3,
    head,
    body,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 5,
      cellPadding: 0.35,
      minCellHeight: 4.2,
      halign: 'center',
      valign: 'middle',
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { cellWidth: labelWidth, halign: 'left', fontStyle: 'bold' },
      ...Object.fromEntries(Array.from({ length: dayCount }, (_, index) => [index + 1, { cellWidth: dayWidth }])),
    },
    margin: { left: PRINT_PAGE_MARGIN_MM, right: PRINT_PAGE_MARGIN_MM, bottom: 36 },
    didParseCell(data) {
      if (data.section !== 'body' || data.column.index === 0) return;
      if (markerSymbol(data.cell.raw)) data.cell.text = [];
    },
    didDrawCell(data) {
      if (data.section !== 'body' || data.column.index === 0) return;
      const symbol = markerSymbol(data.cell.raw);
      if (!symbol) return;
      drawStainQcPdfCellSymbol(doc, symbol, data.cell.x, data.cell.y, data.cell.width, data.cell.height);
    },
  });

  const finalY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? legendY + 50);
  let textY = Math.min(finalY + 5, pageHeight - 34);
  doc.setFontSize(7);
  doc.text('Identity legend', PRINT_PAGE_MARGIN_MM, textY);
  textY += 3.5;
  const legendText = checklist.legend.length === 0
    ? 'No identities recorded.'
    : checklist.legend.map((entry) => `${entry.code} = ${entry.fullName} · Staff ID ${entry.staffId}`).join('    ');
  const legendLines = doc.splitTextToSize(legendText, tableWidth).slice(0, 2);
  doc.text(legendLines, PRINT_PAGE_MARGIN_MM, textY);
  textY += legendLines.length * 3 + 2;
  const comment = input.comment?.trim() ? input.comment.trim() : '';
  const commentLines = doc.splitTextToSize(
    comment ? `Comment if needed: ${comment}` : 'Comment if needed:',
    tableWidth,
  ).slice(0, 3);
  doc.text(commentLines, PRINT_PAGE_MARGIN_MM, Math.min(textY, pageHeight - 24));

  doc.setFontSize(7.5);
  doc.text(signOffLine('Reviewed by', input.reviewedBy), PRINT_PAGE_MARGIN_MM, pageHeight - 18);
  doc.text(signOffLine('Supervisor', input.supervisor), PRINT_PAGE_MARGIN_MM, pageHeight - 14);
  doc.setLineWidth(0.2);
  doc.line(PRINT_PAGE_MARGIN_MM, pageHeight - 11, pageWidth - PRINT_PAGE_MARGIN_MM, pageHeight - 11);
  doc.setFontSize(8);
  doc.text(FORM_HEMA_024_FOOTER, PRINT_PAGE_MARGIN_MM, pageHeight - 7);
  doc.text(FORM_HEMA_024_QID, pageWidth - PRINT_PAGE_MARGIN_MM, pageHeight - 7, { align: 'right' });
  return doc;
}

export async function composeMonthlyQcReportPdf(input: {
  cover: FormHema024CoverInput;
  records: QCRecord[];
  instrumentNames: Record<string, string>;
  instrumentsById?: Record<string, Instrument>;
  materialConfigsByParameter?: Record<string, { lotNumber?: string; expiryDate?: string }>;
  reportingPeriod: string;
}): Promise<Uint8Array> {
  const cover = await createFormHema024CoverPdf(input.cover);
  const merged = await PDFDocument.create();
  const coverDoc = await PDFDocument.load(cover.output('arraybuffer'));
  const coverPages = await merged.copyPages(coverDoc, coverDoc.getPageIndices());
  coverPages.forEach((page) => merged.addPage(page));

  if (input.records.length > 0) {
    const detail = await createQCReportPdf(
      input.records,
      input.instrumentNames,
      input.reportingPeriod,
      input.instrumentsById,
      input.materialConfigsByParameter,
    );
    const detailDoc = await PDFDocument.load(detail.output('arraybuffer'));
    const detailPages = await merged.copyPages(detailDoc, detailDoc.getPageIndices());
    detailPages.forEach((page) => merged.addPage(page));
  }

  const font = await merged.embedFont(StandardFonts.Helvetica);
  const pages = merged.getPages();
  pages.forEach((page, index) => {
    const { width } = page.getSize();
    const label = `Page ${index + 1} of ${pages.length}`;
    const textWidth = font.widthOfTextAtSize(label, 7);
    page.drawText(label, {
      x: width / 2 - textWidth / 2,
      y: 3,
      size: 7,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });
  });
  return merged.save();
}
