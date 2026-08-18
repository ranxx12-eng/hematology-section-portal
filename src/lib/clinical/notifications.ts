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

interface NotificationPreferenceRow {
  user_id: string;
  in_app: boolean;
  email: boolean;
  critical_values: boolean;
  sample_rejections: boolean;
  maintenance_reminders: boolean;
  due_date_reminders: boolean;
}

export async function fetchNotificationPreferences(userId: string) {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };

    const defaults = {
      userId,
      inApp: true,
      email: true,
      criticalValues: true,
      sampleRejections: true,
      maintenanceReminders: true,
      dueDateReminders: true,
    };

    if (!data) return { data: defaults, error: null };

    const row = data as NotificationPreferenceRow;
    return {
      data: {
        userId: row.user_id,
        inApp: row.in_app,
        email: row.email,
        criticalValues: row.critical_values,
        sampleRejections: row.sample_rejections,
        maintenanceReminders: row.maintenance_reminders,
        dueDateReminders: row.due_date_reminders,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to load notification preferences',
    };
  }
}

export async function saveNotificationPreferences(
  userId: string,
  prefs: Omit<import('@/types/modules').NotificationPreference, 'userId'>,
): Promise<{ error: string | null }> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('notification_preferences')
      .upsert(
        {
          user_id: userId,
          in_app: prefs.inApp,
          email: prefs.email,
          critical_values: prefs.criticalValues,
          sample_rejections: prefs.sampleRejections,
          maintenance_reminders: prefs.maintenanceReminders,
          due_date_reminders: prefs.dueDateReminders,
        },
        { onConflict: 'user_id' },
      );
    return { error: error?.message ?? null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save notification preferences' };
  }
}
