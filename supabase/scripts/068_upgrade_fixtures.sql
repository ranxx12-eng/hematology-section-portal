-- ============================================================================
-- Migration 068 upgrade fixtures — simulates post-067 profile edge cases
-- LOCAL ONLY. Inserts disposable auth users + profiles, then exercises sync.
-- ============================================================================

\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_lab_tech_role UUID;
  v_quality_officer_role UUID;
  v_quality_link_role UUID;
  v_user_unique UUID := gen_random_uuid();
  v_user_missing UUID := gen_random_uuid();
  v_user_dup_a UUID := gen_random_uuid();
  v_user_dup_b UUID := gen_random_uuid();
  v_user_email_conflict UUID := gen_random_uuid();
  v_user_already_linked UUID := gen_random_uuid();
  v_employee_existing UUID := gen_random_uuid();
  v_linked UUID;
  v_employees INT;
  v_null_hire INT;
BEGIN
  SELECT id INTO v_lab_tech_role FROM public.roles WHERE name = 'lab_technologist'::public.app_role;
  SELECT id INTO v_quality_officer_role FROM public.roles WHERE name = 'quality_officer'::public.app_role;
  SELECT id INTO v_quality_link_role FROM public.roles WHERE name = 'quality_link'::public.app_role;

  IF v_lab_tech_role IS NULL OR v_quality_officer_role IS NULL OR v_quality_link_role IS NULL THEN
    RAISE EXCEPTION 'Required roles missing for 068 upgrade fixtures';
  END IF;

  -- Pre-create employee for email conflict scenario (same email, different staff id)
  INSERT INTO public.employees (
    id, employee_code, full_name, email, job_title, role, section, hire_date, employment_status, is_active
  ) VALUES (
    v_employee_existing,
    'CONFLICT-001',
    'Existing Employee',
    'conflict.upgrade@example.test',
    'Technologist',
    'lab_technologist',
    'Hematology',
    NULL,
    'active',
    TRUE
  );

  -- auth.users + profiles fixtures
  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (v_user_unique, 'authenticated', 'authenticated', 'unique.upgrade@example.test', crypt('test-password', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_user_missing, 'authenticated', 'authenticated', 'missing.upgrade@example.test', crypt('test-password', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_user_dup_a, 'authenticated', 'authenticated', 'dup-a.upgrade@example.test', crypt('test-password', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_user_dup_b, 'authenticated', 'authenticated', 'dup-b.upgrade@example.test', crypt('test-password', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_user_email_conflict, 'authenticated', 'authenticated', 'conflict.upgrade@example.test', crypt('test-password', gen_salt('bf')), NOW(), NOW(), NOW()),
    (v_user_already_linked, 'authenticated', 'authenticated', 'linked.upgrade@example.test', crypt('test-password', gen_salt('bf')), NOW(), NOW(), NOW());

  INSERT INTO public.profiles (id, email, full_name, primary_role_id, staff_id, employee_id, is_active)
  VALUES
    (v_user_unique, 'unique.upgrade@example.test', 'Unique Staff', v_lab_tech_role, 'UPG-UNIQUE', NULL, TRUE),
    (v_user_missing, 'missing.upgrade@example.test', 'Missing Staff ID', v_lab_tech_role, NULL, NULL, TRUE),
    (v_user_dup_a, 'dup-a.upgrade@example.test', 'Duplicate A', v_lab_tech_role, 'UPG-DUP', NULL, TRUE),
    (v_user_dup_b, 'dup-b.upgrade@example.test', 'Duplicate B', v_lab_tech_role, 'UPG-DUP', NULL, TRUE),
    (v_user_email_conflict, 'conflict.upgrade@example.test', 'Email Conflict', v_lab_tech_role, 'UPG-EMAIL', NULL, TRUE),
    (v_user_already_linked, 'linked.upgrade@example.test', 'Already Linked', v_quality_officer_role, 'UPG-LINKED', v_employee_existing, TRUE);

  -- Exercise sync for each scenario
  v_linked := public.sync_employee_profile_by_staff_id(v_user_unique);
  IF v_linked IS NULL THEN
    RAISE EXCEPTION 'Expected unique staff_id profile to sync';
  END IF;

  IF public.sync_employee_profile_by_staff_id(v_user_missing) IS NOT NULL THEN
    RAISE EXCEPTION 'Missing staff_id profile must not sync';
  END IF;

  IF public.sync_employee_profile_by_staff_id(v_user_dup_a) IS NOT NULL
     OR public.sync_employee_profile_by_staff_id(v_user_dup_b) IS NOT NULL THEN
    RAISE EXCEPTION 'Ambiguous staff_id profiles must not sync';
  END IF;

  IF public.sync_employee_profile_by_staff_id(v_user_email_conflict) IS NOT NULL THEN
    RAISE EXCEPTION 'Email conflict profile must not sync';
  END IF;

  IF public.sync_employee_profile_by_staff_id(v_user_already_linked) IS NOT DISTINCT FROM v_employee_existing THEN
    NULL; -- already linked, returns existing employee id
  END IF;

  SELECT count(*) INTO v_employees
  FROM public.employees
  WHERE deleted_at IS NULL
    AND employee_code IN ('UPG-UNIQUE', 'UPG-DUP', 'UPG-EMAIL', 'UPG-LINKED', 'CONFLICT-001');

  IF v_employees <> 2 THEN
    RAISE EXCEPTION 'Expected exactly 2 employees from upgrade fixtures (unique + pre-existing), got %', v_employees;
  END IF;

  SELECT count(*) INTO v_null_hire
  FROM public.employees
  WHERE deleted_at IS NULL
    AND employee_code = 'UPG-UNIQUE'
    AND hire_date IS NULL;

  IF v_null_hire <> 1 THEN
    RAISE EXCEPTION 'Synced employee must have NULL hire_date';
  END IF;

  -- Permission rows for quality roles
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
