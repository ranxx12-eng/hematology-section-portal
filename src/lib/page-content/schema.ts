import { z } from 'zod';
import {
  PAGE_CONTENT_BLOCK_TYPES,
  PAGE_CONTENT_KEYS,
  PAGE_CONTENT_STATUSES,
  type PageContentBlockType,
  type PageContentKey,
} from './constants';

export const CMS_ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const CMS_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const pageContentBlockSchema = z.object({
  id: z.string().uuid().optional(),
  pageKey: z.enum(PAGE_CONTENT_KEYS),
  blockType: z.enum(PAGE_CONTENT_BLOCK_TYPES),
  title: z.string().max(200).nullable().optional(),
  subtitle: z.string().max(300).nullable().optional(),
  body: z.string().max(10000).optional().default(''),
  buttonLabel: z.string().max(100).nullable().optional(),
  buttonUrl: z.string().max(500).nullable().optional(),
  imageAssetId: z.string().uuid().nullable().optional(),
  imageUrl: z.string().max(1000).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999),
  isVisible: z.boolean(),
  status: z.enum(PAGE_CONTENT_STATUSES),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export type PageContentBlockInput = z.infer<typeof pageContentBlockSchema>;

export interface PageContentBlock extends PageContentBlockInput {
  id: string;
  imageSignedUrl?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  publishedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
}

export function validateCmsImageFile(file: File): string | null {
  if (!CMS_ALLOWED_IMAGE_TYPES.includes(file.type as (typeof CMS_ALLOWED_IMAGE_TYPES)[number])) {
    return 'Only JPEG, PNG, and WebP images are allowed';
  }
  if (file.size > CMS_MAX_IMAGE_BYTES) {
    return 'Image must be 10 MB or smaller';
  }
  return null;
}

export function createEmptyBlock(
  pageKey: PageContentKey,
  blockType: PageContentBlockType,
  sortOrder: number,
): PageContentBlockInput {
  return {
    pageKey,
    blockType,
    title: blockType === 'page_meta' ? '' : blockType === 'notice' ? 'Notice' : '',
    subtitle: '',
    body: '',
    buttonLabel: '',
    buttonUrl: '',
    imageAssetId: null,
    imageUrl: null,
    icon: '',
    sortOrder,
    isVisible: true,
    status: 'draft',
    metadata: {},
  };
}
