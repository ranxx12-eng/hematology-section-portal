import type { FillablePdfField, FillablePdfFieldConfig, FillablePdfFieldType, FillablePdfStatus, FillablePdfTemplate, FillablePdfTemplateSnapshot } from '@/types/modules';
import {
  FILLABLE_FORMS_BUCKET,
  HEMA_001_BUNDLED_PDF,
  HEMA_001_TEMPLATE_ID,
  defaultOptionsForFillableType,
  slugifyFillableFieldKey,
  type FillablePdfFieldInput,
  type FillablePdfTemplateInput,
} from '@/lib/fillable-pdf/schema';
import { buildTemplateSourcePath } from '@/lib/fillable-pdf/storage-paths';

export { HEMA_001_TEMPLATE_ID };

interface TemplateRow {
  id: string;
  title: string;
  form_number: string | null;
  description: string | null;
  category: string | null;
  effective_date: string | null;
  review_date: string | null;
  version: number;
  status: FillablePdfStatus;
  source_pdf_path: string;
  source_pdf_name: string | null;
  page_count: number;
  page_width_pt: number | null;
  page_height_pt: number | null;
  is_published: boolean;
  published_at: string | null;
  created_by: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
  fillable_pdf_fields?: FieldRow[];
}

interface FieldRow {
  id: string;
  template_id: string;
  field_order: number;
  field_key: string;
  label: string;
  field_type: FillablePdfFieldType;
  page_number: number;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  required: boolean;
  placeholder: string | null;
  options: string[] | null;
  config: FillablePdfFieldConfig | null;
}

const TEMPLATE_SELECT = `
  *,
  fillable_pdf_fields (
    id, template_id, field_order, field_key, label, field_type,
    page_number, pos_x, pos_y, width, height,
    required, placeholder, options, config
  )
`;

function mapField(row: FieldRow): FillablePdfField {
  return {
    id: row.id,
    fieldKey: row.field_key,
    label: row.label,
    type: row.field_type,
    pageNumber: row.page_number,
    posX: Number(row.pos_x),
    posY: Number(row.pos_y),
    width: Number(row.width),
    height: Number(row.height),
    required: row.required,
    placeholder: row.placeholder ?? undefined,
    options: row.options ?? undefined,
    config: row.config ?? undefined,
  };
}

function mapTemplate(row: TemplateRow): FillablePdfTemplate {
  const fields = (row.fillable_pdf_fields ?? [])
    .filter((f) => f)
    .sort((a, b) => a.field_order - b.field_order)
    .map(mapField);

  return {
    id: row.id,
    title: row.title,
    formNumber: row.form_number ?? undefined,
    description: row.description ?? undefined,
    category: row.category ?? undefined,
    effectiveDate: row.effective_date ?? undefined,
    reviewDate: row.review_date ?? undefined,
    version: row.version,
    status: row.status,
    sourcePdfPath: row.source_pdf_path,
    sourcePdfName: row.source_pdf_name ?? undefined,
    pageCount: row.page_count,
    pageWidthPt: row.page_width_pt ? Number(row.page_width_pt) : undefined,
    pageHeightPt: row.page_height_pt ? Number(row.page_height_pt) : undefined,
    isPublished: row.is_published,
    publishedAt: row.published_at ?? undefined,
    createdBy: row.created_by ?? '',
    ownerId: row.owner_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    fields,
  };
}

function buildTemplateRow(input: FillablePdfTemplateInput, userId: string, existing?: FillablePdfTemplate) {
  const isPublished = input.status === 'published';
  return {
    title: input.title.trim(),
    form_number: input.formNumber?.trim() || null,
    description: input.description?.trim() || null,
    category: input.category?.trim() || null,
    effective_date: input.effectiveDate || null,
    review_date: input.reviewDate || null,
    version: input.version,
    status: input.status,
    source_pdf_path: input.sourcePdfPath,
    source_pdf_name: input.sourcePdfName ?? null,
    page_count: input.pageCount,
    page_width_pt: input.pageWidthPt ?? null,
    page_height_pt: input.pageHeightPt ?? null,
    is_published: isPublished,
    published_at: isPublished ? existing?.publishedAt ?? new Date().toISOString() : null,
    updated_by: userId,
    owner_id: existing?.ownerId ?? userId,
  };
}

function buildFieldRow(
  templateId: string,
  field: FillablePdfFieldInput,
  index: number,
  usedKeys: Set<string>,
): { id: string; row: Record<string, unknown> } {
  let fieldKey = field.fieldKey.trim() || slugifyFillableFieldKey(field.label);
  let suffix = 1;
  while (usedKeys.has(fieldKey)) fieldKey = `${slugifyFillableFieldKey(field.label)}_${suffix++}`;
  usedKeys.add(fieldKey);

  const id = field.id?.match(/^[0-9a-f-]{36}$/i) ? field.id : crypto.randomUUID();
  return {
    id,
    row: {
      id,
      template_id: templateId,
      field_order: index,
      field_key: fieldKey,
      label: field.label,
      field_type: field.type,
      page_number: field.pageNumber,
      pos_x: field.posX,
      pos_y: field.posY,
      width: field.width,
      height: field.height,
      required: field.required,
      placeholder: field.placeholder ?? null,
      options: field.options ?? defaultOptionsForFillableType(field.type) ?? null,
      config: field.config ?? {},
      deleted_at: null,
    },
  };
}

/**
 * Reconcile designer fields with DB rows without soft-deleting everything first.
 * - UPDATE rows that remain (by stable UUID)
 * - INSERT genuinely new rows
 * - soft-delete only rows removed in the designer
 */
async function syncFields(templateId: string, fields: FillablePdfFieldInput[]): Promise<string | null> {
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();

  const { data: activeRows, error: fetchError } = await supabase
    .from('fillable_pdf_fields')
    .select('id')
    .eq('template_id', templateId)
    .is('deleted_at', null);

  if (fetchError) return fetchError.message;

  const activeIds = new Set((activeRows ?? []).map((row) => row.id));
  const usedKeys = new Set<string>();
  const incomingIds = new Set<string>();
  const rows: Record<string, unknown>[] = [];

  for (const [index, field] of fields.entries()) {
    const { id, row } = buildFieldRow(templateId, field, index, usedKeys);
    incomingIds.add(id);
    rows.push(row);
  }

  const removedIds = [...activeIds].filter((id) => !incomingIds.has(id));
  if (removedIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('fillable_pdf_fields')
      .update({ deleted_at: new Date().toISOString() })
      .eq('template_id', templateId)
      .in('id', removedIds)
      .is('deleted_at', null);
    if (deleteError) return deleteError.message;
  }

  for (const row of rows) {
    const fieldId = row.id as string;

    if (activeIds.has(fieldId)) {
      const { error } = await supabase
        .from('fillable_pdf_fields')
        .update(row)
        .eq('id', fieldId)
        .eq('template_id', templateId);
      if (error) return error.message;
      continue;
    }

    // Restore soft-deleted rows (hidden from SELECT) or insert genuinely new fields.
    const { data: updated, error: updateError } = await supabase
      .from('fillable_pdf_fields')
      .update(row)
      .eq('id', fieldId)
      .eq('template_id', templateId)
      .select('id');

    if (updateError) return updateError.message;
    if (updated?.length) continue;

    const { error: insertError } = await supabase.from('fillable_pdf_fields').insert(row);
    if (insertError) return insertError.message;
  }

  return null;
}

async function fetchTemplatePdfBytes(templateId: string): Promise<ArrayBuffer | null> {
  const res = await fetch(`/api/fillable-forms/templates/${templateId}/source-pdf`);
  if (!res.ok) return null;
  return res.arrayBuffer();
}

async function copyTemplatePdfToPath(
  sourceTemplateId: string,
  sourcePath: string,
  destTemplateId: string,
  version: number,
): Promise<{ path: string | null; error: string | null }> {
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  const destPath = buildTemplateSourcePath(destTemplateId, version);

  let bytes: ArrayBuffer | null = null;
  const { data, error } = await supabase.storage.from(FILLABLE_FORMS_BUCKET).download(sourcePath);
  if (!error && data) {
    bytes = await data.arrayBuffer();
  } else {
    bytes = await fetchTemplatePdfBytes(sourceTemplateId);
  }

  if (!bytes) return { path: null, error: error?.message ?? 'Source PDF not found' };

  const { error: uploadError } = await supabase.storage.from(FILLABLE_FORMS_BUCKET).upload(destPath, bytes, {
    upsert: true,
    contentType: 'application/pdf',
  });
  if (uploadError) return { path: null, error: uploadError.message };
  return { path: destPath, error: null };
}

export function toTemplateInput(template: FillablePdfTemplate): FillablePdfTemplateInput {
  return {
    title: template.title,
    formNumber: template.formNumber,
    description: template.description,
    category: template.category,
    effectiveDate: template.effectiveDate,
    reviewDate: template.reviewDate,
    version: template.version,
    status: template.status,
    sourcePdfPath: template.sourcePdfPath,
    sourcePdfName: template.sourcePdfName,
    pageCount: template.pageCount,
    pageWidthPt: template.pageWidthPt,
    pageHeightPt: template.pageHeightPt,
    fields: template.fields.map((f) => ({
      id: f.id,
      fieldKey: f.fieldKey,
      label: f.label,
      type: f.type,
      pageNumber: f.pageNumber,
      posX: f.posX,
      posY: f.posY,
      width: f.width,
      height: f.height,
      required: f.required,
      placeholder: f.placeholder,
      options: f.options,
      config: f.config,
    })),
  };
}

export function buildTemplateSnapshot(template: FillablePdfTemplate): FillablePdfTemplateSnapshot {
  return {
    title: template.title,
    formNumber: template.formNumber,
    version: template.version,
    sourcePdfPath: template.sourcePdfPath,
    pageWidthPt: template.pageWidthPt,
    pageHeightPt: template.pageHeightPt,
    fields: template.fields,
  };
}

export async function fetchFillablePdfTemplates(): Promise<{ data: FillablePdfTemplate[]; error: string | null }> {
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('fillable_pdf_templates')
    .select(TEMPLATE_SELECT)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data as unknown as TemplateRow[]).map(mapTemplate), error: null };
}

export async function fetchPublishedFillablePdfTemplates(): Promise<{ data: FillablePdfTemplate[]; error: string | null }> {
  const result = await fetchFillablePdfTemplates();
  return {
    data: result.data.filter((t) => t.status === 'published' || t.isPublished),
    error: result.error,
  };
}

export async function fetchFillablePdfTemplateById(id: string): Promise<{ data: FillablePdfTemplate | null; error: string | null }> {
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('fillable_pdf_templates')
    .select(TEMPLATE_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };
  return { data: mapTemplate(data as unknown as TemplateRow), error: null };
}

export async function fetchArchiveCountsByTemplate(): Promise<Record<string, number>> {
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  const { data } = await supabase
    .from('fillable_pdf_submissions')
    .select('template_id')
    .is('deleted_at', null);

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.template_id] = (counts[row.template_id] ?? 0) + 1;
  }
  return counts;
}

export async function updateFillablePdfTemplate(
  id: string,
  userId: string,
  input: FillablePdfTemplateInput,
): Promise<{ data: FillablePdfTemplate | null; error: string | null }> {
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  const existing = await fetchFillablePdfTemplateById(id);

  const syncError = await syncFields(id, input.fields);
  if (syncError) return { data: null, error: syncError };

  const { error } = await supabase
    .from('fillable_pdf_templates')
    .update(buildTemplateRow(input, userId, existing.data ?? undefined))
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single();

  if (error) return { data: null, error: error.message };

  return fetchFillablePdfTemplateById(id);
}

export async function publishFillablePdfTemplate(
  template: FillablePdfTemplate,
  userId: string,
): Promise<{ data: FillablePdfTemplate | null; error: string | null }> {
  const input = toTemplateInput({
    ...template,
    status: 'published',
    isPublished: true,
    publishedAt: new Date().toISOString(),
  });
  return updateFillablePdfTemplate(template.id, userId, input);
}

export async function retireFillablePdfTemplate(
  template: FillablePdfTemplate,
  userId: string,
): Promise<{ data: FillablePdfTemplate | null; error: string | null }> {
  const input = toTemplateInput({ ...template, status: 'archived', isPublished: false });
  return updateFillablePdfTemplate(template.id, userId, input);
}

/** @deprecated Use retireFillablePdfTemplate — retires the template lifecycle, not submission archive. */
export const archiveFillablePdfTemplate = retireFillablePdfTemplate;

export async function duplicateFillablePdfTemplate(
  template: FillablePdfTemplate,
  userId: string,
): Promise<{ data: FillablePdfTemplate | null; error: string | null }> {
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  const newId = crypto.randomUUID();
  const version = 1;

  const pdfCopy = await copyTemplatePdfToPath(template.id, template.sourcePdfPath, newId, version);
  if (pdfCopy.error || !pdfCopy.path) {
    return { data: null, error: pdfCopy.error ?? 'Failed to copy PDF template' };
  }

  const input: FillablePdfTemplateInput = {
    ...toTemplateInput(template),
    title: `${template.title} (Copy)`,
    formNumber: template.formNumber ? `${template.formNumber}-COPY` : undefined,
    status: 'draft',
    version,
    sourcePdfPath: pdfCopy.path,
    fields: template.fields.map((f) => ({ ...f, id: crypto.randomUUID() })),
  };

  const { data, error } = await supabase
    .from('fillable_pdf_templates')
    .insert({ id: newId, ...buildTemplateRow(input, userId), created_by: userId })
    .select('*')
    .single();

  if (error || !data) return { data: null, error: error?.message ?? 'Failed to duplicate' };

  const syncError = await syncFields(newId, input.fields);
  if (syncError) return { data: null, error: syncError };

  return fetchFillablePdfTemplateById(newId);
}

export async function createNewFillablePdfVersion(
  template: FillablePdfTemplate,
  userId: string,
): Promise<{ data: FillablePdfTemplate | null; error: string | null }> {
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  const newId = crypto.randomUUID();
  const newVersion = template.version + 1;

  const pdfCopy = await copyTemplatePdfToPath(template.id, template.sourcePdfPath, newId, newVersion);
  if (pdfCopy.error || !pdfCopy.path) {
    return { data: null, error: pdfCopy.error ?? 'Failed to copy PDF template' };
  }

  const input: FillablePdfTemplateInput = {
    ...toTemplateInput(template),
    status: 'draft',
    version: newVersion,
    sourcePdfPath: pdfCopy.path,
    fields: template.fields.map((f) => ({ ...f, id: crypto.randomUUID() })),
  };

  const { data, error } = await supabase
    .from('fillable_pdf_templates')
    .insert({ id: newId, ...buildTemplateRow(input, userId), created_by: userId })
    .select('*')
    .single();

  if (error || !data) return { data: null, error: error?.message ?? 'Failed to create version' };

  const syncError = await syncFields(newId, input.fields);
  if (syncError) return { data: null, error: syncError };

  return fetchFillablePdfTemplateById(newId);
}

export async function createFillablePdfTemplateFromUpload(
  userId: string,
  meta: {
    id?: string;
    title: string;
    formNumber?: string;
    category?: string;
    description?: string;
    effectiveDate?: string;
    reviewDate?: string;
    version?: number;
    sourcePdfPath: string;
    sourcePdfName: string;
    pageCount: number;
    pageWidthPt: number;
    pageHeightPt: number;
    fields?: FillablePdfFieldInput[];
  },
): Promise<{ data: FillablePdfTemplate | null; error: string | null }> {
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  const templateId = meta.id ?? crypto.randomUUID();
  const version = meta.version ?? 1;

  const input: FillablePdfTemplateInput = {
    title: meta.title,
    formNumber: meta.formNumber,
    category: meta.category,
    description: meta.description,
    effectiveDate: meta.effectiveDate,
    reviewDate: meta.reviewDate,
    status: 'draft',
    version,
    sourcePdfPath: meta.sourcePdfPath,
    sourcePdfName: meta.sourcePdfName,
    pageCount: meta.pageCount,
    pageWidthPt: meta.pageWidthPt,
    pageHeightPt: meta.pageHeightPt,
    fields: meta.fields ?? [],
  };

  const { data, error } = await supabase
    .from('fillable_pdf_templates')
    .insert({ id: templateId, ...buildTemplateRow(input, userId), created_by: userId })
    .select('*')
    .single();

  if (error || !data) return { data: null, error: error?.message ?? 'Failed to create template' };
  if (input.fields.length > 0) {
    const syncError = await syncFields(templateId, input.fields);
    if (syncError) return { data: null, error: syncError };
  }
  return fetchFillablePdfTemplateById(templateId);
}

export async function uploadTemplatePdf(
  templateId: string,
  file: File,
  version = 1,
): Promise<{ path: string | null; error: string | null }> {
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  const path = buildTemplateSourcePath(templateId, version);
  const { error } = await supabase.storage.from(FILLABLE_FORMS_BUCKET).upload(path, file, {
    upsert: true,
    contentType: 'application/pdf',
  });
  if (error) return { path: null, error: error.message };
  return { path, error: null };
}

export async function uploadCompletedPdf(
  path: string,
  bytes: Uint8Array,
): Promise<{ path: string | null; error: string | null }> {
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  const { error } = await supabase.storage.from(FILLABLE_FORMS_BUCKET).upload(path, bytes, {
    upsert: true,
    contentType: 'application/pdf',
  });
  if (error) return { path: null, error: error.message };
  return { path, error: null };
}

export function resolveTemplatePdfUrl(templateId: string): string {
  return `/api/fillable-forms/templates/${templateId}/source-pdf`;
}

export function resolveCompletedPdfUrl(submissionId: string): string {
  return `/api/fillable-forms/submissions/${submissionId}/completed-pdf`;
}

export function isBundledTemplatePath(path: string): boolean {
  return path === HEMA_001_BUNDLED_PDF;
}
