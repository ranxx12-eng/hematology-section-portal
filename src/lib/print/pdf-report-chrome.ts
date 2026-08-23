import { jsPDF } from 'jspdf';
import {
  getPrintFormMetadata,
  PRINT_HOSPITAL_NAME,
  PRINT_SECTION_NAME,
  type PrintFormKey,
} from './form-metadata';
import { loadOfficialLogoForPdf } from '@/lib/portal/official-logo';

export const PDF_HEADER_HEIGHT = 28;
export const PDF_FOOTER_HEIGHT = 12;

interface PdfLogoRender {
  dataUrl: string;
  width: number;
  height: number;
  format: 'PNG' | 'JPEG' | 'WEBP';
}

async function loadLogoForPdf(): Promise<PdfLogoRender | null> {
  const { dataUrl, dimensions } = await loadOfficialLogoForPdf();
  if (!dataUrl || !dimensions) return null;

  return {
    dataUrl,
    width: dimensions.width,
    height: dimensions.height,
    format: dimensions.format,
  };
}

function drawPdfHeader(doc: jsPDF, logo: PdfLogoRender | null) {
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

  const textStartY = logo ? 24 : 10;
  doc.setFontSize(12);
  doc.text(PRINT_HOSPITAL_NAME, pageWidth / 2, textStartY, { align: 'center' });
  doc.setFontSize(10);
  doc.text(PRINT_SECTION_NAME, pageWidth / 2, textStartY + 5, { align: 'center' });

  const dividerY = logo ? 32 : 18;
  doc.setLineWidth(0.2);
  doc.line(14, dividerY, pageWidth - 14, dividerY);
}

function drawPdfFooter(doc: jsPDF, formKey: PrintFormKey) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const { formName, formNo } = getPrintFormMetadata(formKey);
  const footerY = pageHeight - 8;

  doc.setLineWidth(0.2);
  doc.line(14, footerY - 4, pageWidth - 14, footerY - 4);

  doc.setFontSize(9);
  doc.text(`Form Name: ${formName}`, 14, footerY);
  doc.text(`Form No.: ${formNo}`, pageWidth - 14, footerY, { align: 'right' });
}

export async function createPdfWithReportChrome(formKey: PrintFormKey): Promise<{
  doc: jsPDF;
  logoDataUrl: string | null;
  tableStartY: number;
  onDrawPage: () => void;
}> {
  const doc = new jsPDF({ orientation: 'landscape' });
  const logo = await loadLogoForPdf();
  drawPdfHeader(doc, logo);

  return {
    doc,
    logoDataUrl: logo?.dataUrl ?? null,
    tableStartY: logo ? 36 : 22,
    onDrawPage: () => applyPdfPageChrome(doc, formKey, logo),
  };
}

export function applyPdfPageChrome(
  doc: jsPDF,
  formKey: PrintFormKey,
  logo: PdfLogoRender | null,
) {
  drawPdfHeader(doc, logo);
  drawPdfFooter(doc, formKey);
}

export function getPdfAutoTableMargins() {
  return {
    top: PDF_HEADER_HEIGHT,
    bottom: PDF_FOOTER_HEIGHT,
    left: 14,
    right: 14,
  };
}
