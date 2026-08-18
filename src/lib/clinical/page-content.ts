import { createClient } from '@/lib/supabase/client';
import { createMediaSignedUrl } from '@/lib/clinical/media-assets';
import { MEDIA_BUCKET, buildCmsStoragePath, detectMediaFileType } from '@/lib/media/schema';
import type { PageContentKey } from '@/lib/page-content/constants';
import {
  pageContentBlockSchema,
  validateCmsImageFile,
  type PageContentBlock,
  type PageContentBlockInput,
} from '@/lib/page-content/schema';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface PageContentBlockRow {
  id: string;
  page_key: PageContentKey;
  block_type: PageContentBlock['blockType'];
  title: string | null;
  subtitle: string | null;
  body: string;
  button_label: string | null;
  button_url: string | null;
  image_asset_id: string | null;
  image_url: string | null;
  icon: string | null;
  sort_order: number;
  is_visible: boolean;
  status: PageContentBlock['status'];
  metadata: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

function mapRow(row: PageContentBlockRow, imageSignedUrl?: string | null): PageContentBlock {
  return {
    id: row.id,
    pageKey: row.page_key,
    blockType: row.block_type,
    title: row.title,
    subtitle: row.subtitle,
    body: row.body ?? '',
    buttonLabel: row.button_label,
    buttonUrl: row.button_url,
    imageAssetId: row.image_asset_id,
    imageUrl: row.image_url,
    icon: row.icon,
    sortOrder: row.sort_order,
    isVisible: row.is_visible,
    status: row.status,
    metadata: row.metadata ?? {},
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    publishedBy: row.published_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    imageSignedUrl,
  };
}

async function resolveImageSignedUrl(block: PageContentBlockRow): Promise<string | null> {
  const path = block.image_url;
  if (!path || path.startsWith('http') || path.startsWith('data:')) {
    return path;
  }
  const { url } = await createMediaSignedUrl(path);
  return url;
}

async function attachSignedUrls(rows: PageContentBlockRow[]): Promise<PageContentBlock[]> {
  return Promise.all(
    rows.map(async (row) => {
      const needsSigned = row.image_url && !row.image_url.startsWith('http') && !row.image_url.startsWith('data:');
      const signed = needsSigned ? await resolveImageSignedUrl(row) : row.image_url;
      return mapRow(row, signed);
    }),
  );
}

function rowFromInput(input: PageContentBlockInput, userId?: string | null) {
  return {
    page_key: input.pageKey,
    block_type: input.blockType,
    title: input.title ?? null,
    subtitle: input.subtitle ?? null,
    body: input.body ?? '',
    button_label: input.buttonLabel ?? null,
    button_url: input.buttonUrl ?? null,
    image_asset_id: input.imageAssetId ?? null,
    image_url: input.imageUrl ?? null,
    icon: input.icon ?? null,
    sort_order: input.sortOrder,
    is_visible: input.isVisible,
    status: input.status,
    metadata: input.metadata ?? {},
    updated_by: userId ?? null,
  };
}

export async function fetchPublishedPageBlocks(
  pageKey: PageContentKey,
): Promise<ClinicalListResult<PageContentBlock>> {
  const result = await runClinicalListQuery('Failed to load page content', async () => {
    const supabase = createClient();
    return supabase
      .from('page_content_blocks')
      .select('*')
      .eq('page_key', pageKey)
      .eq('status', 'published')
      .eq('is_visible', true)
      .is('deleted_at', null)
      .order('sort_order');
  });

  if (result.error) return result;
  const blocks = await attachSignedUrls(result.data as unknown as PageContentBlockRow[]);
  return { data: blocks, error: null };
}

export async function fetchPageBlocksForEditor(
  pageKey: PageContentKey,
): Promise<ClinicalListResult<PageContentBlock>> {
  const result = await runClinicalListQuery('Failed to load page content for editor', async () => {
    const supabase = createClient();
    return supabase
      .from('page_content_blocks')
      .select('*')
      .eq('page_key', pageKey)
      .is('deleted_at', null)
      .order('sort_order');
  });

  if (result.error) return result;
  const blocks = await attachSignedUrls(result.data as unknown as PageContentBlockRow[]);
  return { data: blocks, error: null };
}

export async function savePageContentBlock(
  input: PageContentBlockInput,
  userId: string,
): Promise<ClinicalResult<PageContentBlock>> {
  const parsed = pageContentBlockSchema.safeParse(input);
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? 'Invalid block data' };
  }

  const payload = rowFromInput(parsed.data, userId);
  const supabase = createClient();

  if (parsed.data.id) {
    return runClinicalMutation('Failed to update page content block', async () => {
      return supabase
        .from('page_content_blocks')
        .update(payload)
        .eq('id', parsed.data.id!)
        .is('deleted_at', null)
        .select('*')
        .single();
    }).then(async (result) => {
      if (!result.data) return { data: null, error: result.error };
      const [mapped] = await attachSignedUrls([result.data as unknown as PageContentBlockRow]);
      return { data: mapped, error: null };
    });
  }

  return runClinicalMutation('Failed to create page content block', async () => {
    return supabase
      .from('page_content_blocks')
      .insert({ ...payload, created_by: userId })
      .select('*')
      .single();
  }).then(async (result) => {
    if (!result.data) return { data: null, error: result.error };
    const [mapped] = await attachSignedUrls([result.data as unknown as PageContentBlockRow]);
    return { data: mapped, error: null };
  });
}

export async function publishPageContentBlocks(
  pageKey: PageContentKey,
  userId: string,
): Promise<{ error: string | null }> {
  const now = new Date().toISOString();
  const result = await runClinicalMutation('Failed to publish page content', async () => {
    const supabase = createClient();
    return supabase
      .from('page_content_blocks')
      .update({
        status: 'published',
        published_by: userId,
        published_at: now,
        updated_by: userId,
      })
      .eq('page_key', pageKey)
      .is('deleted_at', null)
      .select('id');
  });

  if (result.error) return { error: result.error };
  return { error: null };
}

export async function reorderPageContentBlocks(
  orderedIds: string[],
  userId: string,
): Promise<{ error: string | null }> {
  const supabase = createClient();
  for (let index = 0; index < orderedIds.length; index += 1) {
    const { error } = await supabase
      .from('page_content_blocks')
      .update({ sort_order: index, updated_by: userId })
      .eq('id', orderedIds[index])
      .is('deleted_at', null);
    if (error) return { error: error.message };
  }
  return { error: null };
}

export async function softDeletePageContentBlock(id: string): Promise<{ error: string | null }> {
  const result = await runClinicalMutation('Failed to delete page content block', async () => {
    const supabase = createClient();
    return supabase
      .from('page_content_blocks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .single();
  });
  return { error: result.error };
}

export async function uploadCmsImage(
  pageKey: PageContentKey,
  file: File,
  userId: string,
): Promise<ClinicalResult<{ storagePath: string; assetId: string | null }>> {
  const validationError = validateCmsImageFile(file);
  if (validationError) return { data: null, error: validationError };

  const assetId = crypto.randomUUID();
  const storagePath = buildCmsStoragePath(pageKey, assetId, file.name);
  const supabase = createClient();

  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, file, { upsert: false, contentType: file.type || undefined });

  if (uploadError) {
    return { data: null, error: `Failed to upload image: ${uploadError.message}` };
  }

  const assetResult = await runClinicalMutation('Failed to register CMS image', async () => {
    return supabase
      .from('media_assets')
      .insert({
        id: assetId,
        name: file.name,
        folder_id: null,
        storage_path: storagePath,
        file_type: detectMediaFileType(file.type),
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        category: 'CMS',
        description: `CMS image for ${pageKey}`,
        uploaded_by: userId,
      })
      .select('id')
      .single();
  });

  return {
    data: {
      storagePath,
      assetId: assetResult.data ? assetId : null,
    },
    error: null,
  };
}

export function getPageMetaBlock(blocks: PageContentBlock[]): PageContentBlock | undefined {
  return blocks.find((block) => block.blockType === 'page_meta');
}

export { buildCmsStoragePath };
