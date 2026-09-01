import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';
import {
  COMPARISON_OVERALL_RESULT_LABELS,
  COMPARISON_RESULT_STATUS_LABELS,
  FORM_HEMA_013_CODE,
} from '@/lib/comparison-studies/constants';
import {
  buildStudySummary,
  effectiveResultStatus,
  roundForDisplay,
} from '@/lib/comparison-studies/calculation';
import { PRINT_PAGE_MARGIN_MM } from '@/lib/print/landscape-layout';
import {
  QC_PRINT_DEPARTMENT,
  QC_PRINT_HOSPITAL,
  QC_PRINT_SECTION,
} from '@/lib/print/qc-print-templates';
import { loadOfficialLogoForPdf } from '@/lib/portal/official-logo';
import type { ComparisonSectionCode, ComparisonStudy } from '@/types/comparison-study';

const SECTION_LABELS: Record<ComparisonSectionCode, string> = {
  CBC: 'CBC',
  COAGULATION: 'Coagulation',
  ESR: 'ESR',
};

async function loadLogoForPdf() {
  const { dataUrl, dimensions } = await loadOfficialLogoForPdf();
  if (!dataUrl || !dimensions) return null;
  return { dataUrl, ...dimensions };
}

function formatDateTime(value?: string): string {
  if (!value) return '';
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function drawPageNumbers(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - PRINT_PAGE_MARGIN_MM, pageHeight - 6, { align: 'right' });
  }
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
  doc.text('COMPARISON FORM', pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Form: ${FORM_HEMA_013_CODE}`, pageWidth / 2, y, { align: 'center' });
  return y + 8;
}

function drawMetaBlock(doc: jsPDF, study: ComparisonStudy, startY: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const colWidth = (pageWidth - PRINT_PAGE_MARGIN_MM * 2) / 2;
  const y = startY;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const left = [
    `Study Number: ${study.studyNumber}`,
    `Study Date: ${study.studyDate ?? '—'}`,
    `Comparison Type: ${study.comparisonType ?? '—'}`,
  ];
  const right = [
    `Reference: ${study.referenceLabel ?? '—'}`,
    `Comparison: ${study.comparisonLabel ?? '—'}`,
    `Overall Result: ${study.overallResult ? COMPARISON_OVERALL_RESULT_LABELS[study.overallResult] ?? study.overallResult : '—'}`,
  ];
  left.forEach((line, index) => {
    doc.text(line, PRINT_PAGE_MARGIN_MM, y + index * 5);
    doc.text(right[index] ?? '', PRINT_PAGE_MARGIN_MM + colWidth, y + index * 5);
  });
  return y + 18;
}

function sectionTable(doc: jsPDF, study: ComparisonStudy, section: ComparisonSectionCode, startY: number): number {
  const samples = study.samples.filter((s) => s.section === section);
  const sampleIds = samples.map((s) => s.id);
  const results = study.results.filter((r) => sampleIds.includes(r.sampleId));
  if (results.length === 0) return startY;

  const tests = [...new Set(results.map((r) => r.testCode))];
  const body: string[][] = [];

  for (const testCode of tests) {
    const testResults = results.filter((r) => r.testCode === testCode);
    for (const result of testResults) {
      const sample = samples.find((s) => s.id === result.sampleId);
      const status = effectiveResultStatus(result);
      body.push([
        sample?.sampleId ?? '',
        result.testName,
        result.previousResult != null ? String(result.previousResult) : '',
        result.newResult != null ? String(result.newResult) : '',
        result.differenceUnits != null ? String(roundForDisplay(result.differenceUnits, 3)) : '',
        result.differencePercent != null ? `${roundForDisplay(result.differencePercent, 2)}%` : 'N/A',
        result.taeLimitSnapshot != null ? `${result.taeLimitSnapshot}%` : '',
        COMPARISON_RESULT_STATUS_LABELS[status] ?? status,
      ]);
    }
  }

  autoTable(doc, {
    startY,
    head: [['Sample', 'Test', 'Previous', 'New', 'Diff Units', 'Diff %', 'TAE', 'Status']],
    body,
    margin: { left: PRINT_PAGE_MARGIN_MM, right: PRINT_PAGE_MARGIN_MM },
    styles: { fontSize: 7.5, cellPadding: 1.5 },
    headStyles: { fillColor: [91, 63, 214] },
    theme: 'grid',
    didDrawPage: (data) => {
      if (data.pageNumber === 1 && data.cursor) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(SECTION_LABELS[section], PRINT_PAGE_MARGIN_MM, startY - 2);
      }
    },
  });

  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
}

export async function createComparisonForm013Pdf(study: ComparisonStudy): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let y = await drawHeader(doc);
  y = drawMetaBlock(doc, study, y);

  const summary = buildStudySummary(study.results, study.samples.length);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Study Summary', PRINT_PAGE_MARGIN_MM, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Samples: ${summary.totalSamples} | Tests: ${summary.totalTests} | Acceptable: ${summary.acceptable} | Not Acceptable: ${summary.notAcceptable} | Manual Review: ${summary.manualReview} | Incomplete: ${summary.incomplete}`,
    PRINT_PAGE_MARGIN_MM,
    y,
  );
  y += 8;

  for (const section of study.sections.map((s) => s.section)) {
    if (y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      y = PRINT_PAGE_MARGIN_MM + 10;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(SECTION_LABELS[section], PRINT_PAGE_MARGIN_MM, y);
    y += 4;
    y = sectionTable(doc, study, section, y);
  }

  if (study.generalComments?.trim()) {
    if (y > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      y = PRINT_PAGE_MARGIN_MM + 10;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('General Comments', PRINT_PAGE_MARGIN_MM, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(study.generalComments, doc.internal.pageSize.getWidth() - PRINT_PAGE_MARGIN_MM * 2);
    doc.text(lines, PRINT_PAGE_MARGIN_MM, y);
    y += lines.length * 4 + 4;
  }

  if (y > doc.internal.pageSize.getHeight() - 35) {
    doc.addPage();
    y = PRINT_PAGE_MARGIN_MM + 10;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Signatures', PRINT_PAGE_MARGIN_MM, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const sigLines = [
    `Prepared By: ${study.preparedByName ?? '—'} (${study.preparedByStaffId ?? '—'}) — ${formatDateTime(study.preparedAt)}`,
    `Reviewed By: ${study.reviewedByName ?? '—'} (${study.reviewedByStaffId ?? '—'}) — ${formatDateTime(study.reviewedAt)}`,
    `Approved By: ${study.approvedByName ?? '—'} (${study.approvedByStaffId ?? '—'}) — ${formatDateTime(study.approvedAt)}`,
  ];
  sigLines.forEach((line, index) => doc.text(line, PRINT_PAGE_MARGIN_MM, y + index * 5));

  drawPageNumbers(doc);
  return doc.output('blob');
}
