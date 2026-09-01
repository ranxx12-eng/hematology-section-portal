import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';
import {
  FORM_HEMA_016_FOOTER,
  FORM_HEMA_016_QID,
  FORM_HEMA_016_TITLE,
  QC_CORRECTIVE_ACTION_LEGEND,
  formatCorrectiveActionDisplay,
  monthName,
} from '@/lib/qc-corrective-actions/constants';
import { PRINT_PAGE_MARGIN_MM } from '@/lib/print/landscape-layout';
import {
  QC_PRINT_DEPARTMENT,
  QC_PRINT_HOSPITAL,
} from '@/lib/print/qc-print-templates';
import { printTimestamp, printValue } from '@/lib/print/report-value';
import { loadOfficialLogoForPdf } from '@/lib/portal/official-logo';
import type { QcCorrectiveMonthlyReview, QcCorrectiveWorklistItem } from '@/types/qc-corrective-action';

export interface Form016PrintPayload {
  year: number;
  month: number;
  instrumentName: string;
  qcMaterialLabel: string;
  rows: QcCorrectiveWorklistItem[];
  monthlyReview?: QcCorrectiveMonthlyReview | null;
}

const ROWS_PER_PAGE_ESTIMATE = 14;

async function drawFormHeader(doc: jsPDF, payload: Form016PrintPayload): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 10;
  const logo = await loadOfficialLogoForPdf();
  if (logo.dataUrl && logo.dimensions) {
    doc.addImage(
      logo.dataUrl,
      logo.dimensions.format,
      pageWidth / 2 - logo.dimensions.width / 2,
      6,
      logo.dimensions.width,
      logo.dimensions.height,
    );
    y = 24;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(QC_PRINT_HOSPITAL, pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(9.5);
  doc.text(QC_PRINT_DEPARTMENT, pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('QUALITY CONTROL CORRECTIVE ACTION FORM', pageWidth / 2, y, { align: 'center' });
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('QC Information:', PRINT_PAGE_MARGIN_MM, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(`Analyzer: ${printValue(payload.instrumentName)}`, PRINT_PAGE_MARGIN_MM, y);
  y += 4;
  doc.text(`QC Material: ${printValue(payload.qcMaterialLabel)}`, PRINT_PAGE_MARGIN_MM, y);
  y += 4;
  doc.text(`Reporting Period: ${monthName(payload.month)} ${payload.year}`, PRINT_PAGE_MARGIN_MM, y);
  return y + 8;
}

function drawLegend(doc: jsPDF, startY: number): number {
  let y = startY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('CORRECTIVE ACTION TAKEN:', PRINT_PAGE_MARGIN_MM, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  for (const [code, label] of Object.entries(QC_CORRECTIVE_ACTION_LEGEND)) {
    doc.text(`${code} — ${label}`, PRINT_PAGE_MARGIN_MM, y);
    y += 3.5;
  }
  return y + 4;
}

function buildRemarks(rows: QcCorrectiveWorklistItem[]): string[] {
  const remarks: string[] = [];
  rows.forEach((row, index) => {
    const parts = [
      row.explanation ? String(row.explanation) : null,
      row.correctiveActionLabel,
    ].filter(Boolean);
    const note = row.existingQcCorrectiveNotes;
    const merged = [parts.join(' — '), note].filter(Boolean).join(' | ');
    if (merged.trim()) {
      remarks.push(`${index + 1}. ${row.analyte} ${row.qcLevel} — ${merged}`);
    }
  });
  return remarks;
}

function drawSignatures(doc: jsPDF, payload: Form016PrintPayload, startY: number): number {
  const review = payload.monthlyReview;
  let y = startY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Prepared by', PRINT_PAGE_MARGIN_MM, y);
  doc.text('Reviewed by', PRINT_PAGE_MARGIN_MM + 65, y);
  doc.text('Approved by', PRINT_PAGE_MARGIN_MM + 130, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.text(printValue(review?.preparedByName), PRINT_PAGE_MARGIN_MM, y);
  doc.text(printValue(review?.reviewedByName), PRINT_PAGE_MARGIN_MM + 65, y);
  doc.text(printValue(review?.approvedByName), PRINT_PAGE_MARGIN_MM + 130, y);
  y += 4;
  doc.text(
    review?.preparedAt ? printTimestamp(review.preparedAt) : '—',
    PRINT_PAGE_MARGIN_MM,
    y,
  );
  doc.text(
    review?.reviewedAt ? printTimestamp(review.reviewedAt) : '—',
    PRINT_PAGE_MARGIN_MM + 65,
    y,
  );
  doc.text(
    review?.approvedAt ? printTimestamp(review.approvedAt) : '—',
    PRINT_PAGE_MARGIN_MM + 130,
    y,
  );
  return y + 8;
}

function drawFooter(doc: jsPDF): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(FORM_HEMA_016_FOOTER, PRINT_PAGE_MARGIN_MM, pageHeight - 8);
  doc.text(FORM_HEMA_016_QID, pageWidth - PRINT_PAGE_MARGIN_MM, pageHeight - 8, { align: 'right' });
}

function resolveQcMaterialLabel(rows: QcCorrectiveWorklistItem[]): string {
  const materials = [...new Set(rows.map((row) => row.qcMaterial))];
  if (materials.length === 1) return materials[0];
  return 'Multiple — see table';
}

export async function createQcForm016Pdf(payload: Form016PrintPayload): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const materialLabel = payload.qcMaterialLabel || resolveQcMaterialLabel(payload.rows);
  const fullPayload = { ...payload, qcMaterialLabel: materialLabel };

  let y = await drawFormHeader(doc, fullPayload);

  autoTable(doc, {
    startY: y,
    head: [['ANALYTES', 'QC LEVEL', 'FAILED VALUE', 'CORRECTED VALUE', 'CORRECTIVE ACTION']],
    body: payload.rows.map((row) => [
      row.analyte,
      row.qcLevel,
      row.failedValue,
      row.correctedValue ?? '—',
      row.correctiveActionCode
        ? formatCorrectiveActionDisplay(row.correctiveActionCode).split(' — ')[0]
        : '—',
    ]),
    margin: { left: PRINT_PAGE_MARGIN_MM, right: PRINT_PAGE_MARGIN_MM },
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [91, 63, 214] },
    theme: 'grid',
    showFoot: 'everyPage',
    didDrawPage: () => {
      drawFooter(doc);
    },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  if (y > doc.internal.pageSize.getHeight() - 70) {
    doc.addPage();
    y = 20;
  }

  const remarks = buildRemarks(payload.rows);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('REMARKS', PRINT_PAGE_MARGIN_MM, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  if (remarks.length === 0) {
    doc.text('—', PRINT_PAGE_MARGIN_MM, y);
    y += 6;
  } else {
    for (const line of remarks) {
      const wrapped = doc.splitTextToSize(line, doc.internal.pageSize.getWidth() - PRINT_PAGE_MARGIN_MM * 2);
      doc.text(wrapped, PRINT_PAGE_MARGIN_MM, y);
      y += wrapped.length * 3.5 + 1;
      if (y > doc.internal.pageSize.getHeight() - 50) {
        doc.addPage();
        y = 20;
      }
    }
  }

  y = drawLegend(doc, y + 4);

  if (y > doc.internal.pageSize.getHeight() - 30) {
    doc.addPage();
    y = 20;
  }

  drawSignatures(doc, fullPayload, y);
  drawFooter(doc);

  return doc.output('blob');
}

export function estimateForm016PageCount(rowCount: number): number {
  return Math.max(1, Math.ceil(rowCount / ROWS_PER_PAGE_ESTIMATE));
}
