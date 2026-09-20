-- ============================================================================
-- Migration 072: Form-Hema-022 reagent lot-to-lot verification (additive)
-- Extends inventory_reagent_lot_comparisons for multi-test / multi-sample studies.
-- Does not modify or delete historical studies.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'inventory_lot_interpretation' AND e.enumlabel = 'cannot_calculate'
  ) THEN
    ALTER TYPE public.inventory_lot_interpretation ADD VALUE 'cannot_calculate';
  END IF;
END $$;

ALTER TABLE public.inventory_reagent_lot_comparisons
  ADD COLUMN IF NOT EXISTS schema_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS form_code TEXT,
  ADD COLUMN IF NOT EXISTS study_year INTEGER,
  ADD COLUMN IF NOT EXISTS analyte_test_group TEXT,
  ADD COLUMN IF NOT EXISTS reagent_key TEXT,
  ADD COLUMN IF NOT EXISTS form_layout TEXT,
  ADD COLUMN IF NOT EXISTS test_codes_snapshot JSONB;

ALTER TABLE public.inventory_reagent_lot_comparison_results
  ADD COLUMN IF NOT EXISTS test_code TEXT,
  ADD COLUMN IF NOT EXISTS test_label TEXT,
  ADD COLUMN IF NOT EXISTS unit TEXT,
  ADD COLUMN IF NOT EXISTS acceptance_limit_percent NUMERIC(10, 4),
  ADD COLUMN IF NOT EXISTS absolute_difference_units NUMERIC(14, 6),
  ADD COLUMN IF NOT EXISTS recorded_by_name TEXT,
  ADD COLUMN IF NOT EXISTS recorded_by_staff_id TEXT,
  ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ;

ALTER TABLE public.inventory_reagent_lot_comparison_results
  DROP CONSTRAINT IF EXISTS inventory_reagent_lot_results_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reagent_lot_results_legacy_unique
  ON public.inventory_reagent_lot_comparison_results(comparison_id, sample_number)
  WHERE test_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reagent_lot_results_test_unique
  ON public.inventory_reagent_lot_comparison_results(comparison_id, sample_number, test_code)
  WHERE test_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.inventory_reagent_lot_sample_identifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comparison_id UUID NOT NULL REFERENCES public.inventory_reagent_lot_comparisons(id) ON DELETE CASCADE,
  sample_number INTEGER NOT NULL CHECK (sample_number BETWEEN 1 AND 3),
  ciphertext TEXT NOT NULL,
  key_version TEXT NOT NULL,
  is_synthetic BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_reagent_lot_sample_identifiers_unique UNIQUE (comparison_id, sample_number)
);

DROP TRIGGER IF EXISTS trg_inventory_reagent_lot_sample_identifiers_updated_at
  ON public.inventory_reagent_lot_sample_identifiers;
CREATE TRIGGER trg_inventory_reagent_lot_sample_identifiers_updated_at
  BEFORE UPDATE ON public.inventory_reagent_lot_sample_identifiers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.inventory_reagent_lot_sample_identifiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_reagent_lot_sample_identifiers_select
  ON public.inventory_reagent_lot_sample_identifiers;
CREATE POLICY inventory_reagent_lot_sample_identifiers_select
  ON public.inventory_reagent_lot_sample_identifiers
  FOR SELECT TO authenticated
  USING (public.has_permission('inventory.view'));

DROP POLICY IF EXISTS inventory_reagent_lot_sample_identifiers_manage
  ON public.inventory_reagent_lot_sample_identifiers;
CREATE POLICY inventory_reagent_lot_sample_identifiers_manage
  ON public.inventory_reagent_lot_sample_identifiers
  FOR ALL TO authenticated
  USING (public.has_permission('inventory.manage'))
  WITH CHECK (public.has_permission('inventory.manage'));

COMMIT;
