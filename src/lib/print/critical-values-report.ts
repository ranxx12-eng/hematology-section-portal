import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';
import { displayEscalationTo, formatReadBack, formatTestsList } from '@/lib/critical-values/schema';
import type { CriticalValue } from '@/types';
import { getLandscapeTableWidth, PRINT_LANDSCAPE_PAGE, PRINT_PAGE_MARGIN_MM } from './landscape-layout';
import { printDateTime, printList, printValue } from './report-value';
import { loadOfficialLogoForPdf } from '@/lib/portal/official-logo';

export const CRITICAL_VALUES_LOG_HOSPITAL = 'AL SAHAFA HOSPITAL';
export const CRITICAL_VALUES_LOG_DEPARTMENT = 'LABORATORY DEPARTMENT';
export const CRITICAL_VALUES_LOG_TITLE = 'CRITICAL VALUES LOG';

/** @deprecated Use CRITICAL_VALUES_LOG_TITLE */
export const CRITICAL_VALUE_REPORT_TITLE = CRITICAL_VALUES_LOG_TITLE;

export const CRITICAL_VALUES_LOG_FOOTER_LEFT = 'Form-LabGen 007-Critical Values Log';
export const CRITICAL_VALUES_LOG_FOOTER_RIGHT = 'HMG/SAH/QID/9006';

export const CRITICAL_VALUE_LOG_HEADERS = [
  'Year',
  'Patient\u2019s Full Name',
  'Location',
  'Test',
  'Critical Value',
  'Section',
  'Phoned To \u2013 First Name',
  'Phoned To \u2013 Last Name',
  'ID #',
  'Date',
  'Value Date & Time',
  'Read Back',
  'Comments',
  'Escalated To',
  'Completed by Tech',
] as const;

/** Shared column order for browser print and PDF export. */
export const CRITICAL_VALUE_PRINT_HEADERS = CRITICAL_VALUE_LOG_HEADERS;
export const CRITICAL_VALUE_PDF_HEADERS = CRITICAL_VALUE_LOG_HEADERS;

function splitPersonName(fullName: string | null | undefined): { first: string; last: string } {
  const trimmed = fullName?.trim() ?? '';
  if (!trimmed) return { first: '—', last: '—' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '—' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function printYear(date: string | null | undefined): string {
  if (!date?.trim()) return '—';
  const year = date.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : '—';
}

function printReadBackDisplay(value: boolean): string {
  return formatReadBack(value);
}

export function mapCriticalValueLogRow(record: CriticalValue): string[] {
  const phoned = splitPersonName(record.informedToDr);

  return [
    printYear(record.date),
    printValue(record.patientName),
    printValue(record.department),
    printList(record.tests, '; '),
    printValue(record.criticalValue),
    '—',
    printValue(phoned.first === '—' ? undefined : phoned.first),
    printValue(phoned.last === '—' ? undefined : phoned.last),
    printValue(record.drId),
    printValue(record.date),
    printDateTime(record.date, record.verifyTime),
    printReadBackDisplay(record.readBack),
    printValue(record.comment),
    printValue(displayEscalationTo(record.escalationTo)),
    printValue(record.initial || record.reportedBy),
  ];
}

function mapCriticalValuePdfRow(record: CriticalValue): string[] {
  return mapCriticalValueLogRow(record);
}

function mapCriticalValuePrintRow(record: CriticalValue): string[] {
  return mapCriticalValueLogRow(record);
}

export function buildCriticalValuePrintRows(records: CriticalValue[]): string[][] {
  return records.map(mapCriticalValuePrintRow);
}

async function loadLogoForPdf() {
  const { dataUrl, dimensions } = await loadOfficialLogoForPdf();
  if (!dataUrl || !dimensions) return null;
  return {
    dataUrl,
    width: dimensions.width,
    height: dimensions.height,
    format: dimensions.format,
  };
}

function drawCriticalValuesLogHeader(
  doc: jsPDF,
  logo: Awaited<ReturnType<typeof loadLogoForPdf>>,
  reportingPeriod?: string,
) {
  const pageWidth = doc.internal.pageSize.getWidth();

  if (logo) {
    doc.addImage(
      logo.dataUrl,
      logo.format,
      pageWidth / 2 - logo.width / 2,
      6,
      logo.width,
      logo.height,
    );
  }

  const textStartY = logo ? 24 : 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(CRITICAL_VALUES_LOG_HOSPITAL, pageWidth / 2, textStartY, { align: 'center' });
  doc.setFontSize(10);
  doc.text(CRITICAL_VALUES_LOG_DEPARTMENT, pageWidth / 2, textStartY + 5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(CRITICAL_VALUES_LOG_TITLE, pageWidth / 2, textStartY + 14, { align: 'center' });

  let dividerY = textStartY + 19;
  if (reportingPeriod) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Reporting Period: ${reportingPeriod}`, pageWidth / 2, textStartY + 20, { align: 'center' });
    dividerY = textStartY + 25;
  }

  doc.setLineWidth(0.2);
  doc.line(PRINT_PAGE_MARGIN_MM, dividerY, pageWidth - PRINT_PAGE_MARGIN_MM, dividerY);
}

export function getCriticalValuesPdfHeaderBlockMm(reportingPeriod?: string): number {
  return reportingPeriod ? 50 : 44;
}

function drawCriticalValuesLogFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 8;

  doc.setLineWidth(0.2);
  doc.line(PRINT_PAGE_MARGIN_MM, footerY - 4, pageWidth - PRINT_PAGE_MARGIN_MM, footerY - 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(CRITICAL_VALUES_LOG_FOOTER_LEFT, PRINT_PAGE_MARGIN_MM, footerY);
  doc.text(CRITICAL_VALUES_LOG_FOOTER_RIGHT, pageWidth - PRINT_PAGE_MARGIN_MM, footerY, { align: 'right' });
}

function drawSupervisorReviewBlock(doc: jsPDF, startY: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = startY + 8;
  if (y > pageHeight - 24) y = pageHeight - 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Supervisor Review:', PRINT_PAGE_MARGIN_MM, y);
  doc.setLineWidth(0.2);
  doc.line(PRINT_PAGE_MARGIN_MM + 34, y + 1, PRINT_PAGE_MARGIN_MM + 110, y + 1);
}

const CRITICAL_VALUE_PDF_COLUMN_WIDTHS: Record<number, { cellWidth: number }> = {
  0: { cellWidth: 10 },
  1: { cellWidth: 26 },
  2: { cellWidth: 16 },
  3: { cellWidth: 20 },
  4: { cellWidth: 16 },
  5: { cellWidth: 12 },
  6: { cellWidth: 15 },
  7: { cellWidth: 15 },
  8: { cellWidth: 11 },
  9: { cellWidth: 14 },
  10: { cellWidth: 20 },
  11: { cellWidth: 11 },
  12: { cellWidth: 22 },
  13: { cellWidth: 16 },
  14: { cellWidth: 15 },
};

export async function createCriticalValuesPdf(
  records: CriticalValue[],
  reportingPeriod?: string,
): Promise<jsPDF> {
  const doc = new jsPDF(PRINT_LANDSCAPE_PAGE);
  const logo = await loadLogoForPdf();
  const headerBlockMm = getCriticalValuesPdfHeaderBlockMm(reportingPeriod);
  const footerBlockMm = 18;

  drawCriticalValuesLogHeader(doc, logo, reportingPeriod);

  autoTable(doc, {
    startY: headerBlockMm,
    margin: {
      top: headerBlockMm,
      bottom: footerBlockMm,
      left: PRINT_PAGE_MARGIN_MM,
      right: PRINT_PAGE_MARGIN_MM,
    },
    tableWidth: getLandscapeTableWidth(doc.internal.pageSize.getWidth()),
    head: [CRITICAL_VALUE_LOG_HEADERS as unknown as string[]],
    body: records.map(mapCriticalValuePdfRow),
    styles: {
      fontSize: 7,
      cellPadding: 1.8,
      lineColor: [80, 80, 80],
      lineWidth: 0.1,
      overflow: 'linebreak',
      valign: 'middle',
      halign: 'center',
    },
    headStyles: {
      fillColor: [243, 244, 246],
      textColor: [17, 24, 39],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 6.5,
    },
    bodyStyles: {
      textColor: [17, 24, 39],
      halign: 'center',
    },
    columnStyles: {
      ...CRITICAL_VALUE_PDF_COLUMN_WIDTHS,
      1: { ...CRITICAL_VALUE_PDF_COLUMN_WIDTHS[1], halign: 'left' },
      12: { ...CRITICAL_VALUE_PDF_COLUMN_WIDTHS[12], halign: 'left' },
    },
    didDrawPage: () => {
      drawCriticalValuesLogHeader(doc, logo, reportingPeriod);
      drawCriticalValuesLogFooter(doc);
    },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? headerBlockMm;
  drawSupervisorReviewBlock(doc, finalY);

  return doc;
}
