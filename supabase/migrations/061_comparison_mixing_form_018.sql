-- ============================================================================
-- Migration 061: Form-Hema-018 Open/Close Mode Mixing Study extension
-- Does NOT auto-apply.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comparison_mixing_mode') THEN
    CREATE TYPE public.comparison_mixing_mode AS ENUM ('close', 'open');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.comparison_mixing_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id UUID NOT NULL REFERENCES public.comparison_studies(id) ON DELETE CASCADE,
  mode public.comparison_mixing_mode NOT NULL,
  sample_number INTEGER NOT NULL CHECK (sample_number BETWEEN 1 AND 5),
  initial_test_time TIMESTAMPTZ,
  final_test_time TIMESTAMPTZ,
  elapsed_minutes INTEGER,
  timing_valid BOOLEAN,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT comparison_mixing_samples_unique UNIQUE (study_id, mode, sample_number)
);

CREATE TABLE IF NOT EXISTS public.comparison_mixing_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mixing_sample_id UUID NOT NULL REFERENCES public.comparison_mixing_samples(id) ON DELETE CASCADE,
  test_code TEXT NOT NULL,
  test_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  tae_percent_snapshot NUMERIC(8,4) NOT NULL,
  first_result NUMERIC(14,6),
  tae_value NUMERIC(14,6),
  lower_limit NUMERIC(14,6),
  upper_limit NUMERIC(14,6),
  final_result NUMERIC(14,6),
  result_status public.comparison_result_status NOT NULL DEFAULT 'incomplete',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT comparison_mixing_results_unique UNIQUE (mixing_sample_id, test_code)
);

CREATE INDEX IF NOT EXISTS idx_comparison_mixing_samples_study
  ON public.comparison_mixing_samples(study_id, mode, display_order);
CREATE INDEX IF NOT EXISTS idx_comparison_mixing_results_sample
  ON public.comparison_mixing_results(mixing_sample_id, test_code);

DROP TRIGGER IF EXISTS trg_comparison_mixing_samples_updated_at ON public.comparison_mixing_samples;
CREATE TRIGGER trg_comparison_mixing_samples_updated_at
  BEFORE UPDATE ON public.comparison_mixing_samples
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_comparison_mixing_results_updated_at ON public.comparison_mixing_results;
CREATE TRIGGER trg_comparison_mixing_results_updated_at
  BEFORE UPDATE ON public.comparison_mixing_results
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.comparison_mixing_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparison_mixing_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comparison_mixing_samples_all ON public.comparison_mixing_samples;
CREATE POLICY comparison_mixing_samples_all ON public.comparison_mixing_samples
  FOR ALL TO authenticated
  USING (public.has_permission('comparison.view'))
  WITH CHECK (
    public.has_permission('comparison.create')
    OR public.has_permission('comparison.edit')
    OR public.is_system_admin()
  );

DROP POLICY IF EXISTS comparison_mixing_results_all ON public.comparison_mixing_results;
CREATE POLICY comparison_mixing_results_all ON public.comparison_mixing_results
  FOR ALL TO authenticated
  USING (public.has_permission('comparison.view'))
  WITH CHECK (
    public.has_permission('comparison.create')
    OR public.has_permission('comparison.edit')
    OR public.has_permission('comparison.review')
    OR public.is_system_admin()
  );

COMMIT;
