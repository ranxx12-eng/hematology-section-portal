-- ============================================================================
-- Migration 073: Form-Hema-022 schema + transactional lot activation RPC
-- Apply only after 072_form_hema_022_enum.sql is committed.
-- ============================================================================

BEGIN;

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

-- Activation RPC (separate transaction after schema commit)
CREATE OR REPLACE FUNCTION public.activate_reagent_lot_study(p_comparison_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_comparison public.inventory_reagent_lot_comparisons%ROWTYPE;
  v_item public.inventory_items%ROWTYPE;
  v_existing public.inventory_lot_usage%ROWTYPE;
  v_context_key TEXT;
  v_usage_id UUID;
  v_staff_name TEXT;
  v_staff_id TEXT;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT public.has_permission('inventory.manage') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  SELECT p.full_name, p.staff_id
  INTO v_staff_name, v_staff_id
  FROM public.profiles p
  WHERE p.id = v_actor AND p.deleted_at IS NULL;

  SELECT * INTO v_comparison
  FROM public.inventory_reagent_lot_comparisons
  WHERE id = p_comparison_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Study not found';
  END IF;
  IF v_comparison.status <> 'approved'::public.inventory_lot_study_status THEN
    RAISE EXCEPTION 'Study must be approved before activating the new lot';
  END IF;
  IF v_comparison.activated_at IS NOT NULL THEN
    RAISE EXCEPTION 'New lot was already activated for this study';
  END IF;

  IF v_comparison.new_store_item_id IS NULL THEN
    SELECT * INTO v_item
    FROM public.inventory_items
    WHERE deleted_at IS NULL
      AND lot_number = v_comparison.new_lot_number
      AND lower(item_name) = lower(v_comparison.reagent_name)
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
    SELECT * INTO v_item
    FROM public.inventory_items
    WHERE id = v_comparison.new_store_item_id AND deleted_at IS NULL;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link a new store item before activation';
  END IF;

  v_context_key := concat(
    'kind:reagent|instrument:', coalesce(v_comparison.instrument_id::text, 'none'),
    CASE WHEN v_item.category IS NOT NULL THEN '|category:' || v_item.category ELSE '' END,
    CASE WHEN v_comparison.test_parameter IS NOT NULL THEN '|param:' || v_comparison.test_parameter ELSE '' END
  );

  SELECT * INTO v_existing
  FROM public.inventory_lot_usage
  WHERE context_key = v_context_key AND status = 'active'::public.inventory_lot_usage_status
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.inventory_lot_usage
    SET status = 'superseded'::public.inventory_lot_usage_status,
        updated_at = NOW()
    WHERE id = v_existing.id;

    INSERT INTO public.inventory_audit_events (
      entity_type, entity_id, inventory_item_id, lot_number, action, user_id, user_name, staff_id, metadata
    ) VALUES (
      'inventory_lot_usage', v_existing.id, v_existing.inventory_item_id, v_existing.lot_number_snapshot,
      'LOT_SUPERSEDED', v_actor, v_staff_name, v_staff_id,
      jsonb_build_object('contextKey', v_context_key, 'reagentComparisonId', p_comparison_id)
    );
  END IF;

  INSERT INTO public.inventory_lot_usage (
    inventory_item_id, item_name_snapshot, category_snapshot, lot_number_snapshot,
    manufacturer_snapshot, context_key, instrument_id, instrument_name_snapshot,
    test_parameter, start_date, expiry_date, quantity_remaining, status,
    started_by, started_by_name, started_by_staff_id, reagent_comparison_id
  ) VALUES (
    v_item.id, v_item.item_name, v_item.category, coalesce(v_item.lot_number, '—'),
    v_item.manufacturer, v_context_key, v_comparison.instrument_id, v_comparison.instrument_name_snapshot,
    v_comparison.test_parameter, CURRENT_DATE, v_item.expiry_date, v_item.quantity,
    'active'::public.inventory_lot_usage_status,
    v_actor, v_staff_name, v_staff_id, p_comparison_id
  )
  RETURNING id INTO v_usage_id;

  UPDATE public.inventory_reagent_lot_comparisons
  SET activated_at = NOW(), activated_by = v_actor, updated_by = v_actor, updated_at = NOW()
  WHERE id = p_comparison_id;

  INSERT INTO public.inventory_audit_events (
    entity_type, entity_id, inventory_item_id, lot_number, action, user_id, user_name, staff_id, metadata
  ) VALUES (
    'inventory_lot_usage', v_usage_id, v_item.id, coalesce(v_item.lot_number, '—'),
    'LOT_ACTIVATED', v_actor, v_staff_name, v_staff_id,
    jsonb_build_object('contextKey', v_context_key, 'reagentComparisonId', p_comparison_id)
  );

  INSERT INTO public.inventory_audit_events (
    entity_type, entity_id, inventory_item_id, lot_number, action, user_id, user_name, staff_id
  ) VALUES (
    'reagent_lot_comparison', p_comparison_id, v_item.id, v_comparison.new_lot_number,
    'NEW_LOT_ACTIVATED', v_actor, v_staff_name, v_staff_id
  );

  RETURN v_usage_id;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_reagent_lot_study(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_reagent_lot_study(UUID) TO authenticated;
