-- Backfill confirmed Form-Hema-022 criteria onto draft/returned studies only.
-- Does not modify submitted, pending, approved, rejected, or activated studies.
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_retic_snapshot JSONB := '[
    {"code":"RETIC","label":"RETIC","acceptanceLimitPercent":25,"autoInterpretationEnabled":true},
    {"code":"R_PERCENT","label":"R%","acceptanceLimitPercent":25,"autoInterpretationEnabled":true}
  ]'::jsonb;
  v_draft_updated INTEGER;
  v_result_updated INTEGER;
  v_frozen INTEGER;
BEGIN
  UPDATE public.inventory_reagent_lot_comparisons c
  SET
    test_codes_snapshot = v_retic_snapshot,
    acceptance_criteria_configured = TRUE,
    updated_at = NOW()
  WHERE c.reagent_key = 'retic_reagent'
    AND c.schema_version = 2
    AND c.deleted_at IS NULL
    AND c.status IN ('draft'::public.inventory_lot_study_status, 'returned'::public.inventory_lot_study_status);
  GET DIAGNOSTICS v_draft_updated = ROW_COUNT;

  UPDATE public.inventory_reagent_lot_comparison_results r
  SET
    acceptance_limit_percent = 25,
    acceptance_criterion_text = '≤ 25% difference',
    interpretation = CASE
      WHEN r.old_result IS NULL OR r.new_result IS NULL THEN r.interpretation
      WHEN r.old_result = 0 THEN 'cannot_calculate'::public.inventory_lot_interpretation
      WHEN (ABS(r.new_result - r.old_result) / ABS(r.old_result) * 100) <= 25
        THEN 'acceptable'::public.inventory_lot_interpretation
      ELSE 'not_acceptable'::public.inventory_lot_interpretation
    END
  FROM public.inventory_reagent_lot_comparisons c
  WHERE r.comparison_id = c.id
    AND c.reagent_key = 'retic_reagent'
    AND c.schema_version = 2
    AND c.deleted_at IS NULL
    AND c.status IN ('draft'::public.inventory_lot_study_status, 'returned'::public.inventory_lot_study_status)
    AND r.test_code IN ('RETIC', 'R_PERCENT');
  GET DIAGNOSTICS v_result_updated = ROW_COUNT;

  SELECT COUNT(*) INTO v_frozen
  FROM public.inventory_reagent_lot_comparisons c
  WHERE c.reagent_key = 'retic_reagent'
    AND c.schema_version = 2
    AND c.deleted_at IS NULL
    AND c.status NOT IN ('draft'::public.inventory_lot_study_status, 'returned'::public.inventory_lot_study_status);

  RAISE NOTICE 'Draft studies updated: %', v_draft_updated;
  RAISE NOTICE 'Result rows updated: %', v_result_updated;
  RAISE NOTICE 'Non-draft RETIC studies left unchanged: %', v_frozen;
END $$;
