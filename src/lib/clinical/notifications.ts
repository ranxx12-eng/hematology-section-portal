import { createClient } from '@/lib/supabase/client';
import type { Notification } from '@/types';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult } from './result';

interface NotificationRow {
  id: string;
  user_id: string;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

function mapNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.notification_type,
    title: row.title,
    message: row.message,
    isRead: row.is_read,
    link: row.link ?? undefined,
    createdAt: row.created_at,
  };
}

export async function fetchNotifications(userId: string): Promise<ClinicalListResult<Notification>> {
  return runClinicalListQuery('Failed to load notifications', async () => {
    const supabase = createClient();
    return supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
  }).then((result) => ({
    data: (result.data as unknown as NotificationRow[]).map(mapNotification),
    error: result.error,
  }));
}

export async function markNotificationRead(id: string): Promise<{ error: string | null }> {
  const result = await runClinicalMutation('Failed to mark notification read', async () => {
    const supabase = createClient();
    return supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .single();
  });
  return { error: result.error };
}

export async function markAllNotificationsRead(userId: string): Promise<{ error: string | null }> {
  const result = await runClinicalMutation('Failed to mark all notifications read', async () => {
    const supabase = createClient();
    return supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false)
      .select('id');
  });
  return { error: result.error };
}

export async function deleteNotification(id: string): Promise<{ error: string | null }> {
  const result = await runClinicalMutation('Failed to delete notification', async () => {
    const supabase = createClient();
    return supabase.from('notifications').delete().eq('id', id).select('id').single();
  });
  return { error: result.error };
}
