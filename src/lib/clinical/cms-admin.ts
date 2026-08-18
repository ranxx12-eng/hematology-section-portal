import { createClient } from '@/lib/supabase/client';
import { createDefaultCmsAdmin } from '@/lib/cms/defaults';
import type { CmsAdminState } from '@/types/cms-admin';
import type { ContentSection, DashboardImages, LeadershipProfile, Newsletter, PortalContent } from '@/types/portal-content';
import { DEFAULT_DASHBOARD_IMAGES } from '@/lib/portal-content/defaults';
import { runClinicalMutation } from './result';
import {
  fetchContentSections,
  fetchLeadershipProfiles,
  fetchNewsletters,
} from './cms';

const CMS_SETTING_KEYS = {
  pages: 'cms_pages',
  navigation: 'cms_navigation',
  dashboardWidgets: 'cms_dashboard_widgets',
  homepage: 'cms_homepage',
  branding: 'cms_branding',
} as const;

async function fetchSettingValue<T>(key: string, fallback: T): Promise<T> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', key)
      .maybeSingle();
    return (data?.setting_value as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export async function fetchCmsAdminState(): Promise<{ data: CmsAdminState; error: string | null }> {
  const defaults = createDefaultCmsAdmin();
  try {
    const [pages, navigation, dashboardWidgets, homepage, branding] = await Promise.all([
      fetchSettingValue(CMS_SETTING_KEYS.pages, defaults.pages),
      fetchSettingValue(CMS_SETTING_KEYS.navigation, defaults.navigation),
      fetchSettingValue(CMS_SETTING_KEYS.dashboardWidgets, defaults.dashboardWidgets),
      fetchSettingValue(CMS_SETTING_KEYS.homepage, defaults.homepage),
      fetchSettingValue(CMS_SETTING_KEYS.branding, defaults.branding),
    ]);
    return {
      data: { pages, navigation, dashboardWidgets, homepage, branding },
      error: null,
    };
  } catch (err) {
    return {
      data: defaults,
      error: err instanceof Error ? err.message : 'Failed to load CMS admin settings',
    };
  }
}

export async function saveCmsAdminState(state: CmsAdminState): Promise<{ error: string | null }> {
  const entries = [
    { setting_key: CMS_SETTING_KEYS.pages, setting_value: state.pages },
    { setting_key: CMS_SETTING_KEYS.navigation, setting_value: state.navigation },
    { setting_key: CMS_SETTING_KEYS.dashboardWidgets, setting_value: state.dashboardWidgets },
    { setting_key: CMS_SETTING_KEYS.homepage, setting_value: state.homepage },
    { setting_key: CMS_SETTING_KEYS.branding, setting_value: state.branding },
  ];

  try {
    const supabase = createClient();
    for (const entry of entries) {
      const { error } = await supabase
        .from('system_settings')
        .upsert(
          {
            setting_key: entry.setting_key,
            setting_value: entry.setting_value,
            is_public: entry.setting_key === CMS_SETTING_KEYS.branding || entry.setting_key === CMS_SETTING_KEYS.homepage,
          },
          { onConflict: 'setting_key' },
        );
      if (error) return { error: error.message };
    }
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save CMS admin settings' };
  }
}

export async function fetchPortalContentAdmin(): Promise<{ data: PortalContent; error: string | null }> {
  const [leadership, missionVision, newsletters] = await Promise.all([
    fetchLeadershipProfiles(),
    fetchContentSections(),
    fetchNewsletters(),
  ]);

  const dashboardImages = await fetchDashboardImagesMap();
  const error = leadership.error ?? missionVision.error ?? newsletters.error;

  return {
    data: {
      leadership: leadership.data,
      missionVision: missionVision.data,
      newsletters: newsletters.data,
      dashboardImages,
    },
    error,
  };
}

async function fetchDashboardImagesMap(): Promise<DashboardImages> {
  try {
    const supabase = createClient();
    const { data } = await supabase.from('dashboard_images').select('image_key, image_url');
    const map = { ...DEFAULT_DASHBOARD_IMAGES } as DashboardImages;
    (data ?? []).forEach((row) => {
      const key = row.image_key as keyof DashboardImages;
      if (key in map) map[key] = row.image_url;
    });
    return map;
  } catch {
    return { ...DEFAULT_DASHBOARD_IMAGES };
  }
}

export async function savePortalContentAdmin(content: PortalContent): Promise<{ error: string | null }> {
  try {
    const supabase = createClient();

    for (const leader of content.leadership) {
      const { error } = await supabase
        .from('leadership_profiles')
        .update({
          full_name: leader.fullName,
          position: leader.position,
          photo_url: leader.photoUrl,
          biography: leader.biography,
          qualifications: leader.qualifications,
          years_of_experience: leader.yearsOfExperience,
          email: leader.email ?? null,
          phone_extension: leader.phoneExtension ?? null,
          sort_order: leader.sortOrder,
        })
        .eq('id', leader.id);
      if (error) return { error: error.message };
    }

    for (const section of content.missionVision) {
      const { error } = await supabase
        .from('content_sections')
        .update({
          title: section.title,
          content: section.content,
          image_url: section.imageUrl ?? null,
        })
        .eq('id', section.id);
      if (error) return { error: error.message };
    }

    for (const newsletter of content.newsletters) {
      const row = {
        title: newsletter.title,
        cover_image_url: newsletter.coverImageUrl,
        publication_date: newsletter.publicationDate,
        author: newsletter.author,
        description: newsletter.description,
        topic: newsletter.topic,
        pdf_url: newsletter.pdfDataUrl ?? null,
        online_content: newsletter.onlineContent,
        is_pinned: newsletter.isPinned,
        updated_at: new Date().toISOString(),
      };
      const isUuid = /^[0-9a-f-]{36}$/i.test(newsletter.id);
      const { error } = isUuid
        ? await supabase.from('newsletters').update(row).eq('id', newsletter.id)
        : await supabase.from('newsletters').insert(row);
      if (error) return { error: error.message };
    }

    for (const [key, url] of Object.entries(content.dashboardImages)) {
      const { error } = await supabase
        .from('dashboard_images')
        .upsert({ image_key: key, image_url: url }, { onConflict: 'image_key' });
      if (error) return { error: error.message };
    }

    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save portal content' };
  }
}

export async function softDeleteNewsletter(id: string): Promise<{ error: string | null }> {
  const result = await runClinicalMutation('Failed to delete newsletter', async () => {
    const supabase = createClient();
    return supabase
      .from('newsletters')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .single();
  });
  return { error: result.error };
}

export type { LeadershipProfile, ContentSection, Newsletter, PortalContent };
