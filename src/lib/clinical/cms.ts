import { createClient } from '@/lib/supabase/client';
import type { ContentSection, LeadershipProfile, Newsletter } from '@/types/portal-content';
import { runClinicalListQuery, type ClinicalListResult } from './result';

export async function fetchLeadershipProfiles(): Promise<ClinicalListResult<LeadershipProfile>> {
  return runClinicalListQuery('Failed to load leadership profiles', async () => {
    const supabase = createClient();
    return supabase
      .from('leadership_profiles')
      .select('*')
      .order('sort_order');
  }).then((result) => ({
    data: (result.data ?? []).map((row) => ({
      id: row.id,
      roleKey: row.role_key as LeadershipProfile['roleKey'],
      fullName: row.full_name,
      position: row.position,
      photoUrl: row.photo_url ?? '/images/portal/hematology-lab.svg',
      biography: row.biography,
      qualifications: row.qualifications,
      yearsOfExperience: row.years_of_experience,
      email: row.email ?? undefined,
      phoneExtension: row.phone_extension ?? undefined,
      sortOrder: row.sort_order,
    })),
    error: result.error,
  }));
}

export async function fetchContentSections(): Promise<ClinicalListResult<ContentSection>> {
  return runClinicalListQuery('Failed to load content sections', async () => {
    const supabase = createClient();
    return supabase.from('content_sections').select('*').order('section_key');
  }).then((result) => ({
    data: (result.data ?? []).map((row) => ({
      id: row.id,
      sectionKey: row.section_key as ContentSection['sectionKey'],
      title: row.title,
      content: row.content,
      imageUrl: row.image_url ?? undefined,
      updatedAt: row.updated_at,
    })),
    error: result.error,
  }));
}

export async function fetchNewsletters(): Promise<ClinicalListResult<Newsletter>> {
  return runClinicalListQuery('Failed to load newsletters', async () => {
    const supabase = createClient();
    return supabase
      .from('newsletters')
      .select('*')
      .is('deleted_at', null)
      .order('publication_date', { ascending: false });
  }).then((result) => ({
    data: (result.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      coverImageUrl: row.cover_image_url ?? '/images/portal/hematology-lab.svg',
      publicationDate: row.publication_date,
      author: row.author,
      description: row.description,
      topic: row.topic,
      pdfDataUrl: row.pdf_url ?? undefined,
      onlineContent: row.online_content,
      isPinned: row.is_pinned,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    error: result.error,
  }));
}
