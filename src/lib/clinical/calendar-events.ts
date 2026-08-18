import { createClient } from '@/lib/supabase/client';
import type { CalendarEventFormData } from '@/lib/calendar/schema';
import type { CalendarEvent } from '@/types/modules';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface CalendarEventRow {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  event_type: CalendarEvent['type'];
  location: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
}

function mapCalendarEvent(row: CalendarEventRow): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    type: row.event_type,
    startDate: row.starts_at,
    endDate: row.ends_at,
    allDay: row.all_day,
    location: row.location ?? undefined,
    description: row.description ?? undefined,
    assignedTo: row.assigned_to ?? undefined,
    createdBy: row.created_by ?? '',
    createdAt: row.created_at,
  };
}

function formToInsertRow(form: CalendarEventFormData, userId: string) {
  const start = new Date(form.startDate);
  const end = new Date(form.endDate || form.startDate);
  return {
    title: form.title.trim(),
    description: form.description?.trim() || null,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    all_day: false,
    event_type: form.type,
    location: form.location?.trim() || null,
    created_by: userId,
    updated_by: userId,
  };
}

const CALENDAR_SELECT = '*';

export async function fetchCalendarEvents(): Promise<ClinicalListResult<CalendarEvent>> {
  return runClinicalListQuery('Failed to load calendar events', async () => {
    const supabase = createClient();
    return supabase
      .from('calendar_events')
      .select(CALENDAR_SELECT)
      .is('deleted_at', null)
      .order('starts_at', { ascending: true });
  }).then((result) => ({
    data: (result.data as unknown as CalendarEventRow[]).map(mapCalendarEvent),
    error: result.error,
  }));
}

export async function createCalendarEvent(
  userId: string,
  form: CalendarEventFormData,
): Promise<ClinicalResult<CalendarEvent>> {
  return runClinicalMutation('Failed to create calendar event', async () => {
    const supabase = createClient();
    return supabase
      .from('calendar_events')
      .insert(formToInsertRow(form, userId))
      .select(CALENDAR_SELECT)
      .single();
  }).then((result) => ({
    data: result.data ? mapCalendarEvent(result.data as unknown as CalendarEventRow) : null,
    error: result.error,
  }));
}

export async function softDeleteCalendarEvent(id: string, userId: string): Promise<{ error: string | null }> {
  const result = await runClinicalMutation('Failed to delete calendar event', async () => {
    const supabase = createClient();
    return supabase
      .from('calendar_events')
      .update({ deleted_at: new Date().toISOString(), updated_by: userId })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .single();
  });
  return { error: result.error };
}
