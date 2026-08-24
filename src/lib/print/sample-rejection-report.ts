import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';
import { SUPERVISOR_REVIEW_STATUS_LABELS } from '@/lib/sample-rejections/constants';
import type { SampleRejection } from '@/types';
import {
  getPrintFormMetadata,
  PRINT_HOSPITAL_NAME,
  PRINT_SECTION_NAME,
} from './form-metadata';
import {
  printDateTime,
  printDiscardStatus,
  printList,
  printValue,
} from './report-value';
import { loadOfficialLogoForPdf } from '@/lib/portal/official-logo';

export const SAMPLE_REJECTION_REPORT_TITLE = 'SAMPLE REJECTION REPORT';

const PDF_MARGIN = 14;
const PDF_HEADER_BLOCK_MM = 52;
const PDF_FOOTER_BLOCK_MM = 16;

function mapRejectionToPrintRow(record: SampleRejection): string[] {
  return [
    printValue(record.patientName),
    printValue(record.patientId),
    printValue(record.patientLabAccNumber),
    printValue(record.department),
    printDateTime(record.rejectionDate, record.rejectionTime),
    printList(record.rejectedTests),
    printValue(record.rejectedTube),
    printList(record.rejectionReasons),
    printValue(record.replacementSampleStatus),
    printValue(SUPERVISOR_REVIEW_STATUS_LABELS[record.supervisorReviewStatus] ?? record.supervisorReviewStatus),
    printValue(record.reviewedByName),
    printDateTime(record.reviewedDate, record.reviewedTime),
    printDiscardStatus(record.discardStatus, record.discardDueAt),
    printValue(record.discardedByName),
    printDateTime(record.discardDate, record.discardTime),
  ];
}

export const SAMPLE_REJECTION_PRINT_HEADERS = [
  'Patient Name',
  'Patient ID / MRN',
  'ACC#',
  'Department',
  'Date',
  'Tests',
  'Tube',
  'Reasons',
  'Replacement Status',
  'Review Status',
  'Reviewed By',
  'Reviewed At',
  'Discard Status',
  'Discarded By',
  'Discarded At',
] as const;

export function buildSampleRejectionPrintRows(records: SampleRejection[]): string[][] {
  return records.map(mapRejectionToPrintRow);
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

function drawPortraitPdfHeader(doc: jsPDF, logo: Awaited<ReturnType<typeof loadLogoForPdf>>) {
  const pageWidth = doc.internal.pageSize.getWidth();

  if (logo) {
    doc.addImage(
      logo.dataUrl,
      logo.format,
      pageWidth / 2 - logo.width / 2,
      8,
      logo.width,
      logo.height,
    );
  }

  const textStartY = logo ? 28 : 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(PRINT_HOSPITAL_NAME, pageWidth / 2, textStartY, { align: 'center' });
  doc.setFontSize(10);
  doc.text(PRINT_SECTION_NAME, pageWidth / 2, textStartY + 5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(SAMPLE_REJECTION_REPORT_TITLE, pageWidth / 2, textStartY + 16, { align: 'center' });

  const dividerY = textStartY + 22;
  doc.setLineWidth(0.2);
  doc.line(PDF_MARGIN, dividerY, pageWidth - PDF_MARGIN, dividerY);
}

function drawPortraitPdfFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const { formName, formNo } = getPrintFormMetadata('sampleRejections');
  const footerY = pageHeight - 10;

  doc.setLineWidth(0.2);
  doc.line(PDF_MARGIN, footerY - 5, pageWidth - PDF_MARGIN, footerY - 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Form Name: ${formName}`, PDF_MARGIN, footerY);
  doc.text(`Form No.: ${formNo}`, pageWidth - PDF_MARGIN, footerY, { align: 'right' });
}

export async function createSampleRejectionPdf(records: SampleRejection[]): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logo = await loadLogoForPdf();
  drawPortraitPdfHeader(doc, logo);

  autoTable(doc, {
    startY: PDF_HEADER_BLOCK_MM,
    margin: {
      top: PDF_HEADER_BLOCK_MM,
      bottom: PDF_FOOTER_BLOCK_MM,
      left: PDF_MARGIN,
      right: PDF_MARGIN,
    },
    head: [SAMPLE_REJECTION_PRINT_HEADERS as unknown as string[]],
    body: buildSampleRejectionPrintRows(records),
    styles: {
      fontSize: 8,
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
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 16 },
      2: { cellWidth: 14 },
      3: { cellWidth: 18 },
      4: { cellWidth: 18 },
      5: { cellWidth: 18 },
      6: { cellWidth: 12 },
      7: { cellWidth: 24 },
      8: { cellWidth: 18 },
      9: { cellWidth: 14 },
      10: { cellWidth: 16 },
      11: { cellWidth: 16 },
      12: { cellWidth: 18 },
      13: { cellWidth: 16 },
      14: { cellWidth: 16 },
    },
    didDrawPage: () => {
      drawPortraitPdfHeader(doc, logo);
      drawPortraitPdfFooter(doc);
    },
  });

  return doc;
}
