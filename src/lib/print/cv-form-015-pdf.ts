import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';
import {
  CV_RESULT_STATUS_LABELS,
  FORM_HEMA_015_FOOTER,
  FORM_HEMA_015_QID,
  analytePrintCode,
  monthAbbreviation,
  monthName,
} from '@/lib/cv-monitoring/constants';
import { roundForDisplay } from '@/lib/cv-monitoring/calculation';
import { PRINT_PAGE_MARGIN_MM } from '@/lib/print/landscape-layout';
import {
  QC_PRINT_DEPARTMENT,
  QC_PRINT_HOSPITAL,
  QC_PRINT_SECTION,
} from '@/lib/print/qc-print-templates';
import { loadOfficialLogoForPdf } from '@/lib/portal/official-logo';
import type { CvMonitoringRecord } from '@/types/cv-monitoring';

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
  doc.text('MONTHLY CV COMPARISON', pageWidth / 2, y, { align: 'center' });
  return y + 8;
}

function statusLabel(status: string): string {
  return CV_RESULT_STATUS_LABELS[status] ?? status.toUpperCase();
}

function levelTable(doc: jsPDF, record: CvMonitoringRecord, qcLevel: 'N' | 'P', startY: number): number {
  const level = record.levels.find((l) => l.qcLevel === qcLevel);
  const results = record.results.filter((r) => r.levelId === level?.id).sort((a, b) => a.displayOrder - b.displayOrder);
  if (!level || results.length === 0) return startY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`LEVEL ${qcLevel}${level.lotNumber ? ` · LOT ${level.lotNumber}` : ''}`, PRINT_PAGE_MARGIN_MM, startY);
  const prevLabel = `Previous Month (${monthAbbreviation(record.previousMonth)})`;
  const currLabel = `Current Month (${monthAbbreviation(record.currentMonth)})`;

  autoTable(doc, {
    startY: startY + 4,
    head: [[
      'Analyte', 'CV Limit',
      `${prevLabel} Mean`, `${prevLabel} SD`, `${prevLabel} CV`, 'Prev Status',
      `${currLabel} Mean`, `${currLabel} SD`, `${currLabel} CV`, 'Curr Status', 'Comment',
    ]],
    body: results.map((r) => [
      analytePrintCode(r.analyteCode),
      r.cvLimitSnapshot != null ? `${r.cvLimitSnapshot}%` : '',
      r.previousMean ?? '',
      r.previousSd ?? '',
      r.previousCvPercent != null ? `${roundForDisplay(r.previousCvPercent, 2)}%` : 'N/A',
      statusLabel(r.previousStatus),
      r.currentMean ?? '',
      r.currentSd ?? '',
      r.currentCvPercent != null ? `${roundForDisplay(r.currentCvPercent, 2)}%` : 'N/A',
      statusLabel(r.currentStatus),
      r.comment ?? '',
    ]),
    margin: { left: PRINT_PAGE_MARGIN_MM, right: PRINT_PAGE_MARGIN_MM },
    styles: { fontSize: 7, cellPadding: 1.2 },
    headStyles: { fillColor: [91, 63, 214] },
    theme: 'grid',
  });

  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
}

export async function createCvForm015Pdf(record: CvMonitoringRecord): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let y = await drawHeader(doc);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Month / Year: ${monthName(record.currentMonth)} ${record.currentYear}`, PRINT_PAGE_MARGIN_MM, y);
  doc.text(`Instrument: ${record.instrumentNameSnapshot}`, PRINT_PAGE_MARGIN_MM + 90, y);
  doc.text(`Monitoring #: ${record.monitoringNumber}`, PRINT_PAGE_MARGIN_MM + 180, y);
  y += 10;

  y = levelTable(doc, record, 'N', y);
  if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 20; }
  y = levelTable(doc, record, 'P', y);

  if (record.generalComments?.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.text('General Comments', PRINT_PAGE_MARGIN_MM, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(record.generalComments, doc.internal.pageSize.getWidth() - PRINT_PAGE_MARGIN_MM * 2);
    doc.text(lines, PRINT_PAGE_MARGIN_MM, y + 5);
    y += lines.length * 4 + 10;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Prepared By: ${record.preparedByName ?? '—'} (${record.preparedByStaffId ?? '—'})`, PRINT_PAGE_MARGIN_MM, y);
  y += 4;
  doc.text(`Reviewed By: ${record.reviewedByName ?? '—'} (${record.reviewedByStaffId ?? '—'})`, PRINT_PAGE_MARGIN_MM, y);
  y += 4;
  doc.text(`Approved By: ${record.approvedByName ?? '—'} (${record.approvedByStaffId ?? '—'})`, PRINT_PAGE_MARGIN_MM, y);

  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(7.5);
  doc.text(FORM_HEMA_015_FOOTER, PRINT_PAGE_MARGIN_MM, pageHeight - 8);
  doc.text(FORM_HEMA_015_QID, pageWidth - PRINT_PAGE_MARGIN_MM, pageHeight - 8, { align: 'right' });

  return doc.output('blob');
}
