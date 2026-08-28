import autoTable from 'jspdf-autotable';
import type { jsPDF } from 'jspdf';
import {
  buildControlledFormTableRows,
  buildMaintenance008ATableRows,
  formatMaintenanceProblemsSection,
  formatMonthlyApprovalSection,
  formatMonthlyReviewSection,
  type MaintenanceControlledFormGroup,
  type QCControlledFormGroup,
} from '@/lib/print/qc-controlled-form-data';
import {
  getQCPrintTemplateConfig,
  QC_PRINT_DEPARTMENT,
  QC_PRINT_HOSPITAL,
  QC_PRINT_SECTION,
} from '@/lib/print/qc-print-templates';
import { getLandscapeTableWidth, PRINT_PAGE_MARGIN_MM } from '@/lib/print/landscape-layout';
import { printValue } from '@/lib/print/report-value';
import { loadOfficialLogoForPdf } from '@/lib/portal/official-logo';

const PDF_FOOTER_BLOCK_MM = 14;

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

function drawControlledFooter(
  doc: jsPDF,
  footerLeft: string,
  qid: string,
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 8;

  doc.setLineWidth(0.2);
  doc.line(PRINT_PAGE_MARGIN_MM, footerY - 4, pageWidth - PRINT_PAGE_MARGIN_MM, footerY - 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(footerLeft, PRINT_PAGE_MARGIN_MM, footerY);
  doc.text(qid, pageWidth - PRINT_PAGE_MARGIN_MM, footerY, { align: 'right' });
}

function drawControlledHeader(
  doc: jsPDF,
  logo: Awaited<ReturnType<typeof loadLogoForPdf>>,
  title: string,
  subtitle: string | undefined,
  metaLines: string[],
): number {
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

  let y = logo ? 24 : 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(QC_PRINT_HOSPITAL, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.setFontSize(9.5);
  doc.text(QC_PRINT_DEPARTMENT, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text(QC_PRINT_SECTION, pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(title, pageWidth / 2, y, { align: 'center' });
  y += 4;

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(subtitle, pageWidth / 2, y, { align: 'center' });
    y += 4;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  for (const line of metaLines) {
    doc.text(line, pageWidth / 2, y, { align: 'center' });
    y += 3.5;
  }

  doc.setLineWidth(0.2);
  doc.line(PRINT_PAGE_MARGIN_MM, y + 1, pageWidth - PRINT_PAGE_MARGIN_MM, y + 1);
  return y + 5;
}

function drawMonthlyWorkflowSections(
  doc: jsPDF,
  startY: number,
  monthlyRecord?: QCControlledFormGroup['monthlyRecord'],
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const tableWidth = (pageWidth - PRINT_PAGE_MARGIN_MM * 2 - 4) / 2;
  let y = startY + 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('MONTHLY REVIEW — QUALITY OFFICER', PRINT_PAGE_MARGIN_MM, y);
  doc.text('MONTHLY SUPERVISOR APPROVAL', PRINT_PAGE_MARGIN_MM + tableWidth + 4, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    margin: { left: PRINT_PAGE_MARGIN_MM, right: pageWidth / 2 + 2, bottom: PDF_FOOTER_BLOCK_MM },
    tableWidth,
    body: formatMonthlyReviewSection(monthlyRecord),
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.2 },
    columnStyles: { 0: { cellWidth: 28, fontStyle: 'bold' } },
    didDrawPage: () => {},
  });

  const leftFinalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  autoTable(doc, {
    startY: y,
    margin: { left: pageWidth / 2 + 2, right: PRINT_PAGE_MARGIN_MM, bottom: PDF_FOOTER_BLOCK_MM },
    tableWidth,
    body: formatMonthlyApprovalSection(monthlyRecord),
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.2 },
    columnStyles: { 0: { cellWidth: 28, fontStyle: 'bold' } },
    didDrawPage: () => {},
  });

  const rightFinalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  return Math.max(leftFinalY, rightFinalY);
}

function buildQcMetaLines(group: QCControlledFormGroup, templateMeta?: readonly string[]): string[] {
  const lines = [`Year: ${group.year}`, `Month: ${group.monthLabel}`];
  if (templateMeta?.includes('Expiration Date')) lines.push('Expiration Date: —');
  if (templateMeta?.includes('LOT QC 1#')) lines.push('LOT QC 1#: —', 'LOT QC 2#: —');
  if (templateMeta?.includes('Instrument')) {
    lines.unshift(`Instrument: ${group.instrumentName}`);
    lines.push(`Serial #: ${printValue(group.instrument?.serialNumber)}`);
  }
  if (group.templateKey === 'hema-007') {
    lines.push('Normal Range: 6.8–7.2');
  }
  return lines;
}

function buildMaintenanceMetaLines(group: MaintenanceControlledFormGroup): string[] {
  return [
    `Instrument: ${group.instrumentName}`,
    `Serial #: ${printValue(group.instrument?.serialNumber)}`,
    `Brand #: ${printValue(group.instrument?.model || group.instrument?.manufacturer)}`,
    `Month: ${group.monthLabel}`,
    `Year: ${group.year}`,
  ];
}

export async function renderQCControlledFormPdf(
  doc: jsPDF,
  group: QCControlledFormGroup,
  logo: Awaited<ReturnType<typeof loadLogoForPdf>>,
): Promise<void> {
  const template = getQCPrintTemplateConfig(group.templateKey);
  const metaLines = [
    ...(template.referenceRanges ?? []),
    ...buildQcMetaLines(group, template.headerMeta),
  ];
  const startY = drawControlledHeader(doc, logo, template.title, template.subtitle, metaLines);
  const rows = buildControlledFormTableRows(group);

  autoTable(doc, {
    head: [template.tableHeaders as unknown as string[]],
    body: rows,
    startY,
    margin: { left: PRINT_PAGE_MARGIN_MM, right: PRINT_PAGE_MARGIN_MM, bottom: PDF_FOOTER_BLOCK_MM },
    tableWidth: getLandscapeTableWidth(doc.internal.pageSize.getWidth()),
    styles: { fontSize: 6.5, cellPadding: 1.2, overflow: 'linebreak' },
    headStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold' },
    didDrawPage: () => {
      drawControlledFooter(doc, template.footerLeft, template.qid);
    },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY;
  drawMonthlyWorkflowSections(doc, finalY, group.monthlyRecord);
  drawControlledFooter(doc, template.footerLeft, template.qid);
}

export async function renderMaintenance008APdf(
  doc: jsPDF,
  group: MaintenanceControlledFormGroup,
  logo: Awaited<ReturnType<typeof loadLogoForPdf>>,
): Promise<void> {
  const template = getQCPrintTemplateConfig('hema-008a');
  const startY = drawControlledHeader(doc, logo, template.title, template.subtitle, buildMaintenanceMetaLines(group));
  const rows = buildMaintenance008ATableRows(group);

  autoTable(doc, {
    head: [template.tableHeaders as unknown as string[]],
    body: rows,
    startY,
    margin: { left: PRINT_PAGE_MARGIN_MM, right: PRINT_PAGE_MARGIN_MM, bottom: PDF_FOOTER_BLOCK_MM },
    tableWidth: getLandscapeTableWidth(doc.internal.pageSize.getWidth()),
    styles: { fontSize: 6, cellPadding: 1, overflow: 'linebreak' },
    headStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold' },
    didDrawPage: () => {
      drawControlledFooter(doc, template.footerLeft, template.qid);
    },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Problems / Corrective Actions', PRINT_PAGE_MARGIN_MM, finalY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const problems = formatMaintenanceProblemsSection(group.records);
  doc.text(doc.splitTextToSize(problems, getLandscapeTableWidth(doc.internal.pageSize.getWidth())), PRINT_PAGE_MARGIN_MM, finalY + 10);
  const problemsFinalY = finalY + 10 + (problems === '—' ? 4 : 12);
  drawMonthlyWorkflowSections(doc, problemsFinalY, undefined);
  drawControlledFooter(doc, template.footerLeft, template.qid);
}

export async function loadControlledFormLogo() {
  return loadLogoForPdf();
}
