import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';
import {
  FORM_HEMA_022_CODE,
  FORM_HEMA_022_QID,
  FORM_HEMA_022_TITLE,
} from '@/lib/inventory/form-hema-022/constants';
import { groupFormHema022Results } from '@/lib/clinical/inventory-reagent-lot-form-hema-022';
import { pdfSampleIdDisplay } from '@/lib/security/sample-id-crypto';
import { PRINT_PAGE_MARGIN_MM } from '@/lib/print/landscape-layout';
import {
  QC_PRINT_DEPARTMENT,
  QC_PRINT_HOSPITAL,
  QC_PRINT_SECTION,
} from '@/lib/print/qc-print-templates';
import { loadOfficialLogoForPdf } from '@/lib/portal/official-logo';
import type { ReagentLotComparison } from '@/types/inventory-module';

function taeNote(study: ReagentLotComparison): string {
  if (study.formLayout === 'stago_sta_r_max') {
    return 'Quantitative Test: Use Total Allowable Error (TAE) PT: +/- 15 %. PTT: +/- 15 %. DDi: +/- 15 %. FIB: +/- 20 %.';
  }
  return 'Quantitative Test: Use Total Allowable Error (TAE) WBC: +/- 15 %. RBC: +/- 6 %. HGB: +/- 7 %. PLT: +/- 25 %.';
}

async function drawHeader(doc: jsPDF, layoutLabel: string): Promise<number> {
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
  y += 4;
  doc.text(QC_PRINT_SECTION, pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(FORM_HEMA_022_TITLE.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${FORM_HEMA_022_CODE} · ${FORM_HEMA_022_QID} · ${layoutLabel}`, pageWidth / 2, y, { align: 'center' });
  return y + 8;
}

export async function createFormHema022Pdf(study: ReagentLotComparison): Promise<Blob> {
  const layoutLabel = study.formLayout === 'stago_sta_r_max' ? 'Stago STA_R MAX' : 'ALINITY HQ';
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let y = await drawHeader(doc, layoutLabel);

  doc.setFontSize(9);
  doc.text(`Year: ${study.studyYear ?? '—'}`, PRINT_PAGE_MARGIN_MM, y);
  doc.text(`Analyte: ${study.analyteTestGroup ?? '—'}`, PRINT_PAGE_MARGIN_MM + 35, y);
  doc.text(`Reagent: ${study.reagentName}`, PRINT_PAGE_MARGIN_MM + 80, y);
  doc.text(`Instrument: ${study.instrumentNameSnapshot ?? '—'}`, PRINT_PAGE_MARGIN_MM + 140, y);
  y += 5;
  doc.setFontSize(8);
  const taeLines = doc.splitTextToSize(taeNote(study), doc.internal.pageSize.getWidth() - PRINT_PAGE_MARGIN_MM * 2);
  doc.text(taeLines, PRINT_PAGE_MARGIN_MM, y);
  y += taeLines.length * 4 + 4;

  const grouped = groupFormHema022Results(study.results);
  for (const sampleNumber of [...grouped.keys()].sort((a, b) => a - b)) {
    const sampleMeta = study.sampleIdentifiers?.find((entry) => entry.sampleNumber === sampleNumber);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`Date: ${study.studyDate ?? '—'}`, PRINT_PAGE_MARGIN_MM, y);
    doc.text(`Previous lot: ${study.oldLotNumber}`, PRINT_PAGE_MARGIN_MM + 45, y);
    doc.text(`Prev expiry: ${study.oldLotSnapshot?.expiryDate ?? '—'}`, PRINT_PAGE_MARGIN_MM + 90, y);
    doc.text(`New lot: ${study.newLotNumber}`, PRINT_PAGE_MARGIN_MM + 135, y);
    doc.text(`New expiry: ${study.newLotSnapshot?.expiryDate ?? '—'}`, PRINT_PAGE_MARGIN_MM + 175, y);
    y += 5;
    doc.text(
      pdfSampleIdDisplay(sampleNumber, sampleMeta?.isSynthetic ?? true),
      PRINT_PAGE_MARGIN_MM,
      y,
    );
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [[
        'Test',
        'Previous',
        'New',
        'Difference (units)',
        'Difference (percent)',
        'Comments',
        'Initials',
        'Supervisor Review',
      ]],
      body: (grouped.get(sampleNumber) ?? []).map((result) => [
        result.testLabel ?? result.testCode ?? '—',
        result.oldResult ?? '',
        result.newResult ?? '',
        result.differenceUnits ?? '',
        result.differencePercent != null ? `${result.differencePercent.toFixed(1)}%` : '',
        result.comment ?? '',
        result.recordedByStaffId ?? result.recordedByName ?? '',
        study.reviewedByName ?? '',
      ]),
      margin: { left: PRINT_PAGE_MARGIN_MM, right: PRINT_PAGE_MARGIN_MM },
      styles: { fontSize: 7, cellPadding: 1 },
      headStyles: { fillColor: [91, 63, 214] },
      theme: 'grid',
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  y += 2;
  doc.setFont('helvetica', 'normal');
  if (study.preparedByName) doc.text(`Prepared by: ${study.preparedByName}`, PRINT_PAGE_MARGIN_MM, y);
  if (study.reviewedByName) doc.text(`Reviewed by: ${study.reviewedByName}`, PRINT_PAGE_MARGIN_MM + 80, y);
  if (study.approvedByName) doc.text(`Approved by: ${study.approvedByName}`, PRINT_PAGE_MARGIN_MM + 160, y);

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`${FORM_HEMA_022_CODE} · Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
  }

  return doc.output('blob');
}
