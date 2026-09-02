import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';
import {
  AGREEMENT_NOTE,
  CLOT_STATUS_LABELS,
  FORM_HEMA_010_FOOTER,
  FORM_HEMA_010_QID,
  FORM_HEMA_010_TITLE,
  RBC_FORMULA_DIVISOR,
  SPECIMEN_TYPE_LABELS,
  WBC_FORMULA_DIVISOR,
  agreementDisplay,
  deriveBodyFluidCounts,
  formatCellsPerMm3,
  normalizeSideNumber,
  resolveDilutionFactor,
  side2IsActive,
} from '@/lib/medical-reports/body-fluid-logic';
import { PRINT_PAGE_MARGIN_MM } from '@/lib/print/landscape-layout';
import {
  QC_PRINT_DEPARTMENT,
  QC_PRINT_HOSPITAL,
  QC_PRINT_SECTION,
} from '@/lib/print/qc-print-templates';
import { loadOfficialLogoForPdf } from '@/lib/portal/official-logo';
import type { BodyFluidWorksheet } from '@/types/body-fluid-worksheet';

async function loadLogoForPdf() {
  const { dataUrl, dimensions } = await loadOfficialLogoForPdf();
  if (!dataUrl || !dimensions) return null;
  return { dataUrl, ...dimensions };
}

function drawFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 8;
  doc.setLineWidth(0.2);
  doc.line(PRINT_PAGE_MARGIN_MM, footerY - 4, pageWidth - PRINT_PAGE_MARGIN_MM, footerY - 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(FORM_HEMA_010_FOOTER, PRINT_PAGE_MARGIN_MM, footerY);
  doc.text(FORM_HEMA_010_QID, pageWidth - PRINT_PAGE_MARGIN_MM, footerY, { align: 'right' });
}

async function drawHeader(doc: jsPDF): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 10;
  const logo = await loadLogoForPdf();

  if (logo) {
    doc.addImage(logo.dataUrl, logo.format, pageWidth / 2 - logo.width / 2, 6, logo.width, logo.height);
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
  doc.text(FORM_HEMA_010_TITLE, pageWidth / 2, y, { align: 'center' });
  return y + 8;
}

function formatSpecimenType(worksheet: BodyFluidWorksheet): string {
  if (!worksheet.specimenType) return '';
  if (worksheet.specimenType === 'other') {
    return worksheet.specimenTypeOther?.trim() || 'Other';
  }
  return SPECIMEN_TYPE_LABELS[worksheet.specimenType] ?? worksheet.specimenType;
}

function formatDateTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getSquareValues(
  worksheet: BodyFluidWorksheet,
  techNumber: 1 | 2,
  cellType: 'wbc' | 'rbc',
  sideNumber: 1 | 2 = 1,
): string[] {
  const squareCount = cellType === 'wbc' ? 4 : 5;
  return Array.from({ length: squareCount }, (_, index) => {
    const entry = worksheet.counts.find(
      (count) => count.techNumber === techNumber
        && normalizeSideNumber(count.sideNumber) === sideNumber
        && count.cellType === cellType
        && count.squareNumber === index + 1,
    );
    return entry?.countValue != null ? String(entry.countValue) : '';
  });
}

function buildSideCountRows(worksheet: BodyFluidWorksheet, techNumber: 1 | 2, sideNumber: 1 | 2): string[][] {
  const wbcSquares = getSquareValues(worksheet, techNumber, 'wbc', sideNumber);
  const rbcSquares = getSquareValues(worksheet, techNumber, 'rbc', sideNumber);
  return [
    ['WBC', ...wbcSquares, ''],
    ['RBC', ...rbcSquares, ''],
  ];
}

function formatTechFinal(value?: number): string {
  return value != null ? formatCellsPerMm3(value).replace(' Cells/mm³', '') : '';
}

async function createFormPage(worksheet: BodyFluidWorksheet): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = await drawHeader(doc);

  const derived = deriveBodyFluidCounts({
    counts: worksheet.counts,
    secondTechEnabled: worksheet.secondTechEnabled,
    dilutionUsed: worksheet.dilutionUsed,
    dilutionFactor: worksheet.dilutionFactor,
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  const metaRows = [
    [`Patient / Label Reference: ${worksheet.patientLabelReference || ''}`, `Time Received: ${formatDateTime(worksheet.timeReceived)}`],
    [`Primary Tech: ${worksheet.primaryTechName}`, `Staff ID: ${worksheet.primaryTechStaffId ?? ''}`],
    [`Specimen Type: ${formatSpecimenType(worksheet)}`, `Tube #: ${worksheet.tubeNumber ?? ''}`],
    [`Clot Status: ${worksheet.clotStatus ? CLOT_STATUS_LABELS[worksheet.clotStatus] : ''}`, `Color & Appearance: ${worksheet.colorAppearance ?? ''}`],
    [`Counting Chamber Background: ${worksheet.chamberBackground ?? ''}`, ''],
  ];

  for (const [left, right] of metaRows) {
    doc.text(left, PRINT_PAGE_MARGIN_MM, y);
    if (right) doc.text(right, pageWidth / 2, y);
    y += 4.5;
  }

  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Tech #1 — Side 1', PRINT_PAGE_MARGIN_MM, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['', 'Sq 1', 'Sq 2', 'Sq 3', 'Sq 4', 'Sq 5', 'Side Result']],
    body: buildSideCountRows(worksheet, 1, 1),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    margin: { left: PRINT_PAGE_MARGIN_MM, right: PRINT_PAGE_MARGIN_MM },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

  if (side2IsActive(worksheet.counts, 1)) {
    doc.setFont('helvetica', 'bold');
    doc.text('Tech #1 — Side 2 (Optional)', PRINT_PAGE_MARGIN_MM, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['', 'Sq 1', 'Sq 2', 'Sq 3', 'Sq 4', 'Sq 5', 'Side Result']],
      body: buildSideCountRows(worksheet, 1, 2),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      margin: { left: PRINT_PAGE_MARGIN_MM, right: PRINT_PAGE_MARGIN_MM },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }

  doc.setFont('helvetica', 'normal');
  doc.text(
    `Tech #1 Final — WBC: ${formatTechFinal(derived.tech1FinalWbc)}  RBC: ${formatTechFinal(derived.tech1FinalRbc)} Cells/mm³`,
    PRINT_PAGE_MARGIN_MM,
    y,
  );
  y += 6;

  if (worksheet.secondTechEnabled) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Tech #2 — ${worksheet.secondTechName ?? ''}`, PRINT_PAGE_MARGIN_MM, y);
    if (worksheet.secondTechStaffId) {
      doc.setFont('helvetica', 'normal');
      doc.text(`Staff ID: ${worksheet.secondTechStaffId}`, pageWidth / 2, y);
    }
    y += 4;

    doc.setFont('helvetica', 'bold');
    doc.text('Side 1', PRINT_PAGE_MARGIN_MM, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['', 'Sq 1', 'Sq 2', 'Sq 3', 'Sq 4', 'Sq 5', 'Side Result']],
      body: buildSideCountRows(worksheet, 2, 1),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      margin: { left: PRINT_PAGE_MARGIN_MM, right: PRINT_PAGE_MARGIN_MM },
    });

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

    if (side2IsActive(worksheet.counts, 2)) {
      doc.setFont('helvetica', 'bold');
      doc.text('Side 2 (Optional)', PRINT_PAGE_MARGIN_MM, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [['', 'Sq 1', 'Sq 2', 'Sq 3', 'Sq 4', 'Sq 5', 'Side Result']],
        body: buildSideCountRows(worksheet, 2, 2),
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        margin: { left: PRINT_PAGE_MARGIN_MM, right: PRINT_PAGE_MARGIN_MM },
      });
      y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
    }

    doc.setFont('helvetica', 'normal');
    doc.text(
      `Tech #2 Final — WBC: ${formatTechFinal(derived.tech2FinalWbc)}  RBC: ${formatTechFinal(derived.tech2FinalRbc)} Cells/mm³`,
      PRINT_PAGE_MARGIN_MM,
      y,
    );
    y += 5;

    doc.text(`WBC Agreement: ${agreementDisplay(worksheet.wbcAgreement)}`, PRINT_PAGE_MARGIN_MM, y);
    y += 4;
    doc.text(`RBC Agreement: ${agreementDisplay(worksheet.rbcAgreement)}`, PRINT_PAGE_MARGIN_MM, y);
    y += 4;
    doc.setFontSize(7.5);
    doc.text(AGREEMENT_NOTE, PRINT_PAGE_MARGIN_MM, y);
    y += 5;
  }

  const hasDifferential = [
    worksheet.differentialNeutrophils,
    worksheet.differentialLymphocytes,
    worksheet.differentialMonocytes,
    worksheet.differentialOtherQuantity,
  ].some((value) => value != null);

  if (hasDifferential) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Differential', PRINT_PAGE_MARGIN_MM, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Neutrophils: ${worksheet.differentialNeutrophils ?? ''}  Lymphocytes: ${worksheet.differentialLymphocytes ?? ''}  Monocytes: ${worksheet.differentialMonocytes ?? ''}`,
      PRINT_PAGE_MARGIN_MM,
      y,
    );
    y += 4;
    if (worksheet.differentialOtherType || worksheet.differentialOtherQuantity != null) {
      doc.text(
        `Other Cells — Type: ${worksheet.differentialOtherType ?? ''}, Quantity: ${worksheet.differentialOtherQuantity ?? ''}`,
        PRINT_PAGE_MARGIN_MM,
        y,
      );
      y += 5;
    } else {
      y += 2;
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Dilution', PRINT_PAGE_MARGIN_MM, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  const dilutionFactor = resolveDilutionFactor(worksheet.dilutionUsed, worksheet.dilutionFactor);
  doc.text(`Dilution Used: ${worksheet.dilutionUsed ? 'Yes' : 'No'}`, PRINT_PAGE_MARGIN_MM, y);
  if (worksheet.dilutionUsed) {
    doc.text(`Background Check OK: ${worksheet.dilutionBackgroundOk ? 'Yes' : 'No'}`, pageWidth / 2, y);
    y += 4;
    doc.text(`Dilution Factor: ${worksheet.dilutionFactor ?? ''}`, PRINT_PAGE_MARGIN_MM, y);
  }
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Final Cell Count Results', PRINT_PAGE_MARGIN_MM, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.text(`WBC Formula: (Average × ${dilutionFactor}) / ${WBC_FORMULA_DIVISOR}`, PRINT_PAGE_MARGIN_MM, y);
  y += 4;
  doc.text(`Final WBC: ${formatCellsPerMm3(worksheet.finalWbc)}`, PRINT_PAGE_MARGIN_MM, y);
  y += 5;
  doc.text(`RBC Formula: (Average × ${dilutionFactor}) / ${RBC_FORMULA_DIVISOR}`, PRINT_PAGE_MARGIN_MM, y);
  y += 4;
  doc.text(`Final RBC: ${formatCellsPerMm3(worksheet.finalRbc)}`, PRINT_PAGE_MARGIN_MM, y);
  y += 6;

  if (worksheet.comments?.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.text('Comments', PRINT_PAGE_MARGIN_MM, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    const commentLines = doc.splitTextToSize(worksheet.comments, pageWidth - PRINT_PAGE_MARGIN_MM * 2);
    doc.text(commentLines, PRINT_PAGE_MARGIN_MM, y);
    y += commentLines.length * 4 + 2;
  }

  if (worksheet.pathologistName || worksheet.pathologistReviewedAt || worksheet.pathologistComment) {
    doc.setFont('helvetica', 'bold');
    doc.text('Pathologist Signature / Review (If Applicable)', PRINT_PAGE_MARGIN_MM, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.text(`Reviewed By: ${worksheet.pathologistName ?? ''}`, PRINT_PAGE_MARGIN_MM, y);
    doc.text(`Staff ID: ${worksheet.pathologistStaffId ?? ''}`, pageWidth / 2, y);
    y += 4;
    doc.text(`Review Date/Time: ${formatDateTime(worksheet.pathologistReviewedAt)}`, PRINT_PAGE_MARGIN_MM, y);
    y += 4;
    if (worksheet.pathologistComment) {
      const reviewLines = doc.splitTextToSize(worksheet.pathologistComment, pageWidth - PRINT_PAGE_MARGIN_MM * 2);
      doc.text(reviewLines, PRINT_PAGE_MARGIN_MM, y);
    }
  }

  drawFooter(doc);
  return doc;
}

export async function createBodyFluidForm010Pdf(worksheet: BodyFluidWorksheet): Promise<Uint8Array> {
  const doc = await createFormPage(worksheet);
  return doc.output('arraybuffer') as unknown as Uint8Array;
}

export async function downloadBodyFluidForm010Pdf(worksheet: BodyFluidWorksheet): Promise<void> {
  const bytes = await createBodyFluidForm010Pdf(worksheet);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const label = worksheet.patientLabelReference?.trim() || worksheet.id.slice(0, 8);
  anchor.href = url;
  anchor.download = `Body-Fluid-Worksheet-${label}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}
