-- ============================================================================
-- Migration 068 upgrade fixtures — simulates post-067 profile edge cases
-- LOCAL ONLY. Creates disposable auth users, lets handle_new_user create profiles,
-- then updates those profiles for each scenario.
-- ============================================================================

\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_lab_tech_role UUID;
  v_quality_officer_role UUID;
  v_user_unique UUID := gen_random_uuid();
  v_user_missing UUID := gen_random_uuid();
  v_user_dup_a UUID := gen_random_uuid();
  v_user_dup_b UUID := gen_random_uuid();
  v_user_email_conflict UUID := gen_random_uuid();
  v_user_already_linked UUID := gen_random_uuid();
  v_employee_conflict UUID := gen_random_uuid();
  v_employee_linked UUID := gen_random_uuid();
  v_linked UUID;
  v_employees INT;
  v_null_hire INT;
  v_dup_linked_count INT;
BEGIN
  SELECT id INTO v_lab_tech_role FROM public.roles WHERE name = 'lab_technologist'::public.app_role;
  SELECT id INTO v_quality_officer_role FROM public.roles WHERE name = 'quality_officer'::public.app_role;

  IF v_lab_tech_role IS NULL OR v_quality_officer_role IS NULL THEN
    RAISE EXCEPTION 'Required roles missing for 068 upgrade fixtures';
  END IF;

  -- Pre-create employees for email-conflict and already-linked scenarios
  INSERT INTO public.employees (
    id, employee_code, full_name, email, job_title, role, section, hire_date, employment_status, is_active
  ) VALUES
    (
      v_employee_conflict,
      'CONFLICT-001',
      'Existing Employee',
      'conflict.upgrade@example.test',
      'Technologist',
      'lab_technologist',
      'Hematology',
      NULL,
      'active',
      TRUE
    ),
    (
      v_employee_linked,
      'UPG-LINKED',
      'Already Linked Employee',
      'linked.upgrade@example.test',
      'Technologist',
      'quality_officer',
      'Hematology',
      NULL,
      'active',
      TRUE
    );

  -- Disposable local auth users; handle_new_user creates profiles automatically.
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    (
      '00000000-0000-0000-0000-000000000000',
      v_user_unique, 'authenticated', 'authenticated',
      'unique.upgrade@example.test', crypt('test-password', gen_salt('bf')),
      NOW(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Unique Staff"}'::jsonb, NOW(), NOW()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_user_missing, 'authenticated', 'authenticated',
      'missing.upgrade@example.test', crypt('test-password', gen_salt('bf')),
      NOW(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Missing Staff ID"}'::jsonb, NOW(), NOW()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_user_dup_a, 'authenticated', 'authenticated',
      'dup-a.upgrade@example.test', crypt('test-password', gen_salt('bf')),
      NOW(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Duplicate A"}'::jsonb, NOW(), NOW()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_user_dup_b, 'authenticated', 'authenticated',
      'dup-b.upgrade@example.test', crypt('test-password', gen_salt('bf')),
      NOW(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Duplicate B"}'::jsonb, NOW(), NOW()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_user_email_conflict, 'authenticated', 'authenticated',
      'conflict.upgrade@example.test', crypt('test-password', gen_salt('bf')),
      NOW(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Email Conflict"}'::jsonb, NOW(), NOW()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_user_already_linked, 'authenticated', 'authenticated',
      'linked.upgrade@example.test', crypt('test-password', gen_salt('bf')),
      NOW(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Already Linked"}'::jsonb, NOW(), NOW()
    );

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_unique) THEN
    RAISE EXCEPTION 'handle_new_user did not create profile for unique user';
  END IF;

  -- Unique staff_id: update generated profile, then sync
  UPDATE public.profiles
  SET primary_role_id = v_lab_tech_role, staff_id = 'UPG-UNIQUE', updated_at = NOW()
  WHERE id = v_user_unique;

  v_linked := public.sync_employee_profile_by_staff_id(v_user_unique);
  IF v_linked IS NULL THEN
    RAISE EXCEPTION 'Expected unique staff_id profile to sync';
  END IF;

  -- Missing staff_id: generated profile stays without staff_id
  UPDATE public.profiles
  SET primary_role_id = v_lab_tech_role, updated_at = NOW()
  WHERE id = v_user_missing;

  IF public.sync_employee_profile_by_staff_id(v_user_missing) IS NOT NULL THEN
    RAISE EXCEPTION 'Missing staff_id profile must not sync';
  END IF;

  -- Duplicate staff_id: unique index must reject the second assignment
  UPDATE public.profiles
  SET primary_role_id = v_lab_tech_role, staff_id = 'UPG-DUP', updated_at = NOW()
  WHERE id = v_user_dup_a;

  BEGIN
    UPDATE public.profiles
    SET staff_id = 'UPG-DUP', updated_at = NOW()
    WHERE id = v_user_dup_b;
    RAISE EXCEPTION 'Expected unique_violation when assigning duplicate normalized staff_id';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  IF (SELECT staff_id FROM public.profiles WHERE id = v_user_dup_b) IS NOT NULL THEN
    RAISE EXCEPTION 'Rejected duplicate profile must retain NULL staff_id';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_user_dup_b AND employee_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Rejected duplicate profile must not link an employee';
  END IF;

  IF public.sync_employee_profile_by_staff_id(v_user_dup_b) IS NOT NULL THEN
    RAISE EXCEPTION 'Sync must not succeed for profile without staff_id after duplicate rejection';
  END IF;

  v_linked := public.sync_employee_profile_by_staff_id(v_user_dup_a);
  IF v_linked IS NULL THEN
    RAISE EXCEPTION 'Expected first profile with UPG-DUP to sync after duplicate rejection';
  END IF;

  -- Email conflict: same email as existing employee, different staff id
  UPDATE public.profiles
  SET primary_role_id = v_lab_tech_role, staff_id = 'UPG-EMAIL', updated_at = NOW()
  WHERE id = v_user_email_conflict;

  IF public.sync_employee_profile_by_staff_id(v_user_email_conflict) IS NOT NULL THEN
    RAISE EXCEPTION 'Email conflict profile must not sync';
  END IF;

  -- Already linked: staff_id must match employee_code
  UPDATE public.profiles
  SET
    primary_role_id = v_quality_officer_role,
    staff_id = 'UPG-LINKED',
    employee_id = v_employee_linked,
    updated_at = NOW()
  WHERE id = v_user_already_linked;

  v_linked := public.sync_employee_profile_by_staff_id(v_user_already_linked);
  IF v_linked IS DISTINCT FROM v_employee_linked THEN
    RAISE EXCEPTION 'Already-linked sync must return existing employee %, got %',
      v_employee_linked, v_linked;
  END IF;

  SELECT count(*) INTO v_dup_linked_count
  FROM public.employees
  WHERE deleted_at IS NULL
    AND employee_code = 'UPG-LINKED';

  IF v_dup_linked_count <> 1 THEN
    RAISE EXCEPTION 'Already-linked scenario must keep exactly one UPG-LINKED employee, got %',
      v_dup_linked_count;
  END IF;

  SELECT count(*) INTO v_employees
  FROM public.employees
  WHERE deleted_at IS NULL
    AND employee_code IN ('UPG-UNIQUE', 'UPG-DUP', 'UPG-EMAIL', 'UPG-LINKED', 'CONFLICT-001');

  IF v_employees <> 4 THEN
    RAISE EXCEPTION 'Expected exactly 4 employees from upgrade fixtures, got %', v_employees;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.employees
    WHERE deleted_at IS NULL AND employee_code = 'UPG-EMAIL'
  ) THEN
    RAISE EXCEPTION 'Email-conflict scenario must not create UPG-EMAIL employee';
  END IF;

  SELECT count(*) INTO v_null_hire
  FROM public.employees
  WHERE deleted_at IS NULL
    AND employee_code = 'UPG-UNIQUE'
    AND hire_date IS NULL;

  IF v_null_hire <> 1 THEN
    RAISE EXCEPTION 'Synced employee must have NULL hire_date';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    JOIN public.roles r ON r.id = rp.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE r.name = 'quality_officer'::public.app_role
      AND p.code = 'employees.manage'
      AND rp.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'quality_officer employees.manage missing after fixtures';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    JOIN public.roles r ON r.id = rp.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE r.name = 'quality_link'::public.app_role
      AND p.code = 'employees.manage'
      AND rp.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'quality_link employees.manage missing after fixtures';
  END IF;
END;
$$;

\echo 'Migration 068 upgrade fixture verification passed.'
