import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';
import {
  FORM_HEMA_020_CODE,
  FORM_HEMA_020_QID,
  FORM_HEMA_020_TITLE,
} from '@/lib/qc-lot-verification/constants';
import { buildParameterSummary, buildRunProgress } from '@/lib/qc-lot-verification/cbc-calculation';
import { QC_VERIFICATION_FINAL_DECISION_LABELS, QC_VERIFICATION_STATUS_LABELS } from '@/lib/qc-lot-verification/constants';
import { PRINT_PAGE_MARGIN_MM } from '@/lib/print/landscape-layout';
import {
  QC_PRINT_DEPARTMENT,
  QC_PRINT_HOSPITAL,
  QC_PRINT_SECTION,
} from '@/lib/print/qc-print-templates';
import { loadOfficialLogoForPdf } from '@/lib/portal/official-logo';
import type { QcLotVerificationStudy } from '@/types/qc-lot-verification';

async function drawHeader(doc: jsPDF): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 10;
  const logo = await loadOfficialLogoForPdf();
  if (logo.dataUrl && logo.dimensions) {
    doc.addImage(logo.dataUrl, logo.dimensions.format, pageWidth / 2 - logo.dimensions.width / 2, 6, logo.dimensions.width, logo.dimensions.height);
    y = 24;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(QC_PRINT_HOSPITAL, pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(9.5);
  doc.text(QC_PRINT_DEPARTMENT, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text(QC_PRINT_SECTION, pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(FORM_HEMA_020_TITLE.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${FORM_HEMA_020_CODE} · ${FORM_HEMA_020_QID}`, pageWidth / 2, y, { align: 'center' });
  return y + 8;
}

export async function createQcForm020Pdf(study: QcLotVerificationStudy): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let y = await drawHeader(doc);

  const progress = buildRunProgress(study.runs);
  const summary = buildParameterSummary(study.parameters);

  doc.setFontSize(9);
  doc.text(`Study #: ${study.studyNumber}`, PRINT_PAGE_MARGIN_MM, y);
  doc.text(`QC Material: ${study.qcMaterialName}`, PRINT_PAGE_MARGIN_MM + 70, y);
  doc.text(`Lot: ${study.lotNumber}`, PRINT_PAGE_MARGIN_MM + 150, y);
  y += 5;
  doc.text(`Instrument: ${study.instrumentNameSnapshot ?? '—'}`, PRINT_PAGE_MARGIN_MM, y);
  doc.text(`Status: ${QC_VERIFICATION_STATUS_LABELS[study.status]}`, PRINT_PAGE_MARGIN_MM + 70, y);
  doc.text(`Runs: ${progress.completedRuns}/${progress.totalRuns}`, PRINT_PAGE_MARGIN_MM + 150, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Parameter', 'Mfr Mean', 'Mfr SD', 'Mfr Low', 'Mfr High', 'Est Mean', 'Est SD', 'Est Low', 'Est High', 'Diff', 'SDI', 'Result']],
    body: study.parameters.map((p) => [
      p.parameterName,
      p.manufacturerMean ?? '',
      p.manufacturerSd ?? '',
      p.manufacturerLower ?? '',
      p.manufacturerUpper ?? '',
      p.establishedMean ?? '',
      p.establishedSd ?? '',
      p.establishedLower ?? '',
      p.establishedUpper ?? '',
      p.difference ?? '',
      p.sdi ?? '',
      p.result.toUpperCase(),
    ]),
    margin: { left: PRINT_PAGE_MARGIN_MM, right: PRINT_PAGE_MARGIN_MM },
    styles: { fontSize: 6.5, cellPadding: 1 },
    headStyles: { fillColor: [91, 63, 214] },
    theme: 'grid',
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.text(`Summary — Passed: ${summary.passed} · Failed: ${summary.failed} · Manual Review: ${summary.manualReview} · Incomplete: ${summary.incomplete}`, PRINT_PAGE_MARGIN_MM, y);
  y += 5;
  if (study.finalDecision) {
    doc.text(`Final Decision: ${QC_VERIFICATION_FINAL_DECISION_LABELS[study.finalDecision]}`, PRINT_PAGE_MARGIN_MM, y);
    y += 5;
  }
  if (study.preparedByName) doc.text(`Prepared: ${study.preparedByName}`, PRINT_PAGE_MARGIN_MM, y);
  if (study.reviewedByName) doc.text(`Reviewed: ${study.reviewedByName}`, PRINT_PAGE_MARGIN_MM + 60, y);
  if (study.approvedByName) doc.text(`Approved: ${study.approvedByName}`, PRINT_PAGE_MARGIN_MM + 120, y);

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`${FORM_HEMA_020_CODE} · Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
  }

  return doc.output('blob');
}
