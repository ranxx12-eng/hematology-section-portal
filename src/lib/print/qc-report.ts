import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';
import { formatCorrectiveActionsSummary } from '@/lib/qc-records/schema';
import {
  formatQCApprovalStatusLabel,
  formatQCFrequencyLabel,
  formatQCReviewStatusLabel,
} from '@/lib/qc-records/permissions';
import type { QCRecord } from '@/types';
import { getLandscapeTableWidth, PRINT_LANDSCAPE_PAGE, PRINT_PAGE_MARGIN_MM } from './landscape-layout';
import { printTimestamp, printValue } from './report-value';
import { loadOfficialLogoForPdf } from '@/lib/portal/official-logo';

export const QC_REPORT_HOSPITAL = 'AL SAHAFA HOSPITAL';
export const QC_REPORT_DEPARTMENT = 'LABORATORY DEPARTMENT';
export const QC_REPORT_TITLE = 'QUALITY CONTROL REPORT';
export const QC_REPORT_FOOTER = 'Quality Control Report';

export const QC_MAIN_TABLE_HEADERS = [
  'Date / Time',
  'Instrument',
  'Parameter',
  'Level',
  'QC Frequency',
  'QC Status',
  'Performed By',
  'Staff ID',
  'Review Status',
  'Approval Status',
  'Comment',
] as const;

export const QC_OUT_SECTION_HEADERS = [
  'Date / Time',
  'Instrument',
  'Parameter',
  'Level',
  'Corrective Actions',
  'Corrective Action Comment',
  'Resolution Status',
  'Action By',
  'Action At',
  'Resolved By',
  'Resolved At',
] as const;

export const QC_OUT_SECTION_TITLE = 'OUT QC CORRECTIVE ACTION DETAILS';

export const QC_WORKFLOW_SECTION_HEADERS = [
  'Date / Time',
  'Instrument',
  'Parameter',
  'QC Frequency',
  'Review Status',
  'Reviewed By',
  'Reviewer Staff ID',
  'Reviewed At',
  'Review Comment',
  'Approval Status',
  'Approved By',
  'Approver Staff ID',
  'Approved At',
  'Approval Comment',
] as const;

export const QC_WORKFLOW_SECTION_TITLE = 'QC REVIEW & APPROVAL';

function formatRecordedAt(recordedAt: string): string {
  return printTimestamp(recordedAt);
}

export function mapQCMainTableRow(
  record: QCRecord,
  instrumentName: string,
): string[] {
  return [
    formatRecordedAt(record.recordedAt),
    printValue(instrumentName),
    printValue(record.parameter),
    printValue(record.level),
    formatQCFrequencyLabel(record.qcFrequency),
    printValue(record.qcStatus),
    printValue(record.performedByName),
    printValue(record.performedByStaffId),
    formatQCReviewStatusLabel(record.reviewStatus),
    formatQCApprovalStatusLabel(record.approvalStatus),
    printValue(record.comment),
  ];
}

export function mapQCWorkflowSectionRow(
  record: QCRecord,
  instrumentName: string,
): string[] {
  return [
    formatRecordedAt(record.recordedAt),
    printValue(instrumentName),
    printValue(record.parameter),
    formatQCFrequencyLabel(record.qcFrequency),
    formatQCReviewStatusLabel(record.reviewStatus),
    printValue(record.reviewedByName),
    printValue(record.reviewedByStaffId),
    record.reviewedAt ? formatRecordedAt(record.reviewedAt) : '—',
    printValue(record.reviewComment),
    formatQCApprovalStatusLabel(record.approvalStatus),
    printValue(record.approvedByName),
    printValue(record.approvedByStaffId),
    record.approvedAt ? formatRecordedAt(record.approvedAt) : '—',
    printValue(record.approvalComment),
  ];
}

export function mapQCOutSectionRow(
  record: QCRecord,
  instrumentName: string,
): string[] {
  const correctiveActions = formatCorrectiveActionsSummary(
    record.correctiveActions,
    record.correctiveActionOther,
  );

  return [
    formatRecordedAt(record.recordedAt),
    printValue(instrumentName),
    printValue(record.parameter),
    printValue(record.level),
    correctiveActions.trim() ? correctiveActions : '—',
    printValue(record.correctiveActionComment),
    printValue(record.resolutionStatus),
    printValue(record.actionByName),
    record.actionAt ? formatRecordedAt(record.actionAt) : '—',
    printValue(record.resolvedByName),
    record.resolvedAt ? formatRecordedAt(record.resolvedAt) : '—',
  ];
}

export function buildQCMainTableRows(
  records: QCRecord[],
  instrumentNames: Record<string, string>,
): string[][] {
  return records.map((record) => mapQCMainTableRow(record, instrumentNames[record.instrumentId] ?? record.instrumentId));
}

export function buildQCOutSectionRows(
  records: QCRecord[],
  instrumentNames: Record<string, string>,
): string[][] {
  return records
    .filter((record) => record.qcStatus === 'OUT')
    .map((record) => mapQCOutSectionRow(record, instrumentNames[record.instrumentId] ?? record.instrumentId));
}

export function buildQCWorkflowSectionRows(
  records: QCRecord[],
  instrumentNames: Record<string, string>,
): string[][] {
  return records.map((record) => mapQCWorkflowSectionRow(record, instrumentNames[record.instrumentId] ?? record.instrumentId));
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

function drawQCReportHeader(
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
  doc.text(QC_REPORT_HOSPITAL, pageWidth / 2, textStartY, { align: 'center' });
  doc.setFontSize(10);
  doc.text(QC_REPORT_DEPARTMENT, pageWidth / 2, textStartY + 5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(QC_REPORT_TITLE, pageWidth / 2, textStartY + 14, { align: 'center' });

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

function drawQCFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 8;

  doc.setLineWidth(0.2);
  doc.line(PRINT_PAGE_MARGIN_MM, footerY - 4, pageWidth - PRINT_PAGE_MARGIN_MM, footerY - 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(QC_REPORT_FOOTER, pageWidth / 2, footerY, { align: 'center' });
}

export async function createQCReportPdf(
  records: QCRecord[],
  instrumentNames: Record<string, string>,
  reportingPeriod?: string,
): Promise<jsPDF> {
  const doc = new jsPDF(PRINT_LANDSCAPE_PAGE);
  const logo = await loadLogoForPdf();
  const pageWidth = doc.internal.pageSize.getWidth();
  const tableWidth = getLandscapeTableWidth(pageWidth);
  const mainRows = buildQCMainTableRows(records, instrumentNames);
  const outRows = buildQCOutSectionRows(records, instrumentNames);
  const workflowRows = buildQCWorkflowSectionRows(records, instrumentNames);

  drawQCReportHeader(doc, logo, reportingPeriod);

  autoTable(doc, {
    head: [QC_MAIN_TABLE_HEADERS as unknown as string[]],
    body: mainRows,
    startY: reportingPeriod ? 50 : 44,
    margin: { left: PRINT_PAGE_MARGIN_MM, right: PRINT_PAGE_MARGIN_MM, bottom: 16 },
    tableWidth,
    styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
    headStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold' },
    didDrawPage: () => {
      drawQCFooter(doc);
    },
  });

  if (outRows.length > 0) {
    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 50;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(QC_OUT_SECTION_TITLE, PRINT_PAGE_MARGIN_MM, finalY + 8);

    autoTable(doc, {
      head: [QC_OUT_SECTION_HEADERS as unknown as string[]],
      body: outRows,
      startY: finalY + 12,
      margin: { left: PRINT_PAGE_MARGIN_MM, right: PRINT_PAGE_MARGIN_MM, bottom: 16 },
      tableWidth,
      styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [254, 226, 226], textColor: [0, 0, 0], fontStyle: 'bold' },
      didDrawPage: () => {
        drawQCFooter(doc);
      },
    });
  }

  if (workflowRows.length > 0) {
    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 50;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(QC_WORKFLOW_SECTION_TITLE, PRINT_PAGE_MARGIN_MM, finalY + 8);

    autoTable(doc, {
      head: [QC_WORKFLOW_SECTION_HEADERS as unknown as string[]],
      body: workflowRows,
      startY: finalY + 12,
      margin: { left: PRINT_PAGE_MARGIN_MM, right: PRINT_PAGE_MARGIN_MM, bottom: 16 },
      tableWidth,
      styles: { fontSize: 6.5, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [219, 234, 254], textColor: [0, 0, 0], fontStyle: 'bold' },
      didDrawPage: () => {
        drawQCFooter(doc);
      },
    });
  }

  return doc;
}
