-- ============================================================================
-- Hematology Section Portal
-- Migration 021: Report Templates
-- Production-safe. No seed data.
-- ============================================================================

CREATE TABLE public.report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  module TEXT NOT NULL,
  fields_config JSONB NOT NULL DEFAULT '{}'::JSONB,
  filters_config JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_report_templates_module ON public.report_templates(module) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_report_templates_updated_at BEFORE UPDATE ON public.report_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY report_templates_select ON public.report_templates
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('report_builder.view'));

CREATE POLICY report_templates_insert ON public.report_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('report_builder.manage'));

CREATE POLICY report_templates_update ON public.report_templates
  FOR UPDATE TO authenticated
  USING (public.has_permission('report_builder.manage') AND deleted_at IS NULL)
  WITH CHECK (public.has_permission('report_builder.manage'));

CREATE POLICY report_templates_delete ON public.report_templates
  FOR DELETE TO authenticated
  USING (public.has_permission('report_builder.manage'));
