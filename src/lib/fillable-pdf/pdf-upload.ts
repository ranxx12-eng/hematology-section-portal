const MAX_PDF_BYTES = 20 * 1024 * 1024;

export interface PdfUploadValidation {
  valid: boolean;
  error?: string;
}

export function validatePdfUpload(file: File): PdfUploadValidation {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return { valid: false, error: 'Only PDF files are accepted.' };
  }
  if (file.type && file.type !== 'application/pdf') {
    return { valid: false, error: 'Invalid file type. Upload a PDF document.' };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { valid: false, error: 'PDF must be 20 MB or smaller.' };
  }
  if (file.size < 100) {
    return { valid: false, error: 'File is too small to be a valid PDF.' };
  }
  return { valid: true };
}

export async function readPdfHeader(file: File): Promise<PdfUploadValidation> {
  const basic = validatePdfUpload(file);
  if (!basic.valid) return basic;

  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  const magic = String.fromCharCode(...header);
  if (!magic.startsWith('%PDF')) {
    return { valid: false, error: 'File content is not a valid PDF.' };
  }
  return { valid: true };
}

export async function readPdfPageMetrics(file: File): Promise<{
  pageCount: number;
  pageWidthPt: number;
  pageHeightPt: number;
}> {
  const { PDFDocument } = await import('pdf-lib');
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPages()[0];
  const { width, height } = page.getSize();
  return { pageCount: doc.getPageCount(), pageWidthPt: width, pageHeightPt: height };
}
