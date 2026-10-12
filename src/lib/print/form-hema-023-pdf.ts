import { jsPDF } from 'jspdf';
import {
  FORM_HEMA_023_DEPARTMENT,
  FORM_HEMA_023_DOCUMENT_NUMBER,
  FORM_HEMA_023_FOOTER,
  FORM_HEMA_023_QID,
  FORM_HEMA_023_SECTION,
  FORM_HEMA_023_TITLE,
  ROSNER_FORMULA,
  ROSNER_THRESHOLD_STATEMENT,
  formatMixingStaffLine,
  formHema023PdfFilename,
  testsForSelection,
  type MixingTestSelection,
  type MixingTestType,
} from '@/lib/medical-reports/form-hema-023/constants';
import { formatRosnerIndexDisplay } from '@/lib/medical-reports/form-hema-023/rosner';
import { QC_PRINT_HOSPITAL } from '@/lib/print/qc-print-templates';
import { loadOfficialLogoForPdf } from '@/lib/portal/official-logo';
import type { MixingStudy } from '@/types/mixing-study';

export interface FormHema023PdfSection {
  testType: MixingTestType;
  patientClottingTime: string | null;
  nppClottingTime: string | null;
  targetValue: string | null;
  immediateMixClottingTime: string | null;
  immediateRosnerIndex: string | null;
  immediateInterpretation: string | null;
  incubatedMixClottingTime: string | null;
  incubatedRosnerIndex: string | null;
  incubatedInterpretation: string | null;
  conclusion: string | null;
}

export interface FormHema023PdfModel {
  studyNumber: string;
  studyDate: string;
  testSelection: MixingTestSelection;
  sections: FormHema023PdfSection[];
  performedByName: string;
  performedByStaffId: string | null;
  reviewedByName: string | null;
  reviewedByStaffId: string | null;
}

const MARGIN = 12;

function displayIndex(value: string | null): string {
  if (!value) return '';
  return formatRosnerIndexDisplay(value);
}

function sectionTitle(testType: MixingTestType): string {
  return testType === 'aptt' ? 'TEST: APTT MIXING STUDY' : 'TEST: PT MIXING STUDY';
}

function rowsFor(section: FormHema023PdfSection): Array<[string, string]> {
  const test = section.testType === 'aptt' ? 'APTT' : 'PT';
  return [
    [`${test} of Patient sample`, section.patientClottingTime ?? ''],
    [`${test} of NPP`, section.nppClottingTime ?? ''],
    ['Target value', section.targetValue ?? ''],
    [`${test} of 1:1 mix (Patient + NPP)`, section.immediateMixClottingTime ?? ''],
    ["Rosner's Index before incubation", displayIndex(section.immediateRosnerIndex)],
    ['Interpretation before incubation', section.immediateInterpretation ?? ''],
    [`${test} of 1:1 mix (after incubation)`, section.incubatedMixClottingTime ?? ''],
    ["Rosner's Index after incubation", displayIndex(section.incubatedRosnerIndex)],
    ['Interpretation after incubation', section.incubatedInterpretation ?? ''],
    ['Conclusion', section.conclusion ?? ''],
  ];
}

export async function buildFormHema023Pdf(
  model: FormHema023PdfModel,
  options?: { compress?: boolean },
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
    compress: options?.compress ?? true,
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  let y = 8;

  const logo = await loadOfficialLogoForPdf();
  if (logo.dataUrl && logo.dimensions) {
    doc.addImage(
      logo.dataUrl,
      logo.dimensions.format,
      pageWidth / 2 - logo.dimensions.width / 2,
      y,
      logo.dimensions.width,
      logo.dimensions.height,
    );
    y += logo.dimensions.height + 2;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(QC_PRINT_HOSPITAL, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.setFontSize(8.5);
  doc.text(FORM_HEMA_023_DEPARTMENT, pageWidth / 2, y, { align: 'center' });
  y += 3.6;
  doc.text(FORM_HEMA_023_SECTION.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 3.6;
  doc.text(FORM_HEMA_023_DOCUMENT_NUMBER, pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(FORM_HEMA_023_TITLE, pageWidth / 2, y, { align: 'center' });
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Date: ${model.studyDate}`, MARGIN, y);
  doc.text(`Study: ${model.studyNumber}`, pageWidth - MARGIN, y, { align: 'right' });
  y += 5;

  const selected = new Set(testsForSelection(model.testSelection));
  for (const section of model.sections) {
    if (!selected.has(section.testType)) continue;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(sectionTitle(section.testType), MARGIN, y);
    y += 4.2;
    doc.setFontSize(8);
    for (const [label, value] of rowsFor(section)) {
      doc.setFont('helvetica', 'normal');
      const valueLines = doc.splitTextToSize(value || '—', contentWidth * 0.48);
      const rowHeight = Math.max(4, valueLines.length * 3.4);
      doc.text(label, MARGIN, y);
      doc.text(valueLines, pageWidth - MARGIN, y, { align: 'right' });
      y += rowHeight;
    }
    y += 1.5;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const statement = doc.splitTextToSize(ROSNER_THRESHOLD_STATEMENT, contentWidth);
  doc.text(statement, MARGIN, y);
  y += statement.length * 3.5 + 1;
  const formula = doc.splitTextToSize(`Rosner's index = ${ROSNER_FORMULA}`, contentWidth);
  doc.text(formula, MARGIN, y);
  y += formula.length * 3.5 + 4;

  doc.setFontSize(9);
  doc.text(formatMixingStaffLine('Performed By', model.performedByName, model.performedByStaffId), MARGIN, y);
  y += 5;
  const reviewed = model.reviewedByName
    ? formatMixingStaffLine('Reviewed By', model.reviewedByName, model.reviewedByStaffId)
    : 'Reviewed By:';
  doc.text(reviewed, MARGIN, y);

  const footerLine = pageHeight - 14;
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, footerLine, pageWidth - MARGIN, footerLine);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(FORM_HEMA_023_FOOTER, MARGIN, footerLine + 4);
  doc.text(FORM_HEMA_023_QID, pageWidth - MARGIN, footerLine + 4, { align: 'right' });
  doc.text('Page 1 of 1', pageWidth / 2, footerLine + 8, { align: 'center' });
  return doc;
}

export function toFormHema023PdfModel(study: MixingStudy): FormHema023PdfModel {
  return {
    studyNumber: study.studyNumber,
    studyDate: study.studyDate,
    testSelection: study.testSelection,
    performedByName: study.performedByName,
    performedByStaffId: study.performedByStaffId,
    reviewedByName: study.reviewedByName,
    reviewedByStaffId: study.reviewedByStaffId,
    sections: study.results.map((result) => ({
      testType: result.testType,
      patientClottingTime: result.patientClottingTime,
      nppClottingTime: result.nppClottingTime,
      targetValue: result.targetValue,
      immediateMixClottingTime: result.immediateMixClottingTime,
      immediateRosnerIndex: result.immediateRosnerIndex,
      immediateInterpretation: result.immediateInterpretation,
      incubatedMixClottingTime: result.incubatedMixClottingTime,
      incubatedRosnerIndex: result.incubatedRosnerIndex,
      incubatedInterpretation: result.incubatedInterpretation,
      conclusion: result.conclusion,
    })),
  };
}

export async function downloadFormHema023Pdf(model: FormHema023PdfModel): Promise<void> {
  const doc = await buildFormHema023Pdf(model);
  doc.save(formHema023PdfFilename(model.studyNumber));
}

export async function printFormHema023Pdf(model: FormHema023PdfModel): Promise<void> {
  const doc = await buildFormHema023Pdf(model);
  doc.autoPrint();
  window.open(doc.output('bloburl'), '_blank', 'noopener,noreferrer');
}
