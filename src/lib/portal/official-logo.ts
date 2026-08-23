import { FALLBACK_LOGO_SRC, type OfficialLogoResolution } from '@/lib/portal/official-logo.constants';

export { FALLBACK_LOGO_SRC };
export type { OfficialLogoResolution };

export async function fetchOfficialLogoResolution(): Promise<OfficialLogoResolution> {
  try {
    const response = await fetch('/api/portal/official-logo', { cache: 'no-store' });
    if (!response.ok) {
      return fallbackResolution();
    }
    return (await response.json()) as OfficialLogoResolution;
  } catch {
    return fallbackResolution();
  }
}

export function fallbackResolution(): OfficialLogoResolution {
  return {
    url: FALLBACK_LOGO_SRC,
    assetId: null,
    assetName: null,
    storagePath: null,
    mimeType: 'image/svg+xml',
    source: 'fallback',
  };
}

export async function loadOfficialLogoDataUrl(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const resolution = await fetchOfficialLogoResolution();
  return imageUrlToDataUrl(resolution.url, resolution.mimeType);
}

export async function imageUrlToDataUrl(
  url: string,
  mimeType: string | null,
): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const contentType = mimeType || response.headers.get('content-type') || 'image/png';
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 120;
        canvas.height = img.naturalHeight || 120;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL(contentType.startsWith('image/') ? 'image/png' : 'image/png'));
        } else {
          resolve(null);
        }
        URL.revokeObjectURL(objectUrl);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      img.src = objectUrl;
    });
  } catch {
    return null;
  }
}

export interface PdfLogoDimensions {
  width: number;
  height: number;
  format: 'PNG' | 'JPEG' | 'WEBP';
}

export async function loadOfficialLogoForPdf(): Promise<{
  dataUrl: string | null;
  dimensions: PdfLogoDimensions | null;
}> {
  const dataUrl = await loadOfficialLogoDataUrl();
  if (!dataUrl) {
    return { dataUrl: null, dimensions: null };
  }

  const dimensions = await measureDataUrlDimensions(dataUrl);
  return { dataUrl, dimensions };
}

function measureDataUrlDimensions(dataUrl: string): Promise<PdfLogoDimensions | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxHeight = 16;
      const naturalWidth = img.naturalWidth || maxHeight;
      const naturalHeight = img.naturalHeight || maxHeight;
      const scale = maxHeight / naturalHeight;
      resolve({
        width: naturalWidth * scale,
        height: maxHeight,
        format: 'PNG',
      });
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
