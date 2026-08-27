import { buildTemplateSnapshot, uploadCompletedPdf } from '@/lib/fillable-pdf/templates';
import { generateCompletedFillablePdf } from '@/lib/fillable-pdf/generate-completed-pdf';
import { validateFillablePdfAnswers } from '@/lib/fillable-pdf/field-values';
import { buildArchivePdfPath } from '@/lib/fillable-pdf/storage-paths';
import type { FillablePdfSubmission, FillablePdfTemplate, FillablePdfTemplateSnapshot } from '@/types/modules';

interface SubmissionRow {
  id: string;
  template_id: string;
  template_version: number;
  submitted_by: string | null;
  submitted_by_name: string | null;
  submitted_by_staff_id: string | null;
  answers: Record<string, unknown>;
  template_snapshot: FillablePdfTemplateSnapshot;
  completed_pdf_path: string | null;
  status: string;
  submitted_at: string;
}

function mapSubmission(row: SubmissionRow): FillablePdfSubmission {
  return {
    id: row.id,
    templateId: row.template_id,
    templateVersion: row.template_version,
    submittedBy: row.submitted_by ?? '',
    submittedByName: row.submitted_by_name ?? undefined,
    submittedByStaffId: row.submitted_by_staff_id ?? undefined,
    answers: row.answers ?? {},
    templateSnapshot: row.template_snapshot as FillablePdfSubmission['templateSnapshot'],
    completedPdfPath: row.completed_pdf_path ?? undefined,
    status: row.status,
    submittedAt: row.submitted_at,
  };
}

export async function submitFillablePdfForm(
  template: FillablePdfTemplate,
  templatePdfBytes: Uint8Array,
  userId: string,
  submittedByName: string,
  submittedByStaffId: string | null,
  answers: Record<string, unknown>,
): Promise<{ data: FillablePdfSubmission | null; error: string | null; completedPdfBytes?: Uint8Array }> {
  if (template.status !== 'published' && !template.isPublished) {
    return { data: null, error: 'This template is not published.' };
  }

  const validationError = validateFillablePdfAnswers(template.fields, answers);
  if (validationError) return { data: null, error: validationError };

  const snapshot = buildTemplateSnapshot(template);
  const completedPdfBytes = await generateCompletedFillablePdf(templatePdfBytes, template, answers);

  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();

  const submissionId = crypto.randomUUID();
  const submittedAt = new Date();
  const completedPath = buildArchivePdfPath(
    template.formNumber,
    template.version,
    submissionId,
    submittedAt,
  );

  const { data, error } = await supabase
    .from('fillable_pdf_submissions')
    .insert({
      id: submissionId,
      template_id: template.id,
      template_version: template.version,
      submitted_by: userId,
      submitted_by_name: submittedByName,
      submitted_by_staff_id: submittedByStaffId,
      answers,
      template_snapshot: snapshot,
      completed_pdf_path: completedPath,
      status: 'submitted',
    })
    .select('*')
    .single();

  if (error) {
    return { data: null, error: error.message, completedPdfBytes };
  }

  const upload = await uploadCompletedPdf(completedPath, completedPdfBytes);
  if (upload.error) {
    return {
      data: mapSubmission(data as unknown as SubmissionRow),
      error: `Saved submission but PDF upload failed: ${upload.error}`,
      completedPdfBytes,
    };
  }

  return {
    data: mapSubmission(data as unknown as SubmissionRow),
    error: null,
    completedPdfBytes,
  };
}

export async function fetchFillablePdfSubmissions(
  templateId: string,
): Promise<{ data: FillablePdfSubmission[]; error: string | null }> {
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('fillable_pdf_submissions')
    .select('*')
    .eq('template_id', templateId)
    .is('deleted_at', null)
    .order('submitted_at', { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data as unknown as SubmissionRow[]).map(mapSubmission), error: null };
}
