import {
  OFFICIAL_HOSPITAL_LOGO_MIME_TYPE,
  OFFICIAL_HOSPITAL_LOGO_SRC,
  getOfficialLogoResolution,
  type OfficialLogoResolution,
} from '@/lib/portal/official-logo.constants';

export {
  OFFICIAL_HOSPITAL_LOGO_MIME_TYPE,
  OFFICIAL_HOSPITAL_LOGO_SRC,
  getOfficialLogoResolution,
};
export type { OfficialLogoResolution };

export function fetchOfficialLogoResolution(): Promise<OfficialLogoResolution> {
  return Promise.resolve(getOfficialLogoResolution());
}

export async function loadOfficialLogoDataUrl(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  return imageUrlToDataUrl(OFFICIAL_HOSPITAL_LOGO_SRC, OFFICIAL_HOSPITAL_LOGO_MIME_TYPE);
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
