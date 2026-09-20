import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';
import {
  FORM_HEMA_022_CODE,
  FORM_HEMA_022_QID,
  FORM_HEMA_022_TITLE,
} from '@/lib/inventory/form-hema-022/constants';
import { groupFormHema022Results } from '@/lib/clinical/inventory-reagent-lot-form-hema-022';
import { LOT_INTERPRETATION_LABELS } from '@/lib/inventory/constants';
import { PRINT_PAGE_MARGIN_MM } from '@/lib/print/landscape-layout';
import {
  QC_PRINT_DEPARTMENT,
  QC_PRINT_HOSPITAL,
  QC_PRINT_SECTION,
} from '@/lib/print/qc-print-templates';
import { loadOfficialLogoForPdf } from '@/lib/portal/official-logo';
import type { ReagentLotComparison } from '@/types/inventory-module';

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

export async function createFormHema022Pdf(
  study: ReagentLotComparison,
  sampleIds: Record<number, string>,
): Promise<Blob> {
  const layoutLabel = study.formLayout === 'stago_sta_r_max' ? 'Stago STA-R MAX' : 'ALINITY HQ';
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let y = await drawHeader(doc, layoutLabel);

  doc.setFontSize(9);
  doc.text(`Study #: ${study.studyNumber}`, PRINT_PAGE_MARGIN_MM, y);
  doc.text(`Year: ${study.studyYear ?? '—'}`, PRINT_PAGE_MARGIN_MM + 55, y);
  doc.text(`Reagent: ${study.reagentName}`, PRINT_PAGE_MARGIN_MM + 90, y);
  doc.text(`Instrument: ${study.instrumentNameSnapshot ?? '—'}`, PRINT_PAGE_MARGIN_MM + 150, y);
  y += 5;
  doc.text(`Previous lot: ${study.oldLotNumber}`, PRINT_PAGE_MARGIN_MM, y);
  doc.text(`New lot: ${study.newLotNumber}`, PRINT_PAGE_MARGIN_MM + 55, y);
  doc.text(`Study date: ${study.studyDate ?? '—'}`, PRINT_PAGE_MARGIN_MM + 110, y);
  doc.text(`Group: ${study.analyteTestGroup ?? '—'}`, PRINT_PAGE_MARGIN_MM + 160, y);
  y += 8;

  const grouped = groupFormHema022Results(study.results);
  for (const sampleNumber of [...grouped.keys()].sort((a, b) => a - b)) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Sample ${sampleNumber} · ID ${sampleIds[sampleNumber] ?? '—'}`, PRINT_PAGE_MARGIN_MM, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Test', 'Unit', 'Previous', 'New', 'Signed Δ', '|Δ|', 'Δ%', 'Limit', 'Interpretation', 'Comment']],
      body: (grouped.get(sampleNumber) ?? []).map((result) => [
        result.testLabel ?? result.testCode ?? '—',
        result.unit ?? '—',
        result.oldResult ?? '',
        result.newResult ?? '',
        result.differenceUnits ?? '',
        result.absoluteDifferenceUnits ?? '',
        result.differencePercent != null ? `${result.differencePercent.toFixed(2)}%` : '',
        result.acceptanceLimitPercent != null ? `${result.acceptanceLimitPercent}%` : '—',
        LOT_INTERPRETATION_LABELS[result.interpretation],
        result.comment ?? '',
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
