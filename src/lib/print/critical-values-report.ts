import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';
import { displayEscalationTo, formatReadBack, formatTestsList } from '@/lib/critical-values/schema';
import type { CriticalValue } from '@/types';
import {
  getPrintFormMetadata,
  PRINT_HOSPITAL_NAME,
  PRINT_SECTION_NAME,
} from './form-metadata';
import { getLandscapeTableWidth, PRINT_LANDSCAPE_PAGE, PRINT_PAGE_MARGIN_MM } from './landscape-layout';
import { printList, printValue } from './report-value';
import { loadOfficialLogoForPdf } from '@/lib/portal/official-logo';

export const CRITICAL_VALUE_REPORT_TITLE = 'CRITICAL VALUE REPORT';

export const CRITICAL_VALUE_PDF_HEADERS = [
  'Date',
  'Patient',
  'ACC#',
  'Tests',
  'Read Back',
  'Critical Value',
  'Informed to Dr',
  'Department',
  'Escalation To',
  'Verify Time',
  'Informed Time',
  'Initial',
] as const;

export const CRITICAL_VALUE_PRINT_HEADERS = [
  'Date',
  'Patient ID',
  'Patient Name',
  'Lab Accession',
  'Tests',
  'Read Back',
  'Critical Value',
  'Informed to Dr',
  'Department',
  'Escalation To',
  'Verify Time',
  'Informed Time',
  'Initial',
  'Review',
] as const;

function mapCriticalValuePdfRow(record: CriticalValue): string[] {
  return [
    printValue(record.date),
    printValue(record.patientName),
    printValue(record.patientAccNumber),
    printList(record.tests, '; '),
    printValue(formatReadBack(record.readBack)),
    printValue(record.criticalValue),
    printValue(record.informedToDr),
    printValue(record.department),
    printValue(displayEscalationTo(record.escalationTo)),
    printValue(record.verifyTime),
    printValue(record.informedTime),
    printValue(record.initial),
  ];
}

function mapCriticalValuePrintRow(record: CriticalValue): string[] {
  return [
    printValue(record.date),
    printValue(record.patientId),
    printValue(record.patientName),
    printValue(record.patientAccNumber),
    printList(record.tests, '; '),
    printValue(formatReadBack(record.readBack)),
    printValue(record.criticalValue),
    printValue(record.informedToDr),
    printValue(record.department),
    printValue(displayEscalationTo(record.escalationTo)),
    printValue(record.verifyTime),
    printValue(record.informedTime),
    printValue(record.initial),
    printValue(record.reviewStatus),
  ];
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

function drawLandscapePdfHeader(
  doc: jsPDF,
  logo: Awaited<ReturnType<typeof loadLogoForPdf>>,
  title: string,
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
  doc.text(PRINT_HOSPITAL_NAME, pageWidth / 2, textStartY, { align: 'center' });
  doc.setFontSize(10);
  doc.text(PRINT_SECTION_NAME, pageWidth / 2, textStartY + 5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(title, pageWidth / 2, textStartY + 14, { align: 'center' });

  const dividerY = textStartY + 19;
  doc.setLineWidth(0.2);
  doc.line(PRINT_PAGE_MARGIN_MM, dividerY, pageWidth - PRINT_PAGE_MARGIN_MM, dividerY);
}

function drawLandscapePdfFooter(doc: jsPDF, formKey: 'criticalValues' | 'sampleRejections') {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const { formName, formNo } = getPrintFormMetadata(formKey);
  const footerY = pageHeight - 8;

  doc.setLineWidth(0.2);
  doc.line(PRINT_PAGE_MARGIN_MM, footerY - 4, pageWidth - PRINT_PAGE_MARGIN_MM, footerY - 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Form Name: ${formName}`, PRINT_PAGE_MARGIN_MM, footerY);
  doc.text(`Form No.: ${formNo}`, pageWidth - PRINT_PAGE_MARGIN_MM, footerY, { align: 'right' });
}

const CRITICAL_VALUE_PDF_COLUMN_WIDTHS = {
  0: { cellWidth: 18 },
  1: { cellWidth: 22 },
  2: { cellWidth: 16 },
  3: { cellWidth: 24 },
  4: { cellWidth: 14 },
  5: { cellWidth: 18 },
  6: { cellWidth: 22 },
  7: { cellWidth: 20 },
  8: { cellWidth: 20 },
  9: { cellWidth: 18 },
  10: { cellWidth: 18 },
  11: { cellWidth: 14 },
};

export async function createCriticalValuesPdf(records: CriticalValue[]): Promise<jsPDF> {
  const doc = new jsPDF(PRINT_LANDSCAPE_PAGE);
  const logo = await loadLogoForPdf();
  const headerBlockMm = 44;
  const footerBlockMm = 14;

  drawLandscapePdfHeader(doc, logo, CRITICAL_VALUE_REPORT_TITLE);

  autoTable(doc, {
    startY: headerBlockMm,
    margin: {
      top: headerBlockMm,
      bottom: footerBlockMm,
      left: PRINT_PAGE_MARGIN_MM,
      right: PRINT_PAGE_MARGIN_MM,
    },
    tableWidth: getLandscapeTableWidth(doc.internal.pageSize.getWidth()),
    head: [CRITICAL_VALUE_PDF_HEADERS as unknown as string[]],
    body: records.map(mapCriticalValuePdfRow),
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
      lineColor: [120, 120, 120],
      lineWidth: 0.1,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [243, 244, 246],
      textColor: [17, 24, 39],
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      textColor: [17, 24, 39],
    },
    columnStyles: CRITICAL_VALUE_PDF_COLUMN_WIDTHS,
    didDrawPage: () => {
      drawLandscapePdfHeader(doc, logo, CRITICAL_VALUE_REPORT_TITLE);
      drawLandscapePdfFooter(doc, 'criticalValues');
    },
  });

  return doc;
}
