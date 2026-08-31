import type { Permission } from '@/lib/permissions/roles';

export const PAGE_CONTENT_KEYS = [
  'dashboard',
  'critical_values',
  'sample_rejections',
  'quality_control',
  'maintenance',
  'environmental_monitoring',
] as const;

export type PageContentKey = (typeof PAGE_CONTENT_KEYS)[number];

export const PAGE_CONTENT_BLOCK_TYPES = [
  'page_meta',
  'hero',
  'text_block',
  'image_block',
  'quick_link',
  'notice',
  'banner',
  'info_text',
] as const;

export type PageContentBlockType = (typeof PAGE_CONTENT_BLOCK_TYPES)[number];

export const PAGE_CONTENT_STATUSES = ['draft', 'published'] as const;

export type PageContentStatus = (typeof PAGE_CONTENT_STATUSES)[number];

export const PAGE_CONTENT_LABELS: Record<PageContentKey, { en: string; ar: string }> = {
  dashboard: { en: 'Dashboard', ar: 'لوحة التحكم' },
  critical_values: { en: 'Critical Values', ar: 'القيم الحرجة' },
  sample_rejections: { en: 'Sample Rejections', ar: 'رفض العينات' },
  quality_control: { en: 'Quality Control', ar: 'مراقبة الجودة' },
  maintenance: { en: 'Maintenance', ar: 'الصيانة' },
  environmental_monitoring: { en: 'Environmental Monitoring', ar: 'المراقبة البيئية' },
};

export const BLOCK_TYPE_LABELS: Record<PageContentBlockType, string> = {
  page_meta: 'Page Title & Intro',
  hero: 'Hero / Welcome Banner',
  text_block: 'Text Block',
  image_block: 'Image Block',
  quick_link: 'Quick Link',
  notice: 'Notice / Announcement',
  banner: 'Banner Image',
  info_text: 'Informational Text',
};

export const DASHBOARD_BLOCK_TYPES: PageContentBlockType[] = [
  'hero',
  'text_block',
  'image_block',
  'quick_link',
  'notice',
];

export const CLINICAL_BLOCK_TYPES: PageContentBlockType[] = [
  'page_meta',
  'banner',
  'info_text',
  'notice',
];

export const CMS_MANAGE_PERMISSIONS: Permission[] = ['cms.manage', 'settings.manage'];

export function canManagePageContent(can: (permission: Permission) => boolean): boolean {
  return CMS_MANAGE_PERMISSIONS.some((permission) => can(permission));
}

export function pageAllowsBlockType(pageKey: PageContentKey, blockType: PageContentBlockType): boolean {
  if (blockType === 'page_meta') return true;
  if (pageKey === 'dashboard') {
    return DASHBOARD_BLOCK_TYPES.includes(blockType);
  }
  return (['banner', 'info_text', 'notice'] as PageContentBlockType[]).includes(blockType);
}
