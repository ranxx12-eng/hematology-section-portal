import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { normalizedToPdfPoints } from '@/lib/fillable-pdf/coordinates';
import { formatFieldDisplayValue } from '@/lib/fillable-pdf/field-values';
import type { FillablePdfField, FillablePdfTemplate } from '@/types/modules';

function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const words = text.replace(/\r\n/g, '\n').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = words[0];
  const approxCharWidth = fontSize * 0.5;
  const maxChars = Math.max(8, Math.floor(maxWidth / approxCharWidth));

  for (let i = 1; i < words.length; i += 1) {
    const next = `${current} ${words[i]}`;
    if (next.length <= maxChars) current = next;
    else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);

  if (text.includes('\n')) {
    return text.split('\n').flatMap((part) => wrapText(part, maxWidth, fontSize));
  }
  return lines;
}

function drawFieldText(
  page: ReturnType<PDFDocument['getPages']>[number],
  field: FillablePdfField,
  text: string,
  pageWidthPt: number,
  pageHeightPt: number,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
) {
  if (!text.trim()) return;

  const fontSize = field.config?.fontSize ?? 9;
  const lineHeight = fontSize + 1;
  const rect = normalizedToPdfPoints(
    {
      pageNumber: field.pageNumber,
      posX: field.posX,
      posY: field.posY,
      width: field.width,
      height: field.height,
    },
    pageWidthPt,
    pageHeightPt,
  );

  const multiline = field.config?.multiline || field.type === 'textarea';
  const lines = multiline ? wrapText(text, rect.width - 2, fontSize) : [text];
  const maxLines = Math.max(1, Math.floor(rect.height / lineHeight));
  const clipped = lines.slice(0, maxLines);

  clipped.forEach((line, index) => {
    page.drawText(line, {
      x: rect.x + 1,
      y: rect.y + rect.height - fontSize - index * lineHeight,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
      maxWidth: rect.width - 2,
    });
  });
}

export async function generateCompletedFillablePdf(
  templatePdfBytes: Uint8Array,
  template: FillablePdfTemplate,
  answers: Record<string, unknown>,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(templatePdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  for (const field of template.fields) {
    const pageIndex = Math.max(0, (field.pageNumber ?? 1) - 1);
    const page = pages[pageIndex];
    if (!page) continue;
    const { width, height } = page.getSize();
    const text = formatFieldDisplayValue(answers[field.fieldKey]);
    drawFieldText(page, field, text, width, height, font);
  }

  return pdfDoc.save();
}

export async function downloadCompletedPdf(
  filename: string,
  bytes: Uint8Array,
): Promise<void> {
  const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], {
    type: 'application/pdf',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
