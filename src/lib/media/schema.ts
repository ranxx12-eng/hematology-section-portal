import type { MediaFileType } from '@/types/modules';

export const MEDIA_BUCKET = 'portal-media';

export function detectMediaFileType(mime: string): MediaFileType {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('word') || mime.includes('document')) return 'word';
  if (mime.includes('sheet') || mime.includes('excel')) return 'excel';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'powerpoint';
  if (mime.includes('zip')) return 'zip';
  return 'other';
}

export function buildMediaStoragePath(assetId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `media/${assetId}/${safeName}`;
}

export const ROOT_FOLDER_ID = '00000000-0000-4000-8000-000000000001';
