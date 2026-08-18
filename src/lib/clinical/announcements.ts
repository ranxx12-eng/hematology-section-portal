import { createClient } from '@/lib/supabase/client';
import type { AnnouncementFormData } from '@/lib/announcements/schema';
import type { Announcement } from '@/types/modules';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  status: 'draft' | 'published' | 'archived';
  announcement_type: Announcement['type'];
  priority: Announcement['priority'];
  target_audience: Announcement['targetAudience'];
  starts_at: string | null;
  ends_at: string | null;
  is_pinned: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapAnnouncement(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    title: row.title,
    content: row.body,
    type: row.announcement_type,
    priority: row.priority,
    targetAudience: row.target_audience,
    expiresAt: row.ends_at ?? undefined,
    isPinned: row.is_pinned,
    isPublished: row.status === 'published',
    authorId: row.created_by ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formToInsertRow(form: AnnouncementFormData, userId: string) {
  return {
    title: form.title.trim(),
    body: form.content.trim(),
    status: 'published' as const,
    announcement_type: form.type,
    priority: form.priority,
    target_audience: form.targetAudience,
    ends_at: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`).toISOString() : null,
    is_pinned: form.isPinned,
    created_by: userId,
    updated_by: userId,
  };
}

const ANNOUNCEMENT_SELECT = '*';

export async function fetchAnnouncements(): Promise<ClinicalListResult<Announcement>> {
  return runClinicalListQuery('Failed to load announcements', async () => {
    const supabase = createClient();
    return supabase
      .from('announcements')
      .select(ANNOUNCEMENT_SELECT)
      .is('deleted_at', null)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });
  }).then((result) => ({
    data: (result.data as unknown as AnnouncementRow[]).map(mapAnnouncement),
    error: result.error,
  }));
}

export async function createAnnouncement(
  userId: string,
  form: AnnouncementFormData,
): Promise<ClinicalResult<Announcement>> {
  return runClinicalMutation('Failed to publish announcement', async () => {
    const supabase = createClient();
    return supabase
      .from('announcements')
      .insert(formToInsertRow(form, userId))
      .select(ANNOUNCEMENT_SELECT)
      .single();
  }).then((result) => ({
    data: result.data ? mapAnnouncement(result.data as unknown as AnnouncementRow) : null,
    error: result.error,
  }));
}

export async function updateAnnouncementPinned(
  id: string,
  isPinned: boolean,
  userId: string,
): Promise<ClinicalResult<Announcement>> {
  return runClinicalMutation('Failed to update announcement', async () => {
    const supabase = createClient();
    return supabase
      .from('announcements')
      .update({ is_pinned: isPinned, updated_by: userId })
      .eq('id', id)
      .is('deleted_at', null)
      .select(ANNOUNCEMENT_SELECT)
      .single();
  }).then((result) => ({
    data: result.data ? mapAnnouncement(result.data as unknown as AnnouncementRow) : null,
    error: result.error,
  }));
}

export async function softDeleteAnnouncement(id: string, userId: string): Promise<{ error: string | null }> {
  const result = await runClinicalMutation('Failed to delete announcement', async () => {
    const supabase = createClient();
    return supabase
      .from('announcements')
      .update({ deleted_at: new Date().toISOString(), updated_by: userId })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .single();
  });
  return { error: result.error };
}
