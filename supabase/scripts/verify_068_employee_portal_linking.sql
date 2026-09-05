-- ============================================================================
-- Migration 068 verification — LOCAL / DISPOSABLE DATABASE ONLY
-- Run after applying migrations 001–068. Never run against production.
-- ============================================================================

\set ON_ERROR_STOP on

DO $$
BEGIN
  IF current_database() ILIKE '%prod%' THEN
    RAISE EXCEPTION 'Refusing to verify migration 068 on a production-named database';
  END IF;
END;
$$;

-- Schema: hire_date nullable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employees'
      AND column_name = 'hire_date'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'employees.hire_date must be nullable after migration 068';
  END IF;
END;
$$;

-- Audit trigger on employees
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_audit_employees'
      AND tgrelid = 'public.employees'::regclass
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'trg_audit_employees must exist after migration 068';
  END IF;
END;
$$;

-- employees.manage granted to quality_officer and quality_link (restored if soft-deleted)
DO $$
DECLARE
  v_quality_officer BOOLEAN;
  v_quality_link BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.roles r
    JOIN public.role_permissions rp ON rp.role_id = r.id AND rp.deleted_at IS NULL
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE r.name = 'quality_officer'::public.app_role
      AND p.code = 'employees.manage'
  ) INTO v_quality_officer;

  SELECT EXISTS (
    SELECT 1
    FROM public.roles r
    JOIN public.role_permissions rp ON rp.role_id = r.id AND rp.deleted_at IS NULL
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE r.name = 'quality_link'::public.app_role
      AND p.code = 'employees.manage'
  ) INTO v_quality_link;

  IF NOT v_quality_officer THEN
    RAISE EXCEPTION 'quality_officer must have employees.manage';
  END IF;
  IF NOT v_quality_link THEN
    RAISE EXCEPTION 'quality_link must have employees.manage';
  END IF;
END;
$$;

-- lab_technologist must not receive employees.manage from migration 068
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.roles r
    JOIN public.role_permissions rp ON rp.role_id = r.id AND rp.deleted_at IS NULL
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE r.name = 'lab_technologist'::public.app_role
      AND p.code = 'employees.manage'
  ) THEN
    RAISE EXCEPTION 'lab_technologist must not have employees.manage';
  END IF;
END;
$$;

-- Sync functions present
DO $$
BEGIN
  IF to_regprocedure('public.sync_employee_profile_by_staff_id(uuid)') IS NULL THEN
    RAISE EXCEPTION 'sync_employee_profile_by_staff_id must exist';
  END IF;
  IF to_regprocedure('public.link_employee_to_portal_account(uuid)') IS NULL THEN
    RAISE EXCEPTION 'link_employee_to_portal_account must exist';
  END IF;
END;
$$;

-- Idempotent rerun: second backfill pass must not create duplicate employee codes
DO $$
DECLARE
  v_before INT;
  v_after INT;
  v_profile RECORD;
BEGIN
  SELECT count(*) INTO v_before
  FROM public.employees
  WHERE deleted_at IS NULL;

  FOR v_profile IN
    SELECT p.id
    FROM public.profiles p
    WHERE p.deleted_at IS NULL
      AND p.employee_id IS NULL
      AND p.staff_id IS NOT NULL
      AND length(trim(p.staff_id)) > 0
  LOOP
    PERFORM public.sync_employee_profile_by_staff_id(v_profile.id);
  END LOOP;

  SELECT count(*) INTO v_after
  FROM public.employees
  WHERE deleted_at IS NULL;

  IF v_after <> v_before THEN
    RAISE EXCEPTION 'Idempotent sync changed employee count (% -> %)', v_before, v_after;
  END IF;

  IF EXISTS (
    SELECT lower(trim(employee_code))
    FROM public.employees
    WHERE deleted_at IS NULL
    GROUP BY 1
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate employee_code values detected after idempotent rerun';
  END IF;
END;
$$;

\echo 'Migration 068 verification passed.'
