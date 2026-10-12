-- Form-Hema-024 local workflow, lock, and RLS checks.
-- Run: psql -d hematology_form_hema_022_test -v ON_ERROR_STOP=1 -f supabase/scripts/test_form_hema_024_postgres.sql

\set ON_ERROR_STOP on
\pset pager off

BEGIN;

DO $$
DECLARE
  v_tech UUID := '02400000-0000-4000-8000-000000000001';
  v_senior UUID := '02400000-0000-4000-8000-000000000002';
  v_quality UUID := '02400000-0000-4000-8000-000000000003';
  v_supervisor UUID := '02400000-0000-4000-8000-000000000004';
  v_inventory UUID := '02400000-0000-4000-8000-000000000005';
  v_admin UUID := '02400000-0000-4000-8000-000000000006';
  v_role_tech UUID;
  v_role_senior UUID;
  v_role_quality UUID;
  v_role_supervisor UUID;
  v_role_inventory UUID;
  v_role_admin UUID;
  v_1147 UUID;
  v_1149 UUID;
  v_checklist UUID;
  v_other UUID;
  v_leap UUID;
  v_batch UUID := '02400000-0000-4000-8000-000000000101';
  v_batch_other UUID := '02400000-0000-4000-8000-000000000102';
  v_batch_leap UUID := '02400000-0000-4000-8000-000000000103';
  v_link UUID;
BEGIN
  SELECT id INTO v_role_tech FROM public.roles WHERE name = 'lab_technologist';
  SELECT id INTO v_role_senior FROM public.roles WHERE name = 'senior_lab_technologist';
  SELECT id INTO v_role_quality FROM public.roles WHERE name = 'quality_officer';
  SELECT id INTO v_role_supervisor FROM public.roles WHERE name = 'section_supervisor';
  SELECT id INTO v_role_inventory FROM public.roles WHERE name = 'inventory_officer';
  SELECT id INTO v_role_admin FROM public.roles WHERE name = 'system_admin';
  IF v_role_tech IS NULL OR v_role_senior IS NULL OR v_role_quality IS NULL OR v_role_supervisor IS NULL OR v_role_inventory IS NULL OR v_role_admin IS NULL THEN
    RAISE EXCEPTION 'required roles are missing';
  END IF;

  SELECT id INTO v_1147 FROM public.instruments WHERE deleted_at IS NULL AND name ~* '^Alinity HQ[[:space:]]*1147$' ORDER BY name LIMIT 1;
  SELECT id INTO v_1149 FROM public.instruments WHERE deleted_at IS NULL AND name ~* '^Alinity HQ[[:space:]]*1149$' ORDER BY name LIMIT 1;
  IF v_1147 IS NULL OR v_1149 IS NULL THEN
    RAISE EXCEPTION 'Alinity instruments are missing';
  END IF;

  ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
  INSERT INTO auth.users (id, email) VALUES
    (v_tech, 'form024-tech@test.local'),
    (v_senior, 'form024-senior@test.local'),
    (v_quality, 'form024-quality@test.local'),
    (v_supervisor, 'form024-supervisor@test.local'),
    (v_inventory, 'form024-inventory@test.local'),
    (v_admin, 'form024-admin@test.local')
  ON CONFLICT (id) DO NOTHING;
  ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

  INSERT INTO public.profiles (id, email, full_name, primary_role_id, is_active, staff_id) VALUES
    (v_tech, 'form024-tech@test.local', 'Lama Hassan', v_role_tech, TRUE, 'T-1001'),
    (v_senior, 'form024-senior@test.local', 'Nora Saleh', v_role_senior, TRUE, 'S-2002'),
    (v_quality, 'form024-quality@test.local', 'Huda Ali', v_role_quality, TRUE, 'Q-3003'),
    (v_supervisor, 'form024-supervisor@test.local', 'Majed Karim', v_role_supervisor, TRUE, 'P-4004'),
    (v_inventory, 'form024-inventory@test.local', 'Inventory User', v_role_inventory, TRUE, 'I-5005'),
    (v_admin, 'form024-admin@test.local', 'System Admin', v_role_admin, TRUE, 'A-6006')
  ON CONFLICT (id) DO UPDATE
    SET primary_role_id = EXCLUDED.primary_role_id, is_active = TRUE, staff_id = EXCLUDED.staff_id, full_name = EXCLUDED.full_name;

  INSERT INTO public.qc_records (
    instrument_id, test_name, control_level, recorded_at, qc_status, qc_batch_id,
    performed_by_user_id, performed_by_name, performed_by_staff_id
  ) VALUES
    (v_1147, 'WBC', 'Normal', '2026-07-15 08:00:00+03', 'IN', v_batch, v_tech, 'Lama Hassan', 'T-1001'),
    (v_1149, 'WBC', 'Normal', '2026-07-15 08:00:00+03', 'IN', v_batch_other, v_tech, 'Lama Hassan', 'T-1001'),
    (v_1147, 'WBC', 'Normal', '2024-02-29 08:00:00+03', 'IN', v_batch_leap, v_tech, 'Lama Hassan', 'T-1001');

  PERFORM set_config('app.test_user_id', v_tech::text, true);
  v_checklist := public.ensure_alinity_qc_checklist(v_1147, 2026, 7);
  IF public.ensure_alinity_qc_checklist(v_1147, 2026, 7) <> v_checklist THEN
    RAISE EXCEPTION 'month checklist was duplicated';
  END IF;
  v_other := public.ensure_alinity_qc_checklist(v_1149, 2026, 7);
  IF v_other = v_checklist THEN
    RAISE EXCEPTION 'instruments shared one checklist';
  END IF;

  v_link := public.associate_alinity_qc_run(v_checklist, 15, 'run_1', v_batch);
  IF v_link IS NULL THEN
    RAISE EXCEPTION 'run was not associated';
  END IF;

  BEGIN
    PERFORM public.associate_alinity_qc_run(v_checklist, 15, 'run_1', v_batch_leap);
    RAISE EXCEPTION 'occupied slot should have been rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%already recorded%' THEN
      RAISE;
    END IF;
  END;
  IF (SELECT count(*) FROM public.alinity_qc_run_links WHERE checklist_id = v_checklist AND day_of_month = 15 AND run_slot = 'run_1') <> 1 THEN
    RAISE EXCEPTION 'existing run slot was overwritten';
  END IF;

  BEGIN
    PERFORM public.associate_alinity_qc_run(v_checklist, 15, 'run_2', v_batch_other);
    RAISE EXCEPTION 'other instrument run should have been rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%different instrument%' THEN
      RAISE;
    END IF;
  END;

  v_leap := public.ensure_alinity_qc_checklist(v_1147, 2026, 2);
  BEGIN
    PERFORM public.associate_alinity_qc_run(v_leap, 31, 'run_1', v_batch_leap);
    RAISE EXCEPTION 'February 31 should have failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%Invalid checklist date%' THEN
      RAISE;
    END IF;
  END;
  BEGIN
    PERFORM public.associate_alinity_qc_run(v_leap, 29, 'run_1', v_batch_leap);
    RAISE EXCEPTION 'non-leap February 29 should have failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%Invalid checklist date%' THEN
      RAISE;
    END IF;
  END;
  PERFORM public.associate_alinity_qc_run(
    public.ensure_alinity_qc_checklist(v_1147, 2024, 2),
    29,
    'run_1',
    v_batch_leap
  );

  PERFORM set_config('app.test_user_id', v_tech::text, true);
  BEGIN
    PERFORM public.review_alinity_qc_checklist(v_checklist);
    RAISE EXCEPTION 'technologist monthly review should have failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%Not authorized to review%' THEN
      RAISE;
    END IF;
  END;

  PERFORM set_config('app.test_user_id', v_senior::text, true);
  UPDATE public.qc_records
  SET review_status = 'Reviewed',
      review_decision = 'accept',
      reviewed_by = v_senior,
      reviewed_by_name = 'Nora Saleh',
      reviewed_by_staff_id = 'S-2002',
      reviewed_at = NOW()
  WHERE qc_batch_id = v_batch;
  PERFORM public.attest_alinity_qc_cv(v_checklist, 15);

  PERFORM set_config('app.test_user_id', v_inventory::text, true);
  BEGIN
    PERFORM public.attest_alinity_qc_cv(v_checklist, 16);
    RAISE EXCEPTION 'inventory CV attestation should have failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%Not authorized to attest%' THEN
      RAISE;
    END IF;
  END;

  PERFORM set_config('app.test_user_id', v_quality::text, true);
  PERFORM public.review_alinity_qc_checklist(v_checklist);
  IF (SELECT status FROM public.alinity_qc_checklists WHERE id = v_checklist) <> 'reviewed' THEN
    RAISE EXCEPTION 'monthly review did not record';
  END IF;

  PERFORM set_config('app.test_user_id', v_quality::text, true);
  BEGIN
    PERFORM public.sign_alinity_qc_checklist_supervisor(v_checklist);
    RAISE EXCEPTION 'quality officer supervisor sign-off should have failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%Not authorized to sign%' THEN
      RAISE;
    END IF;
  END;

  PERFORM set_config('app.test_user_id', v_admin::text, true);
  PERFORM public.review_alinity_qc_checklist(v_checklist);
  BEGIN
    PERFORM public.sign_alinity_qc_checklist_supervisor(v_checklist);
    RAISE EXCEPTION 'reviewer supervisor sign-off should have failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%must not be the monthly reviewer%' THEN
      RAISE;
    END IF;
  END;

  PERFORM set_config('app.test_user_id', v_supervisor::text, true);
  PERFORM public.sign_alinity_qc_checklist_supervisor(v_checklist);
  IF (SELECT status FROM public.alinity_qc_checklists WHERE id = v_checklist) <> 'finalized' THEN
    RAISE EXCEPTION 'supervisor sign-off did not finalize';
  END IF;
  IF (SELECT frozen_evidence -> 'records' FROM public.alinity_qc_checklists WHERE id = v_checklist) IS NULL THEN
    RAISE EXCEPTION 'finalized evidence was not stored';
  END IF;

  PERFORM set_config('app.test_user_id', v_tech::text, true);
  BEGIN
    PERFORM public.associate_alinity_qc_run(v_checklist, 16, 'run_1', v_batch_leap);
    RAISE EXCEPTION 'finalized checklist accepted a new run';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%locked%' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    PERFORM set_config('alinity_checklist.workflow', '', true);
    UPDATE public.alinity_qc_checklists SET comment = 'changed' WHERE id = v_checklist;
    RAISE EXCEPTION 'direct update should have failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%only be updated through the workflow%' THEN
      RAISE;
    END IF;
  END;

  PERFORM set_config('app.test_user_id', v_supervisor::text, true);
  PERFORM public.reopen_alinity_qc_checklist(v_checklist, 'Correct the July association');
  IF (SELECT status FROM public.alinity_qc_checklists WHERE id = v_checklist) <> 'open' THEN
    RAISE EXCEPTION 'amendment did not reopen the checklist';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.alinity_qc_checklist_events
    WHERE checklist_id = v_checklist
      AND action = 'amendment_reopen'
      AND detail ? 'previousEvidence'
  ) THEN
    RAISE EXCEPTION 'amendment did not keep the previous evidence';
  END IF;
END $$;

SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM set_config('app.test_user_id', '02400000-0000-4000-8000-000000000005', true);
  IF (SELECT count(*) FROM public.alinity_qc_checklists) <> 0 THEN
    RAISE EXCEPTION 'documents access revealed checklist rows';
  END IF;
END $$;
RESET ROLE;

ROLLBACK;
