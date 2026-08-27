import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { OFFICIAL_HOSPITAL_LOGO_SRC } from '@/lib/portal/official-logo.constants';
import { formatAnswerValue, getResponseFields } from '@/components/form-builder/form-renderer';
import { PRINT_HOSPITAL_NAME, PRINT_SECTION_NAME } from '@/lib/print/form-metadata';
import type { DynamicForm, FormResponse } from '@/types/modules';

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const response = await fetch(OFFICIAL_HOSPITAL_LOGO_SRC);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function createFormResponsePdf(
  form: DynamicForm,
  response: FormResponse,
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const logo = await loadLogoDataUrl();
  const fields = getResponseFields(response, form);
  const title = response.formSnapshot?.title ?? form.title;
  const formNumber = response.formSnapshot?.formNumber ?? form.formNumber ?? '—';
  const version = response.formVersion ?? form.version;

  if (logo) {
    doc.addImage(logo, 'PNG', 85, 8, 40, 16);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(PRINT_HOSPITAL_NAME, 105, 30, { align: 'center' });
  doc.setFontSize(10);
  doc.text(PRINT_SECTION_NAME, 105, 36, { align: 'center' });
  doc.setFontSize(13);
  doc.text(title, 105, 46, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Form No.: ${formNumber}`, 14, 56);
  doc.text(`Version: v${version}`, 14, 61);
  doc.text(`Submitted By: ${response.submittedByName ?? '—'}`, 14, 66);
  doc.text(`Staff ID: ${response.submittedByStaffId ?? 'Not assigned'}`, 14, 71);
  doc.text(`Submitted At: ${new Date(response.submittedAt).toLocaleString()}`, 14, 76);

  autoTable(doc, {
    startY: 82,
    head: [['Field', 'Response']],
    body: fields
      .filter((field) => !['section_header', 'instructions', 'divider'].includes(field.type))
      .map((field) => [field.label, formatAnswerValue(response.answers[field.id])]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39] },
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.text(`Form Name: ${title}`, 14, 287);
    doc.text(`Form No.: ${formNumber}`, 105, 287, { align: 'center' });
    doc.text(`Page ${page} of ${pageCount}`, 196, 287, { align: 'right' });
  }

  return doc;
}

export async function downloadFormResponsePdf(form: DynamicForm, response: FormResponse): Promise<void> {
  const doc = await createFormResponsePdf(form, response);
  const safeTitle = (form.formNumber || form.title).replace(/\s+/g, '-').toLowerCase();
  doc.save(`${safeTitle}-response-${response.id.slice(0, 8)}.pdf`);
}
