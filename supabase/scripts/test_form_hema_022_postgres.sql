-- Form-Hema-022 PostgreSQL integration tests (workflow + activation RPC)
-- Run: psql -d hematology_form_hema_022_test -f supabase/scripts/test_form_hema_022_postgres.sql

\set ON_ERROR_STOP on
\pset pager off

DO $$
DECLARE
  v_role_id UUID;
  v_perm_view UUID;
  v_perm_manage UUID;
  v_user_a UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_user_b UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_user_c UUID := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  v_item_old UUID := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  v_item_new UUID := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  v_study UUID := 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  v_study_fail UUID := '11111111-1111-1111-1111-111111111111';
  v_study_act UUID := '22222222-2222-2222-2222-222222222222';
  v_study_super UUID := '33333333-3333-3333-3333-333333333333';
  v_usage_before INTEGER;
  v_usage_after INTEGER;
  v_result UUID;
  v_err TEXT;
BEGIN
  SELECT id INTO v_role_id FROM public.roles LIMIT 1;
  IF v_role_id IS NULL THEN
    INSERT INTO public.roles (name, display_name_en, display_name_ar)
    VALUES ('inventory_officer', 'Inventory Officer', 'Inventory Officer')
    RETURNING id INTO v_role_id;
  END IF;

  INSERT INTO public.permissions (code, module, description)
  VALUES ('inventory.view', 'inventory', 'view'), ('inventory.manage', 'inventory', 'manage')
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_perm_view FROM public.permissions WHERE code = 'inventory.view';
  SELECT id INTO v_perm_manage FROM public.permissions WHERE code = 'inventory.manage';

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, p.id FROM public.permissions p WHERE p.code IN ('inventory.view', 'inventory.manage')
  ON CONFLICT DO NOTHING;

  ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES
    (v_user_a, 'preparer-a@test.local', '{}'::jsonb),
    (v_user_b, 'reviewer-b@test.local', '{}'::jsonb),
    (v_user_c, 'approver-c@test.local', '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;
  ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

  INSERT INTO public.profiles (id, email, full_name, primary_role_id, is_active)
  VALUES
    (v_user_a, 'preparer-a@test.local', 'Preparer A', v_role_id, TRUE),
    (v_user_b, 'reviewer-b@test.local', 'Reviewer B', v_role_id, TRUE),
    (v_user_c, 'approver-c@test.local', 'Approver C', v_role_id, TRUE)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, primary_role_id = EXCLUDED.primary_role_id, is_active = TRUE;

  INSERT INTO public.inventory_items (id, item_name, lot_number, quantity, category, unit, storage_location)
  VALUES
    (v_item_old, 'NeoPTimal', 'OLD-LOT-1', 10, 'reagent', 'kit', 'Cold Room'),
    (v_item_new, 'NeoPTimal', 'NEW-LOT-1', 10, 'reagent', 'kit', 'Cold Room')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.inventory_reagent_lot_comparisons (
    id, study_number, status, reagent_name, old_lot_number, new_lot_number,
    new_store_item_id, schema_version, acceptance_criteria_configured, created_by
  ) VALUES (
    v_study, 'RLT-TEST-001', 'draft', 'NeoPTimal', 'OLD-LOT-1', 'NEW-LOT-1',
    v_item_new, 2, TRUE, v_user_a
  ) ON CONFLICT (id) DO UPDATE SET status = 'draft', activated_at = NULL, activated_by = NULL,
    prepared_by = NULL, reviewed_by = NULL, approved_by = NULL;

  INSERT INTO public.inventory_reagent_lot_comparisons (
    id, study_number, status, reagent_name, old_lot_number, new_lot_number,
    schema_version, acceptance_criteria_configured, created_by
  ) VALUES (
    v_study_fail, 'RLT-TEST-002', 'approved', 'NeoPTimal', 'OLD-LOT-2', 'MISSING-LOT',
    2, TRUE, v_user_a
  ) ON CONFLICT (id) DO UPDATE SET status = 'approved', new_store_item_id = NULL,
    activated_at = NULL, activated_by = NULL;

  INSERT INTO public.inventory_reagent_lot_comparisons (
    id, study_number, status, reagent_name, old_lot_number, new_lot_number,
    new_store_item_id, schema_version, acceptance_criteria_configured, created_by,
    prepared_by, reviewed_by, approved_by
  ) VALUES (
    v_study_act, 'RLT-TEST-003', 'approved', 'NeoPTimal', 'OLD-LOT-1', 'NEW-LOT-1',
    v_item_new, 2, TRUE, v_user_a, v_user_a, v_user_b, v_user_c
  ) ON CONFLICT (id) DO UPDATE SET status = 'approved', activated_at = NULL, activated_by = NULL;

  INSERT INTO public.inventory_reagent_lot_comparisons (
    id, study_number, status, reagent_name, old_lot_number, new_lot_number,
    new_store_item_id, schema_version, acceptance_criteria_configured, created_by,
    prepared_by, reviewed_by, approved_by, test_parameter
  ) VALUES (
    v_study_super, 'RLT-TEST-004', 'approved', 'NeoPTimal', 'OLD-LOT-1', 'NEW-LOT-1',
    v_item_new, 2, TRUE, v_user_a, v_user_a, v_user_b, v_user_c, 'PT'
  ) ON CONFLICT (id) DO UPDATE SET status = 'approved', activated_at = NULL, activated_by = NULL;

  -- Direct bypass: stage skip draft -> approved
  PERFORM set_config('app.test_user_id', v_user_a::text, true);
  BEGIN
    UPDATE public.inventory_reagent_lot_comparisons SET status = 'approved' WHERE id = v_study;
    RAISE EXCEPTION 'Expected direct status bypass to fail';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err NOT LIKE '%workflow actions%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS direct stage skip blocked: %', v_err;
  END;

  -- Preparer self-review blocked
  PERFORM set_config('app.test_user_id', v_user_a::text, true);
  PERFORM public.perform_reagent_lot_workflow_action(v_study, 'submit');
  BEGIN
    PERFORM public.perform_reagent_lot_workflow_action(v_study, 'review');
    RAISE EXCEPTION 'Expected self-review to fail';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err NOT LIKE '%different users%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS preparer self-review blocked: %', v_err;
  END;

  -- Valid review by different user
  PERFORM set_config('app.test_user_id', v_user_b::text, true);
  PERFORM public.perform_reagent_lot_workflow_action(v_study, 'review');

  -- Reviewer self-approve blocked
  BEGIN
    PERFORM public.perform_reagent_lot_workflow_action(v_study, 'approve');
    RAISE EXCEPTION 'Expected reviewer self-approve to fail';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err NOT LIKE '%different users%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS reviewer self-approve blocked: %', v_err;
  END;

  -- Preparer self-approve blocked
  PERFORM set_config('app.test_user_id', v_user_a::text, true);
  BEGIN
    PERFORM public.perform_reagent_lot_workflow_action(v_study, 'approve');
    RAISE EXCEPTION 'Expected preparer self-approve to fail';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err NOT LIKE '%different users%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS preparer self-approve blocked: %', v_err;
  END;

  -- Valid approve
  PERFORM set_config('app.test_user_id', v_user_c::text, true);
  PERFORM public.perform_reagent_lot_workflow_action(v_study, 'approve');

  -- Activation failure: missing store item, no partial lot usage
  SELECT count(*) INTO v_usage_before FROM public.inventory_lot_usage;
  PERFORM set_config('app.test_user_id', v_user_c::text, true);
  BEGIN
    PERFORM public.activate_reagent_lot_study(v_study_fail);
    RAISE EXCEPTION 'Expected activation failure for missing item';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err NOT LIKE '%Link a new store item%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS activation failure before item link: %', v_err;
  END;
  SELECT count(*) INTO v_usage_after FROM public.inventory_lot_usage;
  IF v_usage_after <> v_usage_before THEN
    RAISE EXCEPTION 'Partial inventory_lot_usage rows after failed activation (% -> %)', v_usage_before, v_usage_after;
  END IF;
  IF (SELECT activated_at FROM public.inventory_reagent_lot_comparisons WHERE id = v_study_fail) IS NOT NULL THEN
    RAISE EXCEPTION 'Study marked activated after failed activation';
  END IF;
  RAISE NOTICE 'PASS no partial state after failed activation';

  -- Successful activation + repeated call blocked
  PERFORM set_config('app.test_user_id', v_user_c::text, true);
  v_result := public.activate_reagent_lot_study(v_study_act);
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Activation did not return usage id';
  END IF;

  BEGIN
    PERFORM public.activate_reagent_lot_study(v_study_act);
    RAISE EXCEPTION 'Expected repeated activation to fail';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err NOT LIKE '%already activated%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS repeated activation blocked: %', v_err;
  END;

  -- Supersede path
  INSERT INTO public.inventory_lot_usage (
    inventory_item_id, item_name_snapshot, category_snapshot, lot_number_snapshot,
    context_key, status, started_by
  ) VALUES (
    v_item_old, 'NeoPTimal', 'reagent', 'OLD-LOT-1',
    'kind:reagent|instrument:none|category:reagent|param:PT', 'active', v_user_a
  );

  PERFORM set_config('app.test_user_id', v_user_c::text, true);
  v_result := public.activate_reagent_lot_study(v_study_super);

  IF NOT EXISTS (
    SELECT 1 FROM public.inventory_lot_usage
    WHERE lot_number_snapshot = 'OLD-LOT-1' AND status = 'superseded'
  ) THEN
    RAISE EXCEPTION 'Prior active lot was not superseded';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.inventory_lot_usage
    WHERE id = v_result AND status = 'active' AND lot_number_snapshot = 'NEW-LOT-1'
  ) THEN
    RAISE EXCEPTION 'New active lot usage missing after activation';
  END IF;

  RAISE NOTICE 'ALL FORM-HEMA-022 POSTGRES TESTS PASSED';
END $$;
