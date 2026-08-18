import type { Permission } from '@/lib/permissions/roles';
import type { DashboardWidgetType } from '@/types/modules';

export type PageStatus = 'draft' | 'published';
export type ContentBlockType = 'hero' | 'text' | 'image' | 'stats' | 'columns' | 'cta' | 'html';

export interface ContentBlock {
  id: string;
  type: ContentBlockType;
  label: string;
  content: string;
  imageUrl?: string;
  sortOrder: number;
}

export interface CmsPage {
  id: string;
  title: string;
  slug: string;
  moduleKey: string;
  status: PageStatus;
  isVisible: boolean;
  blocks: ContentBlock[];
  createdAt: string;
  updatedAt: string;
}

export interface NavItemConfig {
  id: string;
  href: string;
  labelKey: string;
  icon: string;
  permission?: Permission;
  permissions?: Permission[];
  visible: boolean;
  sortOrder: number;
  parentId?: string;
}

export interface NavGroupConfig {
  id: string;
  labelKey: string;
  icon: string;
  sortOrder: number;
  visible: boolean;
  items: NavItemConfig[];
}

export interface DashboardWidgetConfig {
  type: DashboardWidgetType;
  enabled: boolean;
  sortOrder: number;
}

export interface HomepageConfig {
  heroTitle: string;
  heroSubtitle: string;
  showSpecialtyBadges: boolean;
  specialtyBadges: string[];
  showPhotoGallery: boolean;
}

export interface BrandingConfig {
  appTitle: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

export interface CmsAdminState {
  pages: CmsPage[];
  navigation: NavGroupConfig[];
  dashboardWidgets: DashboardWidgetConfig[];
  homepage: HomepageConfig;
  branding: BrandingConfig;
}
