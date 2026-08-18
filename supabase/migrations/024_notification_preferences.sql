-- ============================================================================
-- Hematology Section Portal
-- Migration 024: Notification Preferences
-- Production-safe. No seed data.
-- ============================================================================

CREATE TABLE public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  in_app BOOLEAN NOT NULL DEFAULT TRUE,
  email BOOLEAN NOT NULL DEFAULT TRUE,
  critical_values BOOLEAN NOT NULL DEFAULT TRUE,
  sample_rejections BOOLEAN NOT NULL DEFAULT TRUE,
  maintenance_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  due_date_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_preferences_select_own ON public.notification_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_permission('notifications.manage'));

CREATE POLICY notification_preferences_upsert_own ON public.notification_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_permission('notifications.manage'))
  WITH CHECK (user_id = auth.uid() OR public.has_permission('notifications.manage'));
