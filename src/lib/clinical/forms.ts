import { createClient } from '@/lib/supabase/client';
import type { DynamicFormInput } from '@/lib/forms/schema';
import type { DynamicForm, FormField, FormResponse } from '@/types/modules';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface FormFieldRow {
  id: string;
  form_id: string;
  field_order: number;
  label: string;
  field_type: FormField['type'];
  required: boolean;
  options: string[] | null;
  placeholder: string | null;
}

interface DynamicFormRow {
  id: string;
  title: string;
  description: string | null;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  form_fields?: FormFieldRow[];
}

interface FormSubmissionRow {
  id: string;
  form_id: string;
  submitted_by: string | null;
  answers: Record<string, string | string[] | boolean>;
  submitted_at: string;
}

function mapFormField(row: FormFieldRow): FormField {
  return {
    id: row.id,
    label: row.label,
    type: row.field_type,
    required: row.required,
    options: row.options ?? undefined,
    placeholder: row.placeholder ?? undefined,
  };
}

function mapDynamicForm(row: DynamicFormRow): DynamicForm {
  const fields = (row.form_fields ?? [])
    .sort((a, b) => a.field_order - b.field_order)
    .map(mapFormField);

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    fields,
    isPublished: row.is_published,
    createdBy: row.created_by ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFormResponse(row: FormSubmissionRow): FormResponse {
  return {
    id: row.id,
    formId: row.form_id,
    submittedBy: row.submitted_by ?? '',
    answers: row.answers ?? {},
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
    field_type,
    required,
    options,
    placeholder
  )
`;

async function syncFormFields(formId: string, fields: FormField[]): Promise<string | null> {
  const supabase = createClient();
  const { error: clearError } = await supabase
    .from('form_fields')
    .update({ deleted_at: new Date().toISOString() })
    .eq('form_id', formId)
    .is('deleted_at', null);

  if (clearError) return clearError.message;

  if (fields.length === 0) return null;

  const rows = fields.map((field, index) => ({
    id: field.id.match(/^[0-9a-f-]{36}$/i) ? field.id : crypto.randomUUID(),
    form_id: formId,
    field_order: index,
    label: field.label,
    field_type: field.type,
    required: field.required,
    options: field.options ?? null,
    placeholder: field.placeholder ?? null,
    deleted_at: null,
  }));

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
        title: input.title.trim(),
        description: input.description?.trim() || null,
        is_published: input.isPublished,
        created_by: userId,
        updated_by: userId,
      })
      .select('*')
      .single();
  });

  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }

  const formRow = result.data as unknown as DynamicFormRow;
  const syncError = await syncFormFields(formRow.id, input.fields.map((f) => ({
    id: crypto.randomUUID(),
    label: f.label,
    type: f.type,
    required: f.required,
    options: f.options,
    placeholder: f.placeholder,
  })));

  if (syncError) return { data: null, error: syncError };

  const refreshed = await fetchDynamicForms();
  const created = refreshed.data.find((f) => f.id === formRow.id) ?? null;
  return { data: created, error: refreshed.error };
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
      .update({
        title: input.title.trim(),
        description: input.description?.trim() || null,
        is_published: input.isPublished,
        updated_by: userId,
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select('*')
      .single();
  });

  if (result.error) return { data: null, error: result.error };

  const syncError = await syncFormFields(id, input.fields.map((f) => ({
    id: f.id ?? crypto.randomUUID(),
    label: f.label,
    type: f.type,
    required: f.required,
    options: f.options,
    placeholder: f.placeholder,
  })));

  if (syncError) return { data: null, error: syncError };

  const refreshed = await fetchDynamicForms();
  const updated = refreshed.data.find((f) => f.id === id) ?? null;
  return { data: updated, error: refreshed.error };
}

export async function softDeleteDynamicForm(id: string, userId: string): Promise<{ error: string | null }> {
  const result = await runClinicalMutation('Failed to delete form', async () => {
    const supabase = createClient();
    return supabase
      .from('dynamic_forms')
      .update({ deleted_at: new Date().toISOString(), updated_by: userId })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .single();
  });
  return { error: result.error };
}
