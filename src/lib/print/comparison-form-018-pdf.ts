import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';
import { summarizeMixingStudy } from '@/lib/clinical/comparison-mixing';
import {
  COMPARISON_OVERALL_RESULT_LABELS,
  COMPARISON_RESULT_STATUS_LABELS,
} from '@/lib/comparison-studies/constants';
import {
  FORM_HEMA_018_CODE,
  FORM_HEMA_018_QID,
  FORM_HEMA_018_TITLE,
  MIXING_MODE_LABELS,
  MIXING_MODE_STATUS_LABELS,
  MIXING_TIMING_INVALID_LABEL,
} from '@/lib/comparison-studies/mixing-constants';
import { formatElapsedDuration, roundForDisplay } from '@/lib/comparison-studies/mixing-calculation';
import { PRINT_PAGE_MARGIN_MM } from '@/lib/print/landscape-layout';
import {
  QC_PRINT_DEPARTMENT,
  QC_PRINT_HOSPITAL,
  QC_PRINT_SECTION,
} from '@/lib/print/qc-print-templates';
import { loadOfficialLogoForPdf } from '@/lib/portal/official-logo';
import type { ComparisonMixingSample, ComparisonStudy, MixingMode } from '@/types/comparison-study';

async function drawHeader(doc: jsPDF): Promise<number> {
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
  doc.text(FORM_HEMA_018_TITLE.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Form: ${FORM_HEMA_018_CODE} · QID: ${FORM_HEMA_018_QID}`, pageWidth / 2, y, { align: 'center' });
  return y + 8;
}

function statusLabel(status: string): string {
  if (status === 'manual_review') return 'TIMING REVIEW';
  return COMPARISON_RESULT_STATUS_LABELS[status] ?? status.toUpperCase();
}

function modeTable(
  doc: jsPDF,
  study: ComparisonStudy,
  mode: MixingMode,
  startY: number,
): number {
  const summary = summarizeMixingStudy(study);
  const modeStatus = mode === 'close' ? summary.closeModeStatus : summary.openModeStatus;
  const samples = (study.mixingSamples ?? [])
    .filter((s) => s.mode === mode)
    .sort((a, b) => a.sampleNumber - b.sampleNumber);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`${MIXING_MODE_LABELS[mode]} — ${MIXING_MODE_STATUS_LABELS[modeStatus]}`, PRINT_PAGE_MARGIN_MM, startY);

  const body: string[][] = [];
  for (const sample of samples) {
    const results = (study.mixingResults ?? [])
      .filter((r) => r.mixingSampleId === sample.id)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const timing = formatSampleTiming(sample);

    for (const result of results) {
      body.push([
        result.testCode,
        String(sample.sampleNumber),
        `${result.taePercentSnapshot}%`,
        result.firstResult != null ? String(result.firstResult) : '',
        result.taeValue != null ? String(roundForDisplay(result.taeValue, 4)) : '',
        result.lowerLimit != null ? String(roundForDisplay(result.lowerLimit, 4)) : '',
        result.upperLimit != null ? String(roundForDisplay(result.upperLimit, 4)) : '',
        result.finalResult != null ? String(result.finalResult) : '',
        statusLabel(result.resultStatus),
        timing,
      ]);
    }
  }

  autoTable(doc, {
    startY: startY + 4,
    head: [[
      'Parameter', 'Sample #', 'TAE %', 'First', 'TAE Value', 'Lower', 'Upper', 'Final', 'Interpretation', 'Timing',
    ]],
    body,
    margin: { left: PRINT_PAGE_MARGIN_MM, right: PRINT_PAGE_MARGIN_MM },
    styles: { fontSize: 7, cellPadding: 1.2 },
    headStyles: { fillColor: [91, 63, 214] },
    theme: 'grid',
  });

  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
}

function formatSampleTiming(sample: ComparisonMixingSample): string {
  const elapsed = formatElapsedDuration(sample.elapsedMinutes);
  if (sample.timingValid === false) {
    return `${elapsed} · ${MIXING_TIMING_INVALID_LABEL}`;
  }
  if (sample.initialTestTime && sample.finalTestTime) {
    return `${elapsed} (2–4h window)`;
  }
  return elapsed;
}

export async function createComparisonForm018Pdf(study: ComparisonStudy): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let y = await drawHeader(doc);
  const summary = summarizeMixingStudy(study);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Study Number: ${study.studyNumber}`, PRINT_PAGE_MARGIN_MM, y);
  doc.text(`Study Date: ${study.studyDate ?? '—'}`, PRINT_PAGE_MARGIN_MM + 70, y);
  doc.text(`Instrument: ${study.referenceLabel ?? 'Alinity HQ 1147'}`, PRINT_PAGE_MARGIN_MM + 130, y);
  y += 5;
  doc.text(
    `Overall: ${study.overallResult ? COMPARISON_OVERALL_RESULT_LABELS[study.overallResult] ?? study.overallResult : '—'}`,
    PRINT_PAGE_MARGIN_MM,
    y,
  );
  y += 8;

  y = modeTable(doc, study, 'close', y);
  if (y > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    y = 20;
  }
  y = modeTable(doc, study, 'open', y);

  if (study.generalComments?.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.text('Conclusion', PRINT_PAGE_MARGIN_MM, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(study.generalComments, doc.internal.pageSize.getWidth() - PRINT_PAGE_MARGIN_MM * 2);
    doc.text(lines, PRINT_PAGE_MARGIN_MM, y + 5);
    y += lines.length * 4 + 10;
  }

  doc.setFontSize(8);
  doc.text(`Prepared By: ${study.preparedByName ?? '—'} (${study.preparedByStaffId ?? '—'})`, PRINT_PAGE_MARGIN_MM, y);
  y += 4;
  doc.text(`Reviewed By: ${study.reviewedByName ?? '—'} (${study.reviewedByStaffId ?? '—'})`, PRINT_PAGE_MARGIN_MM, y);
  y += 4;
  doc.text(`Approved By: ${study.approvedByName ?? '—'} (${study.approvedByStaffId ?? '—'})`, PRINT_PAGE_MARGIN_MM, y);

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(7.5);
  doc.text(`${FORM_HEMA_018_TITLE} · ${FORM_HEMA_018_CODE}`, PRINT_PAGE_MARGIN_MM, pageHeight - 8);
  doc.text(FORM_HEMA_018_QID, doc.internal.pageSize.getWidth() - PRINT_PAGE_MARGIN_MM, pageHeight - 8, { align: 'right' });

  return doc.output('blob');
}
