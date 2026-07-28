import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export const emailSchema = z.string().email().max(320);

export const isoDateSchema = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export function validateUpload(file: { type: string; size: number; name: string }): string | null {
  if (file.size > MAX_UPLOAD_BYTES) return 'File exceeds maximum size of 10 MB.';
  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.type as (typeof ALLOWED_UPLOAD_MIME_TYPES)[number])) {
    return 'File type is not allowed.';
  }
  const ext = file.name.split('.').pop()?.toLowerCase();
  const allowedExt = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'xls', 'xlsx'];
  if (!ext || !allowedExt.includes(ext)) return 'File extension is not allowed.';
  return null;
}

export function getSafeExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  };
  return map[mimeType] ?? 'bin';
}
