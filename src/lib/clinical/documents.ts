import { createClient } from '@/lib/supabase/client';
import {
  documentBucketForCategory,
  type DocumentFormData,
  type DocumentLibraryItem,
  type DocumentVersionInfo,
} from '@/lib/documents/schema';
import type { Document } from '@/types';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface DocumentRow {
  id: string;
  document_number: string;
  title: string;
  category: string;
  current_version: string;
  effective_date: string;
  review_date: string;
  owner_id: string;
  status: Document['status'];
  revision_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface DocumentVersionRow {
  id: string;
  document_id: string;
  version_number: string;
  file_path: string;
  change_summary: string | null;
  uploaded_at: string;
  is_current: boolean;
}

function mapDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    documentNumber: row.document_number,
    title: row.title,
    category: row.category,
    version: row.current_version,
    effectiveDate: row.effective_date,
    reviewDate: row.review_date,
    ownerId: row.owner_id,
    status: row.status,
    revisionNotes: row.revision_notes ?? undefined,
    createdAt: row.created_at,
  };
}

function mapVersion(row: DocumentVersionRow): DocumentVersionInfo {
  const fileName = row.file_path.split('/').pop() ?? row.file_path;
  return {
    version: row.version_number,
    fileName,
    filePath: row.file_path,
    changeNotes: row.change_summary ?? undefined,
    uploadedAt: row.uploaded_at,
  };
}

function mapLibraryItem(row: DocumentRow, versions: DocumentVersionRow[]): DocumentLibraryItem {
  return {
    id: row.id,
    documentNumber: row.document_number,
    title: row.title,
    category: row.category,
    currentVersion: row.current_version,
    versions: versions.map(mapVersion),
    effectiveDate: row.effective_date,
    expiryDate: row.review_date,
    ownerId: row.owner_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formToInsertRow(form: DocumentFormData, userId: string) {
  const docNumber = form.documentNumber?.trim()
    || `SOP-HEM-${Date.now()}`;
  return {
    document_number: docNumber,
    title: form.title.trim(),
    category: form.category,
    current_version: form.version,
    effective_date: form.effectiveDate,
    review_date: form.reviewDate,
    owner_id: userId,
    status: 'draft' as const,
    created_by: userId,
  };
}

const DOCUMENT_SELECT = '*';

export async function fetchDocuments(): Promise<ClinicalListResult<Document>> {
  return runClinicalListQuery('Failed to load documents', async () => {
    const supabase = createClient();
    return supabase
      .from('documents')
      .select(DOCUMENT_SELECT)
      .is('deleted_at', null)
      .order('title');
  }).then((result) => ({
    data: (result.data as unknown as DocumentRow[]).map(mapDocument),
    error: result.error,
  }));
}

export async function fetchDocumentLibrary(): Promise<ClinicalListResult<DocumentLibraryItem>> {
  return runClinicalListQuery('Failed to load document library', async () => {
    const supabase = createClient();
    return supabase
      .from('documents')
      .select(`
        *,
        document_versions (
          id,
          document_id,
          version_number,
          file_path,
          change_summary,
          uploaded_at,
          is_current
        )
      `)
      .is('deleted_at', null)
      .order('title');
  }).then((result) => {
    const rows = (result.data ?? []) as unknown as (DocumentRow & { document_versions?: DocumentVersionRow[] })[];
    return {
      data: rows.map((row) => mapLibraryItem(row, row.document_versions ?? [])),
      error: result.error,
    };
  });
}

export async function createDocument(
  userId: string,
  form: DocumentFormData,
): Promise<ClinicalResult<Document>> {
  return runClinicalMutation('Failed to create document', async () => {
    const supabase = createClient();
    return supabase
      .from('documents')
      .insert(formToInsertRow(form, userId))
      .select(DOCUMENT_SELECT)
      .single();
  }).then((result) => ({
    data: result.data ? mapDocument(result.data as unknown as DocumentRow) : null,
    error: result.error,
  }));
}

export async function softDeleteDocument(id: string): Promise<{ error: string | null }> {
  const result = await runClinicalMutation('Failed to delete document', async () => {
    const supabase = createClient();
    return supabase
      .from('documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .single();
  });
  return { error: result.error };
}

export async function createDocumentSignedUrl(
  category: string,
  filePath: string,
  expiresIn = 3600,
): Promise<{ url: string | null; error: string | null }> {
  try {
    const supabase = createClient();
    const bucket = documentBucketForCategory(category);
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, expiresIn);
    if (error) return { url: null, error: error.message };
    return { url: data.signedUrl, error: null };
  } catch (err) {
    return {
      url: null,
      error: err instanceof Error ? err.message : 'Failed to create signed URL',
    };
  }
}
