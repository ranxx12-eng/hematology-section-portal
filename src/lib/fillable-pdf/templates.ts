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
import { BUNDLED_HEMA_001_TEMPLATE } from '@/lib/fillable-pdf/bundled-hema-001';

export { BUNDLED_HEMA_001_TEMPLATE, HEMA_001_TEMPLATE_ID };

interface TemplateRow {
  id: string;
  title: string;
  form_number: string | null;
  description: string | null;
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

async function syncFields(templateId: string, fields: FillablePdfFieldInput[]): Promise<string | null> {
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();

  const { error: clearError } = await supabase
    .from('fillable_pdf_fields')
    .update({ deleted_at: new Date().toISOString() })
    .eq('template_id', templateId)
    .is('deleted_at', null);
  if (clearError) return clearError.message;

  if (fields.length === 0) return null;

  const usedKeys = new Set<string>();
  const rows = fields.map((field, index) => {
    let fieldKey = field.fieldKey.trim() || slugifyFillableFieldKey(field.label);
    let suffix = 1;
    while (usedKeys.has(fieldKey)) fieldKey = `${slugifyFillableFieldKey(field.label)}_${suffix++}`;
    usedKeys.add(fieldKey);

    return {
      id: field.id?.match(/^[0-9a-f-]{36}$/i) ? field.id : crypto.randomUUID(),
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
    };
  });

  const { error } = await supabase.from('fillable_pdf_fields').upsert(rows);
  return error?.message ?? null;
}

export function toTemplateInput(template: FillablePdfTemplate): FillablePdfTemplateInput {
  return {
    title: template.title,
    formNumber: template.formNumber,
    description: template.description,
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

  if (error) {
    if (error.message.includes('fillable_pdf_templates')) {
      return { data: [BUNDLED_HEMA_001_TEMPLATE], error: null };
    }
    return { data: [], error: error.message };
  }

  const templates = (data as unknown as TemplateRow[]).map(mapTemplate);
  if (templates.length === 0) return { data: [BUNDLED_HEMA_001_TEMPLATE], error: null };
  return { data: templates, error: null };
}

export async function fetchPublishedFillablePdfTemplates(): Promise<{ data: FillablePdfTemplate[]; error: string | null }> {
  const result = await fetchFillablePdfTemplates();
  return {
    data: result.data.filter((t) => t.status === 'published' || t.isPublished),
    error: result.error,
  };
}

export async function fetchFillablePdfTemplateById(id: string): Promise<{ data: FillablePdfTemplate | null; error: string | null }> {
  if (id === HEMA_001_TEMPLATE_ID) {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    const { data, error } = await supabase
      .from('fillable_pdf_templates')
      .select(TEMPLATE_SELECT)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error?.message.includes('fillable_pdf_templates') || !data) {
      return { data: BUNDLED_HEMA_001_TEMPLATE, error: null };
    }
    return { data: mapTemplate(data as unknown as TemplateRow), error: null };
  }

  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('fillable_pdf_templates')
    .select(TEMPLATE_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: mapTemplate(data as unknown as TemplateRow), error: null };
}

export async function updateFillablePdfTemplate(
  id: string,
  userId: string,
  input: FillablePdfTemplateInput,
): Promise<{ data: FillablePdfTemplate | null; error: string | null }> {
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  const existing = await fetchFillablePdfTemplateById(id);

  const { data, error } = await supabase
    .from('fillable_pdf_templates')
    .update(buildTemplateRow(input, userId, existing.data ?? undefined))
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single();

  if (error) return { data: null, error: error.message };

  const syncError = await syncFields(id, input.fields);
  if (syncError) return { data: null, error: syncError };

  return fetchFillablePdfTemplateById(id);
}

export async function publishFillablePdfTemplate(
  template: FillablePdfTemplate,
  userId: string,
): Promise<{ data: FillablePdfTemplate | null; error: string | null }> {
  const bumpVersion = template.status === 'published';
  const input = toTemplateInput({
    ...template,
    status: 'published',
    isPublished: true,
    version: bumpVersion ? template.version + 1 : template.version,
    publishedAt: new Date().toISOString(),
  });
  return updateFillablePdfTemplate(template.id, userId, input);
}

export async function archiveFillablePdfTemplate(
  template: FillablePdfTemplate,
  userId: string,
): Promise<{ data: FillablePdfTemplate | null; error: string | null }> {
  const input = toTemplateInput({ ...template, status: 'archived', isPublished: false });
  return updateFillablePdfTemplate(template.id, userId, input);
}

export async function duplicateFillablePdfTemplate(
  template: FillablePdfTemplate,
  userId: string,
): Promise<{ data: FillablePdfTemplate | null; error: string | null }> {
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  const input: FillablePdfTemplateInput = {
    ...toTemplateInput(template),
    title: `${template.title} (Copy)`,
    formNumber: template.formNumber ? `${template.formNumber}-COPY` : undefined,
    status: 'draft',
    version: 1,
    fields: template.fields.map((f) => ({ ...f, id: crypto.randomUUID() })),
  };

  const { data, error } = await supabase
    .from('fillable_pdf_templates')
    .insert({ ...buildTemplateRow(input, userId), created_by: userId })
    .select('*')
    .single();

  if (error || !data) return { data: null, error: error?.message ?? 'Failed to duplicate' };

  const syncError = await syncFields(data.id, input.fields);
  if (syncError) return { data: null, error: syncError };

  return fetchFillablePdfTemplateById(data.id);
}

export async function createFillablePdfTemplateFromUpload(
  userId: string,
  meta: {
    title: string;
    formNumber?: string;
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
  const input: FillablePdfTemplateInput = {
    title: meta.title,
    formNumber: meta.formNumber,
    status: 'draft',
    version: 1,
    sourcePdfPath: meta.sourcePdfPath,
    sourcePdfName: meta.sourcePdfName,
    pageCount: meta.pageCount,
    pageWidthPt: meta.pageWidthPt,
    pageHeightPt: meta.pageHeightPt,
    fields: meta.fields ?? [],
  };

  const { data, error } = await supabase
    .from('fillable_pdf_templates')
    .insert({ ...buildTemplateRow(input, userId), created_by: userId })
    .select('*')
    .single();

  if (error || !data) return { data: null, error: error?.message ?? 'Failed to create template' };
  if (input.fields.length > 0) {
    const syncError = await syncFields(data.id, input.fields);
    if (syncError) return { data: null, error: syncError };
  }
  return fetchFillablePdfTemplateById(data.id);
}

export async function uploadTemplatePdf(
  templateId: string,
  file: File,
): Promise<{ path: string | null; error: string | null }> {
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const path = `templates/${templateId}/${safeName}`;
  const { error } = await supabase.storage.from(FILLABLE_FORMS_BUCKET).upload(path, file, {
    upsert: true,
    contentType: 'application/pdf',
  });
  if (error) return { path: null, error: error.message };
  return { path, error: null };
}

export async function uploadCompletedPdf(
  submissionId: string,
  bytes: Uint8Array,
): Promise<{ path: string | null; error: string | null }> {
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  const path = `submissions/${submissionId}/completed.pdf`;
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
