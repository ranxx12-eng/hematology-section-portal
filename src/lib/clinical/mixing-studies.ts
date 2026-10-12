import { createClient } from '@/lib/supabase/client';
import type { MixingTestSelection } from '@/lib/medical-reports/form-hema-023/constants';
import type { MixingStudyDraftInput } from '@/lib/medical-reports/form-hema-023/validation';
import { buildMixingStudyPayload } from '@/lib/medical-reports/form-hema-023/validation';
import type { ClinicalListResult, ClinicalResult } from '@/lib/clinical/result';
import type { MixingStudy, MixingStudyListItem } from '@/types/mixing-study';

function asStudy(value: unknown): MixingStudy | null {
  if (!value || typeof value !== 'object') return null;
  return value as MixingStudy;
}

function asList(value: unknown): MixingStudyListItem[] {
  return Array.isArray(value) ? value as MixingStudyListItem[] : [];
}

export async function fetchMixingStudies(query?: string): Promise<ClinicalListResult<MixingStudyListItem>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('list_mixing_studies', {
      p_query: query?.trim() ? query.trim() : null,
    });
    if (error) return { data: [], error: error.message };
    return { data: asList(data), error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : 'Unable to load mixing studies' };
  }
}

export async function fetchMixingStudy(id: string): Promise<ClinicalResult<MixingStudy>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('get_mixing_study', { p_study_id: id });
    if (error) return { data: null, error: error.message };
    return { data: asStudy(data), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unable to load mixing study' };
  }
}

export async function createMixingStudy(testSelection: MixingTestSelection = 'both'): Promise<ClinicalResult<MixingStudy>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('create_mixing_study', {
      p_test_selection: testSelection,
    });
    if (error) return { data: null, error: error.message };
    return { data: asStudy(data), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unable to create mixing study' };
  }
}

async function perform(
  id: string,
  action: 'save_draft' | 'submit' | 'request_changes' | 'review',
  payload: Record<string, unknown>,
): Promise<ClinicalResult<MixingStudy>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('perform_mixing_study_action', {
      p_study_id: id,
      p_action: action,
      p_payload: payload,
    });
    if (error) return { data: null, error: error.message };
    return { data: asStudy(data), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unable to update mixing study' };
  }
}

export function saveMixingStudyDraft(id: string, input: MixingStudyDraftInput) {
  return perform(id, 'save_draft', buildMixingStudyPayload(input));
}

export function submitMixingStudy(id: string, input: MixingStudyDraftInput) {
  return perform(id, 'submit', buildMixingStudyPayload(input));
}

export function reviewMixingStudy(id: string, reviewComment: string) {
  return perform(id, 'review', { reviewComment });
}

export function requestMixingStudyChanges(id: string, reviewComment: string) {
  return perform(id, 'request_changes', { reviewComment });
}

export async function recordMixingStudyPdfExport(id: string): Promise<string | null> {
  try {
    const supabase = createClient();
    const { error } = await supabase.rpc('record_mixing_study_pdf_export', { p_study_id: id });
    return error?.message ?? null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Unable to record PDF export';
  }
}
