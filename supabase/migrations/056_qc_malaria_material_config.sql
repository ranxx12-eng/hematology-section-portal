-- ============================================================================
-- Migration 056: QC malaria material lot/expiry configuration
-- Does NOT auto-apply.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.qc_material_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter_name TEXT NOT NULL,
  lot_number TEXT NOT NULL DEFAULT '',
  expiry_date DATE,
  effective_from DATE,
  effective_to DATE,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT qc_material_configs_parameter_unique UNIQUE (parameter_name)
);

CREATE INDEX IF NOT EXISTS idx_qc_material_configs_parameter
  ON public.qc_material_configs(parameter_name);

DROP TRIGGER IF EXISTS trg_qc_material_configs_updated_at ON public.qc_material_configs;
CREATE TRIGGER trg_qc_material_configs_updated_at
  BEFORE UPDATE ON public.qc_material_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.qc_material_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qc_material_configs_select ON public.qc_material_configs;
CREATE POLICY qc_material_configs_select ON public.qc_material_configs
  FOR SELECT TO authenticated
  USING (public.has_permission('qc.view'));

DROP POLICY IF EXISTS qc_material_configs_insert ON public.qc_material_configs;
CREATE POLICY qc_material_configs_insert ON public.qc_material_configs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('qc.manage') OR public.is_system_admin());

DROP POLICY IF EXISTS qc_material_configs_update ON public.qc_material_configs;
CREATE POLICY qc_material_configs_update ON public.qc_material_configs
  FOR UPDATE TO authenticated
  USING (public.has_permission('qc.manage') OR public.is_system_admin())
  WITH CHECK (public.has_permission('qc.manage') OR public.is_system_admin());

COMMIT;
