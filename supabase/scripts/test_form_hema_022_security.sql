-- Security tests for Migration 075 escrow hardening (run after test_form_hema_022_postgres.sql)
\set ON_ERROR_STOP on
\pset pager off

DO $$
DECLARE
  v_study UUID := '55555555-5555-5555-5555-555555555555';
  v_user UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_item UUID := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  v_err TEXT;
  v_rows INTEGER;
BEGIN
  INSERT INTO public.inventory_reagent_lot_comparisons (
    id, study_number, status, reagent_name, old_lot_number, new_lot_number,
    new_store_item_id, schema_version, acceptance_criteria_configured, created_by
  ) VALUES (
    v_study, 'RLT-TEST-SEC', 'draft', 'NeoPTimal', 'OLD-SEC', 'NEW-SEC',
    v_item, 2, TRUE, v_user
  ) ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('app.test_user_id', v_user::text, true);

  BEGIN
    PERFORM set_config('app.reagent_lot_workflow_bypass', 'true', true);
    UPDATE public.inventory_reagent_lot_comparisons
    SET status = 'approved'
    WHERE id = v_study;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION 'Expected single-row UPDATE for bypass test, got %', v_rows;
    END IF;
    RAISE EXCEPTION 'Expected bypass-flag UPDATE to fail';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err NOT LIKE '%workflow actions%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS bypass flag direct UPDATE blocked: %', v_err;
  END;

  BEGIN
    INSERT INTO public._reagent_lot_workflow_escrows (comparison_id, action)
    VALUES (v_study, 'approve');
    RAISE EXCEPTION 'Expected direct escrow insert to fail';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS direct escrow insert blocked by privileges';
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err NOT LIKE '%permission denied%' AND v_err NOT ILIKE '%privilege%' THEN
      RAISE;
    END IF;
    RAISE NOTICE 'PASS direct escrow insert blocked: %', v_err;
  END;

  PERFORM public.perform_reagent_lot_workflow_action(v_study, 'submit');
  RAISE NOTICE 'PASS workflow RPC submit still works after escrow hardening';
  RAISE NOTICE 'ALL FORM-HEMA-022 SECURITY TESTS PASSED';
END $$;
