/** Build private storage path for a template source PDF. */
export function buildTemplateSourcePath(templateId: string, version: number): string {
  return `templates/${templateId}/v${version}/source.pdf`;
}

/** Build private storage path for a completed submission PDF (new uploads). */
export function buildArchivePdfPath(
  formNumber: string | undefined,
  version: number,
  submissionId: string,
  submittedAt: Date,
): string {
  const slug = (formNumber?.trim() || 'form').replace(/[^a-zA-Z0-9.-]+/g, '-');
  const year = submittedAt.getFullYear();
  const month = String(submittedAt.getMonth() + 1).padStart(2, '0');
  return `archive/${slug}/v${version}/${year}/${month}/${submissionId}.pdf`;
}

/** Legacy path used before archive folder structure — kept for existing rows. */
export function buildLegacySubmissionPath(submissionId: string): string {
  return `submissions/${submissionId}/completed.pdf`;
}
