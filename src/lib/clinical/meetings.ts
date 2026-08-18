import { createClient } from '@/lib/supabase/client';
import type { MeetingFormData } from '@/lib/meetings/schema';
import type { Meeting } from '@/types';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface MeetingRow {
  id: string;
  title: string;
  meeting_date: string;
  meeting_time: string;
  location: string;
  organizer_id: string;
  agenda: string;
  discussion: string | null;
  decisions: string | null;
  minutes_approved: boolean;
  created_at: string;
}

function mapMeeting(row: MeetingRow): Meeting {
  return {
    id: row.id,
    title: row.title,
    date: row.meeting_date,
    time: row.meeting_time.slice(0, 5),
    location: row.location,
    organizerId: row.organizer_id,
    agenda: row.agenda,
    discussion: row.discussion ?? undefined,
    decisions: row.decisions ?? undefined,
    minutesApproved: row.minutes_approved,
    createdAt: row.created_at,
  };
}

function formToInsertRow(form: MeetingFormData, userId: string) {
  return {
    title: form.title.trim(),
    meeting_date: form.date,
    meeting_time: form.time,
    location: form.location.trim(),
    organizer_id: userId,
    agenda: form.agenda.trim(),
    created_by: userId,
  };
}

const MEETING_SELECT = '*';

export async function fetchMeetings(): Promise<ClinicalListResult<Meeting>> {
  return runClinicalListQuery('Failed to load meetings', async () => {
    const supabase = createClient();
    return supabase
      .from('meetings')
      .select(MEETING_SELECT)
      .is('deleted_at', null)
      .order('meeting_date', { ascending: false });
  }).then((result) => ({
    data: (result.data as unknown as MeetingRow[]).map(mapMeeting),
    error: result.error,
  }));
}

export async function createMeeting(
  userId: string,
  form: MeetingFormData,
): Promise<ClinicalResult<Meeting>> {
  return runClinicalMutation('Failed to create meeting', async () => {
    const supabase = createClient();
    return supabase
      .from('meetings')
      .insert(formToInsertRow(form, userId))
      .select(MEETING_SELECT)
      .single();
  }).then((result) => ({
    data: result.data ? mapMeeting(result.data as unknown as MeetingRow) : null,
    error: result.error,
  }));
}

export async function softDeleteMeeting(id: string): Promise<{ error: string | null }> {
  const result = await runClinicalMutation('Failed to delete meeting', async () => {
    const supabase = createClient();
    return supabase
      .from('meetings')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .single();
  });
  return { error: result.error };
}
