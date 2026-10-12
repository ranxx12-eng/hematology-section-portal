-- Form-Hema-023 local workflow, lock, and RLS checks.
-- Run: psql -d hematology_form_hema_022_test -v ON_ERROR_STOP=1 -f supabase/scripts/test_form_hema_023_postgres.sql

\set ON_ERROR_STOP on
\pset pager off

BEGIN;

DO $$
DECLARE
  v_senior UUID;
  v_supervisor UUID;
  v_inventory UUID;
  v_performer UUID := '02300000-0000-4000-8000-000000000001';
  v_reviewer UUID := '02300000-0000-4000-8000-000000000002';
  v_outsider UUID := '02300000-0000-4000-8000-000000000003';
  v_study UUID;
  v_draft UUID;
  v_text TEXT;
  v_index NUMERIC;
  v_payload JSONB;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'medical_mixing_studies'
      AND column_name IN ('patient_name', 'mrn', 'national_id', 'accession_number', 'sample_id', 'patient_label_reference')
  ) THEN
    RAISE EXCEPTION 'plaintext identifier column exists';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'medical_mixing_study_events'
      AND data_type = 'jsonb'
  ) THEN
    RAISE EXCEPTION 'audit events must not store a json payload';
  END IF;

  SELECT interpretation, rosner_index INTO v_text, v_index FROM public.mixing_study_rosner(100, 20, 35);
  IF v_text <> 'Does not exceed the Form-Hema-023 inhibitor threshold.' OR v_index <> 15 THEN
    RAISE EXCEPTION 'exactly 15 was classified incorrectly: % %', v_index, v_text;
  END IF;
  SELECT interpretation INTO v_text FROM public.mixing_study_rosner(100, 20, 35.01);
  IF v_text <> 'Suggests presence of an inhibitor' THEN
    RAISE EXCEPTION 'index above 15 was not classified as an inhibitor';
  END IF;
  SELECT interpretation INTO v_text FROM public.mixing_study_rosner(NULL, 20, 35);
  IF v_text <> 'Incomplete' THEN
    RAISE EXCEPTION 'missing input was not Incomplete';
  END IF;
  SELECT interpretation INTO v_text FROM public.mixing_study_rosner(0, 20, 35);
  IF v_text <> 'Cannot Calculate' THEN
    RAISE EXCEPTION 'patient zero was not Cannot Calculate';
  END IF;

  SELECT id INTO v_senior FROM public.roles WHERE name = 'senior_lab_technologist';
  SELECT id INTO v_supervisor FROM public.roles WHERE name = 'section_supervisor';
  SELECT id INTO v_inventory FROM public.roles WHERE name = 'inventory_officer';

  ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
  INSERT INTO auth.users (id, email) VALUES
    (v_performer, 'form023-performer@test.local'),
    (v_reviewer, 'form023-reviewer@test.local'),
    (v_outsider, 'form023-outsider@test.local')
  ON CONFLICT (id) DO NOTHING;
  ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

  INSERT INTO public.profiles (id, email, full_name, primary_role_id, is_active, staff_id) VALUES
    (v_performer, 'form023-performer@test.local', 'Lama Hassan', v_senior, TRUE, 'F023-4421'),
    (v_reviewer, 'form023-reviewer@test.local', 'Nora Saleh', v_supervisor, TRUE, 'F023-7788'),
    (v_outsider, 'form023-outsider@test.local', 'Inventory User', v_inventory, TRUE, 'F023-3003')
  ON CONFLICT (id) DO UPDATE SET primary_role_id = EXCLUDED.primary_role_id, is_active = TRUE, staff_id = EXCLUDED.staff_id;

  PERFORM set_config('app.test_user_id', v_performer::text, true);
  v_study := (public.create_mixing_study('aptt')->>'id')::uuid;

  v_payload := jsonb_build_object(
    'testSelection', 'aptt',
    'studyDate', '2026-10-04',
    'results', jsonb_build_array(jsonb_build_object(
      'testType', 'aptt',
      'patientClottingTime', '40',
      'nppClottingTime', '30',
      'targetValue', '32',
      'immediateMixClottingTime', '33',
      'incubatedMixClottingTime', '39',
      'conclusion', 'APTT conclusion'
    ), jsonb_build_object(
      'testType', 'pt',
      'patientClottingTime', '18',
      'nppClottingTime', '12',
      'targetValue', '13',
      'immediateMixClottingTime', '13',
      'incubatedMixClottingTime', '16',
      'conclusion', 'PT should be ignored'
    ))
  );
  PERFORM public.perform_mixing_study_action(v_study, 'submit', v_payload);
  IF EXISTS (SELECT 1 FROM public.medical_mixing_study_results WHERE study_id = v_study AND test_type = 'pt') THEN
    RAISE EXCEPTION 'unperformed PT result was stored';
  END IF;
  IF (SELECT status FROM public.medical_mixing_studies WHERE id = v_study) <> 'pending_review' THEN
    RAISE EXCEPTION 'APTT-only study was not submitted';
  END IF;

  BEGIN
    PERFORM public.perform_mixing_study_action(v_study, 'review', '{"reviewComment":"self"}'::jsonb);
    RAISE EXCEPTION 'performer review should have failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%reviewer must not be the performer%' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    PERFORM set_config('mixing_study.workflow', '', true);
    UPDATE public.medical_mixing_studies SET status = 'reviewed' WHERE id = v_study;
    RAISE EXCEPTION 'direct status update should have failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%only be updated through the workflow%' THEN
      RAISE;
    END IF;
  END;

  PERFORM set_config('app.test_user_id', v_performer::text, true);
  v_draft := (public.create_mixing_study('pt')->>'id')::uuid;
  BEGIN
    PERFORM set_config('app.test_user_id', v_reviewer::text, true);
    PERFORM public.perform_mixing_study_action(v_draft, 'review', '{}'::jsonb);
    RAISE EXCEPTION 'review before submission should have failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%skipped%' THEN
      RAISE;
    END IF;
  END;

  PERFORM set_config('app.test_user_id', v_reviewer::text, true);

  PERFORM public.perform_mixing_study_action(v_study, 'review', '{"reviewComment":"Independent review"}'::jsonb);
  IF (SELECT status FROM public.medical_mixing_studies WHERE id = v_study) <> 'reviewed' THEN
    RAISE EXCEPTION 'independent review did not complete';
  END IF;
  IF (SELECT reviewed_by FROM public.medical_mixing_studies WHERE id = v_study) = v_performer THEN
    RAISE EXCEPTION 'reviewer equals performer';
  END IF;

  BEGIN
    PERFORM set_config('mixing_study.workflow', '1', true);
    UPDATE public.medical_mixing_studies SET review_comment = 'changed' WHERE id = v_study;
    RAISE EXCEPTION 'reviewed study update should have failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%locked%' THEN
      RAISE;
    END IF;
  END;

  IF EXISTS (
    SELECT 1 FROM public.medical_mixing_study_events
    WHERE study_id = v_study
      AND (COALESCE(actor_name, '') ILIKE '%ACC-%' OR COALESCE(actor_staff_id, '') ILIKE '%ACC-%')
  ) THEN
    RAISE EXCEPTION 'audit metadata contains a sample identifier';
  END IF;
END $$;

SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM set_config('app.test_user_id', '02300000-0000-4000-8000-000000000003', true);
  IF (SELECT count(*) FROM public.medical_mixing_studies) <> 0 THEN
    RAISE EXCEPTION 'user without medical report view can see mixing studies';
  END IF;
END $$;

DO $$
BEGIN
  PERFORM sample_reference_ciphertext FROM public.medical_mixing_studies LIMIT 1;
  RAISE EXCEPTION 'ciphertext column should not be selectable';
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END $$;
RESET ROLE;

ROLLBACK;
