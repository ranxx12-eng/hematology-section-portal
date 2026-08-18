import { createClient } from '@/lib/supabase/client';
import {
  MEDIA_BUCKET,
  ROOT_FOLDER_ID,
  buildMediaStoragePath,
  detectMediaFileType,
} from '@/lib/media/schema';
import type { MediaAsset, MediaFolder } from '@/types/modules';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface MediaFolderRow {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

interface MediaAssetRow {
  id: string;
  name: string;
  folder_id: string | null;
  storage_path: string;
  file_type: MediaAsset['fileType'];
  mime_type: string;
  size_bytes: number;
  tags: string[];
  category: string;
  usage_count: number;
  usage_locations: string[];
  uploaded_by: string | null;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
}

function mapMediaFolder(row: MediaFolderRow): MediaFolder {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id ?? undefined,
    createdAt: row.created_at,
  };
}

function mapMediaAsset(row: MediaAssetRow, previewUrl?: string): MediaAsset {
  return {
    id: row.id,
    name: row.name,
    folderId: row.folder_id ?? undefined,
    fileType: row.file_type,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    tags: row.tags ?? [],
    category: row.category,
    dataUrl: previewUrl,
    usageCount: row.usage_count,
    usageLocations: row.usage_locations ?? [],
    uploadedBy: row.uploaded_by ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function attachSignedUrls(assets: MediaAssetRow[]): Promise<MediaAsset[]> {
  const supabase = createClient();
  return Promise.all(
    assets.map(async (row) => {
      if (row.file_type !== 'image') {
        return mapMediaAsset(row);
      }
      const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(row.storage_path, 3600);
      return mapMediaAsset(row, data?.signedUrl);
    }),
  );
}

export async function fetchMediaFolders(): Promise<ClinicalListResult<MediaFolder>> {
  return runClinicalListQuery('Failed to load media folders', async () => {
    const supabase = createClient();
    return supabase
      .from('media_folders')
      .select('*')
      .is('deleted_at', null)
      .order('name');
  }).then(async (result) => ({
    data: (result.data as unknown as MediaFolderRow[]).map(mapMediaFolder),
    error: result.error,
  }));
}

export async function fetchMediaAssets(): Promise<ClinicalListResult<MediaAsset>> {
  const result = await runClinicalListQuery('Failed to load media assets', async () => {
    const supabase = createClient();
    return supabase
      .from('media_assets')
      .select('*')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
  });

  if (result.error) {
    return { data: [], error: result.error };
  }

  const assets = await attachSignedUrls(result.data as unknown as MediaAssetRow[]);
  return { data: assets, error: null };
}

export async function uploadMediaAsset(
  userId: string,
  file: File,
  folderId: string | null,
): Promise<ClinicalResult<MediaAsset>> {
  const assetId = crypto.randomUUID();
  const storagePath = buildMediaStoragePath(assetId, file.name);
  const supabase = createClient();

  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, file, { upsert: false, contentType: file.type || undefined });

  if (uploadError) {
    return { data: null, error: `Failed to upload file: ${uploadError.message}` };
  }

  const normalizedFolderId = folderId && folderId !== ROOT_FOLDER_ID ? folderId : null;

  return runClinicalMutation('Failed to save media asset', async () => {
    return supabase
      .from('media_assets')
      .insert({
        id: assetId,
        name: file.name,
        folder_id: normalizedFolderId,
        storage_path: storagePath,
        file_type: detectMediaFileType(file.type),
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        category: 'General',
        uploaded_by: userId,
      })
      .select('*')
      .single();
  }).then(async (result) => {
    if (!result.data) return { data: null, error: result.error };
    const [mapped] = await attachSignedUrls([result.data as unknown as MediaAssetRow]);
    return { data: mapped, error: result.error };
  });
}

export async function renameMediaAsset(id: string, name: string): Promise<ClinicalResult<MediaAsset>> {
  return runClinicalMutation('Failed to rename media asset', async () => {
    const supabase = createClient();
    return supabase
      .from('media_assets')
      .update({ name: name.trim() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('*')
      .single();
  }).then(async (result) => {
    if (!result.data) return { data: null, error: result.error };
    const [mapped] = await attachSignedUrls([result.data as unknown as MediaAssetRow]);
    return { data: mapped, error: result.error };
  });
}

export async function replaceMediaAssetFile(
  id: string,
  file: File,
): Promise<ClinicalResult<MediaAsset>> {
  const supabase = createClient();
  const { data: existing, error: fetchError } = await supabase
    .from('media_assets')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !existing) {
    return { data: null, error: fetchError?.message ?? 'Asset not found' };
  }

  const storagePath = buildMediaStoragePath(id, file.name);
  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, file, { upsert: true, contentType: file.type || undefined });

  if (uploadError) {
    return { data: null, error: `Failed to replace file: ${uploadError.message}` };
  }

  return runClinicalMutation('Failed to update media asset', async () => {
    return supabase
      .from('media_assets')
      .update({
        name: file.name,
        storage_path: storagePath,
        mime_type: file.type || 'application/octet-stream',
        file_type: detectMediaFileType(file.type),
        size_bytes: file.size,
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select('*')
      .single();
  }).then(async (result) => {
    if (!result.data) return { data: null, error: result.error };
    const [mapped] = await attachSignedUrls([result.data as unknown as MediaAssetRow]);
    return { data: mapped, error: result.error };
  });
}

export async function softDeleteMediaAsset(id: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from('media_assets')
    .select('storage_path')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  const result = await runClinicalMutation('Failed to delete media asset', async () => {
    return supabase
      .from('media_assets')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .single();
  });

  if (!result.error && existing?.storage_path) {
    await supabase.storage.from(MEDIA_BUCKET).remove([existing.storage_path]);
  }

  return { error: result.error };
}

export async function createMediaSignedUrl(
  storagePath: string,
  expiresIn = 3600,
): Promise<{ url: string | null; error: string | null }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(storagePath, expiresIn);
    if (error) return { url: null, error: error.message };
    return { url: data.signedUrl, error: null };
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : 'Failed to create signed URL' };
  }
}

export { ROOT_FOLDER_ID };
