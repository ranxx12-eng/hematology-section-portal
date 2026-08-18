-- ============================================================================
-- Hematology Section Portal
-- Migration 022: Dashboard Layouts
-- Production-safe. No seed data.
-- ============================================================================

CREATE TABLE public.dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  layout_config JSONB NOT NULL DEFAULT '{"widgets":[]}'::JSONB,
  visibility_prefs JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_dashboard_layouts_updated_at BEFORE UPDATE ON public.dashboard_layouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY dashboard_layouts_select_own ON public.dashboard_layouts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_permission('settings.manage'));

CREATE POLICY dashboard_layouts_insert_own ON public.dashboard_layouts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_permission('settings.manage'));

CREATE POLICY dashboard_layouts_update_own ON public.dashboard_layouts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_permission('settings.manage'))
  WITH CHECK (user_id = auth.uid() OR public.has_permission('settings.manage'));

CREATE POLICY dashboard_layouts_delete_own ON public.dashboard_layouts
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_permission('settings.manage'));
