import { jsPDF } from 'jspdf';
import {
  getPrintFormMetadata,
  PRINT_HOSPITAL_NAME,
  PRINT_LOGO_SRC,
  PRINT_SECTION_NAME,
  type PrintFormKey,
} from './form-metadata';

export const PDF_HEADER_HEIGHT = 28;
export const PDF_FOOTER_HEIGHT = 12;

async function loadLogoDataUrl(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  try {
    const response = await fetch(PRINT_LOGO_SRC);
    if (!response.ok) return null;

    const svgText = await response.text();
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const objectUrl = URL.createObjectURL(blob);

    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 120;
        canvas.height = img.naturalHeight || 120;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve(null);
        }
        URL.revokeObjectURL(objectUrl);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      img.src = objectUrl;
    });
  } catch {
    return null;
  }
}

function drawPdfHeader(doc: jsPDF, logoDataUrl: string | null) {
  const pageWidth = doc.internal.pageSize.getWidth();

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', pageWidth / 2 - 8, 6, 16, 16);
  }

  const textStartY = logoDataUrl ? 24 : 10;
  doc.setFontSize(12);
  doc.text(PRINT_HOSPITAL_NAME, pageWidth / 2, textStartY, { align: 'center' });
  doc.setFontSize(10);
  doc.text(PRINT_SECTION_NAME, pageWidth / 2, textStartY + 5, { align: 'center' });

  const dividerY = logoDataUrl ? 32 : 18;
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
  const logoDataUrl = await loadLogoDataUrl();
  drawPdfHeader(doc, logoDataUrl);

  return {
    doc,
    logoDataUrl,
    tableStartY: logoDataUrl ? 36 : 22,
    onDrawPage: () => applyPdfPageChrome(doc, formKey, logoDataUrl),
  };
}

export function applyPdfPageChrome(
  doc: jsPDF,
  formKey: PrintFormKey,
  logoDataUrl: string | null,
) {
  drawPdfHeader(doc, logoDataUrl);
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
