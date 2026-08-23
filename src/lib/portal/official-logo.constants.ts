/** Static fallback when Media Library logo cannot be resolved. */
export const FALLBACK_LOGO_SRC = '/images/portal/hospital-logo.svg';

/**
 * Optional stable media_assets.id override.
 * Set NEXT_PUBLIC_OFFICIAL_LOGO_ASSET_ID (client-readable) or OFFICIAL_LOGO_ASSET_ID (server-only).
 */
export function getConfiguredLogoAssetId(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_OFFICIAL_LOGO_ASSET_ID?.trim()
    || process.env.OFFICIAL_LOGO_ASSET_ID?.trim()
    || undefined
  );
}

/**
 * Optional portal-media storage path override, e.g. media/{uuid}/Hospital_Logo.png
 * Set OFFICIAL_LOGO_STORAGE_PATH on the server when the asset id is not yet known.
 */
export function getConfiguredLogoStoragePath(): string | undefined {
  return process.env.OFFICIAL_LOGO_STORAGE_PATH?.trim() || undefined;
}

export interface OfficialLogoResolution {
  url: string;
  assetId: string | null;
  assetName: string | null;
  storagePath: string | null;
  mimeType: string | null;
  source: 'asset_id' | 'storage_path' | 'media_library' | 'fallback';
}
