import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';
import { monthName } from '@/lib/cv-monitoring/constants';
import { cellStatusSymbol, daysInMonth } from '@/lib/stain-qc/calendar';
import { formatChangeStainPdfLine, formatQcCorrectionCellDisplay } from '@/lib/stain-qc/change-stain';
import {
  FORM_HEMA_021_FOOTER,
  STAIN_QC_RESPONSIBILITY_LABELS,
  stainQcPdfLegendBlock,
} from '@/lib/stain-qc/constants';
import { PRINT_PAGE_MARGIN_MM } from '@/lib/print/landscape-layout';
import {
  QC_PRINT_DEPARTMENT,
  QC_PRINT_HOSPITAL,
  QC_PRINT_SECTION,
} from '@/lib/print/qc-print-templates';
import { loadOfficialLogoForPdf } from '@/lib/portal/official-logo';
import type { StainQcMonthlySheetDetail, StainQcResponsibilityType } from '@/types/stain-qc';

const RESPONSIBILITY_TYPES: StainQcResponsibilityType[] = [
  'slide_prepared',
  'slide_checked',
  'qc_correction_change_stain',
];

async function drawHeader(doc: jsPDF, sheet: StainQcMonthlySheetDetail): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 10;
  const logo = await loadOfficialLogoForPdf();
  if (logo.dataUrl && logo.dimensions) {
    doc.addImage(logo.dataUrl, logo.dimensions.format, pageWidth / 2 - logo.dimensions.width / 2, 6, logo.dimensions.width, logo.dimensions.height);
    y = 24;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(QC_PRINT_HOSPITAL, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text(QC_PRINT_DEPARTMENT, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text(QC_PRINT_SECTION, pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(sheet.formCode, pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.text(sheet.formTitle.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `${monthName(sheet.sheetMonth)} ${sheet.sheetYear} · ${sheet.stainName} · Lot ${sheet.lotNumber} · Exp ${sheet.expiryDate}`,
    pageWidth / 2,
    y,
    { align: 'center' },
  );
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Coding / Legend', pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.text(stainQcPdfLegendBlock(), pageWidth / 2, y, { align: 'center' });
  return y + 8;
}

export function getStainQcPdfLegendBlock(): string {
  return stainQcPdfLegendBlock();
}

export async function renderStainQcFormPdf(sheet: StainQcMonthlySheetDetail): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const totalDays = daysInMonth(sheet.sheetMonth, sheet.sheetYear);
  let startY = await drawHeader(doc, sheet);

  const resultMap = new Map<string, string>();
  for (const result of sheet.dailyResults) {
    resultMap.set(`${result.criterionKey}:${result.dayOfMonth}`, `${cellStatusSymbol(result.resultStatus)} ${result.recordedByInitials}`);
  }

  const dayHeaders = Array.from({ length: 31 }, (_, index) => String(index + 1));
  const body = sheet.criteria.map((criterion) => {
    const label = [criterion.rowLabel, criterion.componentLabel, criterion.idealColor].filter(Boolean).join(' · ');
    const cells = Array.from({ length: 31 }, (_, index) => {
      const day = index + 1;
      if (day > totalDays) return '';
      return resultMap.get(`${criterion.criterionKey}:${day}`) ?? '';
    });
    return [label, ...cells];
  });

  for (const responsibilityType of RESPONSIBILITY_TYPES) {
    const entriesByDay = Object.fromEntries(
      sheet.responsibilityEntries
        .filter((entry) => entry.responsibilityType === responsibilityType)
        .map((entry) => [entry.dayOfMonth, entry]),
    );
    body.push([
      STAIN_QC_RESPONSIBILITY_LABELS[responsibilityType],
      ...Array.from({ length: 31 }, (_, index) => {
        const day = index + 1;
        if (day > totalDays) return '';
        const entry = entriesByDay[day];
        if (responsibilityType === 'qc_correction_change_stain') {
          return entry ? formatQcCorrectionCellDisplay(entry) : '';
        }
        return entry?.recordedByInitials ?? '';
      }),
    ]);
  }

  autoTable(doc, {
    startY,
    head: [['Criterion / Responsibility', ...dayHeaders]],
    body,
    styles: { fontSize: 6, cellPadding: 1, overflow: 'linebreak' },
    headStyles: { fillColor: [230, 230, 230], textColor: 20, fontStyle: 'bold' },
    margin: { left: PRINT_PAGE_MARGIN_MM, right: PRINT_PAGE_MARGIN_MM },
  });

  const finalY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY) + 8;
  doc.setFontSize(9);
  doc.text(`Reviewed By: ${sheet.reviewedByName ?? '—'}${sheet.reviewedAt ? ` · ${new Date(sheet.reviewedAt).toLocaleString()}` : ''}`, PRINT_PAGE_MARGIN_MM, finalY);
  doc.text(`Approved By: ${sheet.approvedByName ?? '—'}${sheet.approvedAt ? ` · ${new Date(sheet.approvedAt).toLocaleString()}` : ''}`, PRINT_PAGE_MARGIN_MM, finalY + 5);

  if (sheet.correctiveActions.length > 0) {
    doc.text('Corrective Actions:', PRINT_PAGE_MARGIN_MM, finalY + 12);
    sheet.correctiveActions.forEach((action, index) => {
      doc.text(
        formatChangeStainPdfLine(action),
        PRINT_PAGE_MARGIN_MM,
        finalY + 17 + index * 4,
      );
    });
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.text(FORM_HEMA_021_FOOTER, pageWidth / 2, pageHeight - 6, { align: 'center' });

  return doc.output('blob');
}
