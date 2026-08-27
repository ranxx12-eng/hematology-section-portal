import { createClient } from '@/lib/supabase/client';
import type { DynamicFormInput } from '@/lib/forms/schema';
import { defaultOptionsForType, slugifyFieldKey } from '@/lib/forms/schema';
import type { DynamicForm, FormField, FormResponse, FormSnapshot, FormStatus } from '@/types/modules';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface FormFieldRow {
  id: string;
  form_id: string;
  field_order: number;
  label: string;
  field_key: string | null;
  field_type: FormField['type'];
  required: boolean;
  options: string[] | null;
  placeholder: string | null;
  help_text: string | null;
  default_value: string | null;
  config: FormField['config'] | null;
}

interface DynamicFormRow {
  id: string;
  title: string;
  form_number: string | null;
  description: string | null;
  category: string | null;
  version: number;
  status: FormStatus;
  is_published: boolean;
  created_by: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  effective_date: string | null;
  review_date: string | null;
  form_fields?: FormFieldRow[];
}

interface FormSubmissionRow {
  id: string;
  form_id: string;
  submitted_by: string | null;
  submitted_by_name: string | null;
  submitted_by_staff_id: string | null;
  form_version: number | null;
  form_snapshot: FormSnapshot | null;
  answers: Record<string, unknown>;
  status: string;
  submitted_at: string;
}

function mapFormField(row: FormFieldRow): FormField {
  return {
    id: row.id,
    label: row.label,
    fieldKey: row.field_key ?? undefined,
    type: row.field_type,
    required: row.required,
    options: row.options ?? undefined,
    placeholder: row.placeholder ?? undefined,
    helpText: row.help_text ?? undefined,
    defaultValue: row.default_value ?? undefined,
    config: row.config ?? undefined,
  };
}

function mapDynamicForm(row: DynamicFormRow): DynamicForm {
  const fields = (row.form_fields ?? [])
    .sort((a, b) => a.field_order - b.field_order)
    .map(mapFormField);

  return {
    id: row.id,
    title: row.title,
    formNumber: row.form_number ?? undefined,
    description: row.description ?? undefined,
    category: row.category ?? undefined,
    version: row.version ?? 1,
    status: row.status ?? (row.is_published ? 'published' : 'draft'),
    fields,
    isPublished: row.is_published,
    createdBy: row.created_by ?? '',
    ownerId: row.owner_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at ?? undefined,
    effectiveDate: row.effective_date ?? undefined,
    reviewDate: row.review_date ?? undefined,
  };
}

function mapFormResponse(row: FormSubmissionRow): FormResponse {
  return {
    id: row.id,
    formId: row.form_id,
    submittedBy: row.submitted_by ?? '',
    submittedByName: row.submitted_by_name ?? undefined,
    submittedByStaffId: row.submitted_by_staff_id ?? undefined,
    formVersion: row.form_version ?? undefined,
    formSnapshot: row.form_snapshot ?? undefined,
    answers: row.answers ?? {},
    status: row.status ?? 'submitted',
    submittedAt: row.submitted_at,
  };
}

const FORM_SELECT = `
  *,
  form_fields (
    id,
    form_id,
    field_order,
    label,
    field_key,
    field_type,
    required,
    options,
    placeholder,
    help_text,
    default_value,
    config
  )
`;

function toFormInput(form: DynamicForm): DynamicFormInput {
  return {
    title: form.title,
    formNumber: form.formNumber,
    description: form.description,
    category: form.category,
    version: form.version,
    status: form.status,
    isPublished: form.isPublished,
    effectiveDate: form.effectiveDate,
    reviewDate: form.reviewDate,
    fields: form.fields.map((field) => ({
      id: field.id,
      label: field.label,
      fieldKey: field.fieldKey,
      type: field.type,
      required: field.required,
      options: field.options,
      placeholder: field.placeholder,
      helpText: field.helpText,
      defaultValue: field.defaultValue,
      config: field.config,
    })),
  };
}

function buildFormRow(input: DynamicFormInput, userId: string, existing?: DynamicForm) {
  const status = input.status;
  const isPublished = status === 'published';

  return {
    title: input.title.trim(),
    form_number: input.formNumber?.trim() || null,
    description: input.description?.trim() || null,
    category: input.category?.trim() || null,
    version: input.version,
    status,
    is_published: isPublished,
    effective_date: input.effectiveDate || null,
    review_date: input.reviewDate || null,
    updated_by: userId,
    owner_id: existing?.ownerId ?? userId,
    published_at: isPublished
      ? existing?.publishedAt ?? new Date().toISOString()
      : null,
  };
}

async function syncFormFields(formId: string, fields: DynamicFormInput['fields']): Promise<string | null> {
  const supabase = createClient();
  const { error: clearError } = await supabase
    .from('form_fields')
    .update({ deleted_at: new Date().toISOString() })
    .eq('form_id', formId)
    .is('deleted_at', null);

  if (clearError) return clearError.message;

  if (fields.length === 0) return null;

  const usedKeys = new Set<string>();
  const rows = fields.map((field, index) => {
    let fieldKey = field.fieldKey?.trim() || slugifyFieldKey(field.label);
    let suffix = 1;
    while (usedKeys.has(fieldKey)) {
      fieldKey = `${slugifyFieldKey(field.label)}_${suffix++}`;
    }
    usedKeys.add(fieldKey);

    return {
      id: field.id?.match(/^[0-9a-f-]{36}$/i) ? field.id : crypto.randomUUID(),
      form_id: formId,
      field_order: index,
      label: field.label,
      field_key: fieldKey,
      field_type: field.type,
      required: field.required,
      options: field.options ?? defaultOptionsForType(field.type) ?? null,
      placeholder: field.placeholder ?? null,
      help_text: field.helpText ?? null,
      default_value: field.defaultValue ?? null,
      config: field.config ?? {},
      deleted_at: null,
    };
  });

  const { error } = await supabase.from('form_fields').upsert(rows);
  return error?.message ?? null;
}

export async function fetchDynamicForms(): Promise<ClinicalListResult<DynamicForm>> {
  return runClinicalListQuery('Failed to load forms', async () => {
    const supabase = createClient();
    return supabase
      .from('dynamic_forms')
      .select(FORM_SELECT)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
  }).then((result) => ({
    data: (result.data as unknown as DynamicFormRow[]).map(mapDynamicForm),
    error: result.error,
  }));
}

export async function fetchPublishedForms(): Promise<ClinicalListResult<DynamicForm>> {
  const result = await fetchDynamicForms();
  return {
    data: result.data.filter((form) => form.status === 'published'),
    error: result.error,
  };
}

export async function fetchDynamicFormById(id: string): Promise<ClinicalResult<DynamicForm>> {
  return runClinicalMutation('Failed to load form', async () => {
    const supabase = createClient();
    return supabase
      .from('dynamic_forms')
      .select(FORM_SELECT)
      .eq('id', id)
      .is('deleted_at', null)
      .single();
  }).then((result) => ({
    data: result.data ? mapDynamicForm(result.data as unknown as DynamicFormRow) : null,
    error: result.error,
  }));
}

export async function fetchFormResponses(formId: string): Promise<ClinicalListResult<FormResponse>> {
  return runClinicalListQuery('Failed to load form responses', async () => {
    const supabase = createClient();
    return supabase
      .from('form_submissions')
      .select('*')
      .eq('form_id', formId)
      .is('deleted_at', null)
      .order('submitted_at', { ascending: false });
  }).then((result) => ({
    data: (result.data as unknown as FormSubmissionRow[]).map(mapFormResponse),
    error: result.error,
  }));
}

export async function createDynamicForm(
  userId: string,
  input: DynamicFormInput,
): Promise<ClinicalResult<DynamicForm>> {
  const result = await runClinicalMutation('Failed to create form', async () => {
    const supabase = createClient();
    return supabase
      .from('dynamic_forms')
      .insert({
        ...buildFormRow(input, userId),
        created_by: userId,
      })
      .select('*')
      .single();
  });

  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }

  const formRow = result.data as unknown as DynamicFormRow;
  const syncError = await syncFormFields(formRow.id, input.fields);
  if (syncError) return { data: null, error: syncError };

  return fetchDynamicFormById(formRow.id);
}

export async function updateDynamicForm(
  id: string,
  userId: string,
  input: DynamicFormInput,
): Promise<ClinicalResult<DynamicForm>> {
  const result = await runClinicalMutation('Failed to update form', async () => {
    const supabase = createClient();
    return supabase
      .from('dynamic_forms')
      .update(buildFormRow(input, userId))
      .eq('id', id)
      .is('deleted_at', null)
      .select('*')
      .single();
  });

  if (result.error) return { data: null, error: result.error };

  const syncError = await syncFormFields(id, input.fields);
  if (syncError) return { data: null, error: syncError };

  return fetchDynamicFormById(id);
}

export async function saveDynamicFormDraft(
  form: DynamicForm,
  userId: string,
): Promise<ClinicalResult<DynamicForm>> {
  const input = toFormInput({ ...form, status: 'draft', isPublished: false });
  return updateDynamicForm(form.id, userId, input);
}

export async function publishDynamicForm(
  form: DynamicForm,
  userId: string,
): Promise<ClinicalResult<DynamicForm>> {
  const bumpVersion = form.status === 'published';
  const input = toFormInput({
    ...form,
    status: 'published',
    isPublished: true,
    version: bumpVersion ? form.version + 1 : form.version,
    publishedAt: new Date().toISOString(),
  });
  return updateDynamicForm(form.id, userId, input);
}

export async function archiveDynamicForm(
  form: DynamicForm,
  userId: string,
): Promise<ClinicalResult<DynamicForm>> {
  const input = toFormInput({ ...form, status: 'archived', isPublished: false });
  return updateDynamicForm(form.id, userId, input);
}

export async function duplicateDynamicForm(
  form: DynamicForm,
  userId: string,
): Promise<ClinicalResult<DynamicForm>> {
  const input: DynamicFormInput = {
    ...toFormInput(form),
    title: `${form.title} (Copy)`,
    formNumber: form.formNumber ? `${form.formNumber}-COPY` : undefined,
    status: 'draft',
    isPublished: false,
    version: 1,
    fields: form.fields.map((field) => ({
      ...field,
      id: crypto.randomUUID(),
    })),
  };
  return createDynamicForm(userId, input);
}

export async function softDeleteDynamicForm(id: string, userId: string): Promise<{ error: string | null }> {
  const result = await runClinicalMutation('Failed to delete form', async () => {
    const supabase = createClient();
    return supabase
      .from('dynamic_forms')
      .update({ deleted_at: new Date().toISOString(), updated_by: userId, status: 'archived', is_published: false })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .single();
  });
  return { error: result.error };
}

export async function submitFormResponse(
  form: DynamicForm,
  userId: string,
  submittedByName: string,
  submittedByStaffId: string | null,
  answers: Record<string, unknown>,
): Promise<ClinicalResult<FormResponse>> {
  if (form.status !== 'published') {
    return { data: null, error: 'This form is not available for submission.' };
  }

  const snapshot: FormSnapshot = {
    title: form.title,
    formNumber: form.formNumber,
    version: form.version,
    fields: form.fields,
  };

  const result = await runClinicalMutation('Failed to submit form', async () => {
    const supabase = createClient();
    return supabase
      .from('form_submissions')
      .insert({
        form_id: form.id,
        submitted_by: userId,
        submitted_by_name: submittedByName,
        submitted_by_staff_id: submittedByStaffId,
        form_version: form.version,
        form_snapshot: snapshot,
        answers,
        status: 'submitted',
      })
      .select('*')
      .single();
  });

  return {
    data: result.data ? mapFormResponse(result.data as unknown as FormSubmissionRow) : null,
    error: result.error,
  };
}

export function buildFormSnapshot(form: DynamicForm): FormSnapshot {
  return {
    title: form.title,
    formNumber: form.formNumber,
    version: form.version,
    fields: form.fields,
  };
}

export function getRenderableFields(form: { fields: FormField[] }): FormField[] {
  return form.fields.filter((field) => field.config?.visible !== false);
}
