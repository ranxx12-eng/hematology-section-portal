import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { MEDIA_BUCKET } from '@/lib/media/schema';
import { hasSupabaseConfig } from '@/lib/security/env';
import {
  FALLBACK_LOGO_SRC,
  getConfiguredLogoAssetId,
  getConfiguredLogoStoragePath,
  type OfficialLogoResolution,
} from '@/lib/portal/official-logo.constants';

interface MediaAssetRow {
  id: string;
  name: string;
  storage_path: string;
  mime_type: string;
  category: string;
  tags: string[];
  usage_count: number;
  file_type: string;
}

const LOGO_URL_TTL_SECONDS = 3600;

function scoreLogoAsset(asset: Pick<MediaAssetRow, 'name' | 'category' | 'tags' | 'file_type'>): number {
  const nameLower = asset.name.toLowerCase();

  if (nameLower === 'hospital logo') return 100;
  if (nameLower.includes('official') && nameLower.includes('logo')) return 90;
  if (asset.category === 'Branding' && asset.tags.some((tag) => tag.toLowerCase() === 'logo')) return 80;
  if (asset.category === 'Branding' && nameLower.includes('logo')) return 70;
  if (nameLower.includes('hospital') && nameLower.includes('logo')) return 60;
  if (nameLower.includes('logo') && asset.file_type === 'image') return 40;

  return 0;
}

async function signStoragePath(storagePath: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(storagePath, LOGO_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

async function resolveAssetRow(
  admin: ReturnType<typeof createAdminClient>,
): Promise<MediaAssetRow | null> {
  const configuredId = getConfiguredLogoAssetId();
  if (configuredId) {
    const { data } = await admin
      .from('media_assets')
      .select('id, name, storage_path, mime_type, category, tags, usage_count, file_type')
      .eq('id', configuredId)
      .is('deleted_at', null)
      .maybeSingle();

    if (data) return data as MediaAssetRow;
  }

  const configuredPath = getConfiguredLogoStoragePath();
  if (configuredPath) {
    const { data } = await admin
      .from('media_assets')
      .select('id, name, storage_path, mime_type, category, tags, usage_count, file_type')
      .eq('storage_path', configuredPath)
      .is('deleted_at', null)
      .maybeSingle();

    if (data) return data as MediaAssetRow;

    return {
      id: configuredId ?? 'configured-path',
      name: 'Configured Hospital Logo',
      storage_path: configuredPath,
      mime_type: 'image/png',
      category: 'Branding',
      tags: ['logo'],
      usage_count: 0,
      file_type: 'image',
    };
  }

  const { data } = await admin
    .from('media_assets')
    .select('id, name, storage_path, mime_type, category, tags, usage_count, file_type')
    .is('deleted_at', null)
    .eq('file_type', 'image');

  const candidates = ((data ?? []) as MediaAssetRow[])
    .map((asset) => ({ asset, score: scoreLogoAsset(asset) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.asset.usage_count !== a.asset.usage_count) {
        return b.asset.usage_count - a.asset.usage_count;
      }
      return a.asset.name.localeCompare(b.asset.name);
    });

  return candidates[0]?.asset ?? null;
}

export async function resolveOfficialLogo(): Promise<OfficialLogoResolution> {
  if (!hasSupabaseConfig()) {
    return {
      url: FALLBACK_LOGO_SRC,
      assetId: null,
      assetName: null,
      storagePath: null,
      mimeType: 'image/svg+xml',
      source: 'fallback',
    };
  }

  try {
    const admin = createAdminClient();
    const asset = await resolveAssetRow(admin);

    if (!asset) {
      return {
        url: FALLBACK_LOGO_SRC,
        assetId: null,
        assetName: null,
        storagePath: null,
        mimeType: 'image/svg+xml',
        source: 'fallback',
      };
    }

    const signedUrl = await signStoragePath(asset.storage_path);
    if (!signedUrl) {
      return {
        url: FALLBACK_LOGO_SRC,
        assetId: asset.id,
        assetName: asset.name,
        storagePath: asset.storage_path,
        mimeType: asset.mime_type,
        source: 'fallback',
      };
    }

    const source = getConfiguredLogoAssetId()
      ? 'asset_id'
      : getConfiguredLogoStoragePath()
        ? 'storage_path'
        : 'media_library';

    return {
      url: signedUrl,
      assetId: asset.id,
      assetName: asset.name,
      storagePath: asset.storage_path,
      mimeType: asset.mime_type,
      source,
    };
  } catch {
    return {
      url: FALLBACK_LOGO_SRC,
      assetId: null,
      assetName: null,
      storagePath: null,
      mimeType: 'image/svg+xml',
      source: 'fallback',
    };
  }
}
