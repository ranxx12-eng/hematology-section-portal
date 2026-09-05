-- ============================================================================
-- Migration 068: Recover HR employee rows from existing portal profiles
-- Idempotent. Additive only. No new auth users or profiles.
--
-- Production expectation (pre-migration audit):
--   auth.users 14 | profiles 14 | employees 0 | linked profiles 0
--   profiles with staff_id 12 | profiles without staff_id 2
--
-- Post-migration expectation:
--   employees 12 | linked profiles 12 | new auth 0 | new profiles 0
--   2 profiles without staff_id remain unlinked until HR assigns Staff ID
--   recovered employees hire_date NULL (portal account creation date is not hire date)
-- ============================================================================

BEGIN;

-- Portal account creation date is not employment hire date.
ALTER TABLE public.employees
  ALTER COLUMN hire_date DROP NOT NULL;

-- Neutral HR placeholder — not derived from portal permission role labels.
-- employees.role is operational roster metadata only; portal authorization lives on
-- profiles.primary_role_id. Migration seeds employees.role from the profile role
-- because the column is required, but that value is not the authorization source.
CREATE OR REPLACE FUNCTION public.recovery_default_job_title()
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'Pending HR Update'::TEXT;
$$;

CREATE OR REPLACE FUNCTION public.normalize_staff_code(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(lower(trim(p_value)), '');
$$;

-- ---------------------------------------------------------------------------
-- Core sync: create/link employee from profile using Hospital Staff ID only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_employee_profile_by_staff_id(p_profile_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_employee_id UUID;
  v_role_name public.app_role;
  v_staff_code TEXT;
BEGIN
  SELECT
    p.id,
    trim(p.staff_id) AS staff_id,
    p.full_name,
    p.email,
    p.is_active,
    p.employee_id,
    p.created_at,
    r.name AS role_name
  INTO v_profile
  FROM public.profiles p
  JOIN public.roles r ON r.id = p.primary_role_id
  WHERE p.id = p_profile_id
    AND p.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_staff_code := NULLIF(trim(v_profile.staff_id), '');
  IF v_staff_code IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_profile.employee_id IS NOT NULL THEN
    RETURN v_profile.employee_id;
  END IF;

  -- Reject ambiguous staff_id (multiple live profiles share the same code)
  IF (
    SELECT COUNT(*)
    FROM public.profiles p2
    WHERE p2.deleted_at IS NULL
      AND public.normalize_staff_code(p2.staff_id) = public.normalize_staff_code(v_staff_code)
  ) > 1 THEN
    RETURN NULL;
  END IF;

  -- Reject email collision with a different employee_code
  IF EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.deleted_at IS NULL
      AND lower(e.email::text) = lower(v_profile.email::text)
      AND public.normalize_staff_code(e.employee_code) IS DISTINCT FROM public.normalize_staff_code(v_staff_code)
  ) THEN
    RETURN NULL;
  END IF;

  SELECT e.id INTO v_employee_id
  FROM public.employees e
  WHERE e.deleted_at IS NULL
    AND public.normalize_staff_code(e.employee_code) = public.normalize_staff_code(v_staff_code)
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    v_role_name := v_profile.role_name;

    INSERT INTO public.employees (
      employee_code,
      full_name,
      email,
      job_title,
      role,
      section,
      hire_date,
      employment_status,
      is_active,
      created_by
    )
    VALUES (
      v_staff_code,
      v_profile.full_name,
      v_profile.email,
      public.recovery_default_job_title(),
      v_role_name,
      'Hematology',
      NULL,
      CASE
        WHEN v_profile.is_active THEN 'active'::public.employment_status
        ELSE 'inactive'::public.employment_status
      END,
      v_profile.is_active,
      auth.uid()
    )
    ON CONFLICT (employee_code) DO NOTHING
    RETURNING id INTO v_employee_id;

    IF v_employee_id IS NULL THEN
      SELECT e.id INTO v_employee_id
      FROM public.employees e
      WHERE e.deleted_at IS NULL
        AND public.normalize_staff_code(e.employee_code) = public.normalize_staff_code(v_staff_code)
      LIMIT 1;
    END IF;
  END IF;

  IF v_employee_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Do not steal an employee link from another profile
  IF EXISTS (
    SELECT 1
    FROM public.profiles p3
    WHERE p3.deleted_at IS NULL
      AND p3.employee_id = v_employee_id
      AND p3.id <> p_profile_id
  ) THEN
    RETURN NULL;
  END IF;

  UPDATE public.profiles
  SET employee_id = v_employee_id, updated_at = NOW()
  WHERE id = p_profile_id
    AND deleted_at IS NULL
    AND employee_id IS NULL;

  RETURN v_employee_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_profile_for_employee(p_employee_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee RECORD;
  v_profile_id UUID;
BEGIN
  SELECT e.id, trim(e.employee_code) AS employee_code
  INTO v_employee
  FROM public.employees e
  WHERE e.id = p_employee_id
    AND e.deleted_at IS NULL;

  IF NOT FOUND OR v_employee.employee_code IS NULL OR length(trim(v_employee.employee_code)) = 0 THEN
    RETURN NULL;
  END IF;

  IF (
    SELECT COUNT(*)
    FROM public.profiles p2
    WHERE p2.deleted_at IS NULL
      AND public.normalize_staff_code(p2.staff_id) = public.normalize_staff_code(v_employee.employee_code)
  ) > 1 THEN
    RETURN NULL;
  END IF;

  SELECT p.id INTO v_profile_id
  FROM public.profiles p
  WHERE p.deleted_at IS NULL
    AND p.employee_id IS NULL
    AND public.normalize_staff_code(p.staff_id) = public.normalize_staff_code(v_employee.employee_code)
  ORDER BY p.created_at
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.profiles
  SET employee_id = p_employee_id, updated_at = NOW()
  WHERE id = v_profile_id
    AND deleted_at IS NULL
    AND employee_id IS NULL;

  RETURN v_profile_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Automatic sync when Staff ID is assigned on an existing profile
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_profiles_sync_employee_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.staff_id IS NOT NULL
     AND length(trim(NEW.staff_id)) > 0
     AND NEW.employee_id IS NULL THEN
    PERFORM public.sync_employee_profile_by_staff_id(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_sync_employee_link ON public.profiles;
CREATE TRIGGER trg_profiles_sync_employee_link
  AFTER INSERT OR UPDATE OF staff_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_profiles_sync_employee_link();

CREATE OR REPLACE FUNCTION public.trg_employees_sync_profile_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NULL THEN
    PERFORM public.sync_profile_for_employee(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employees_sync_profile_link ON public.employees;
CREATE TRIGGER trg_employees_sync_profile_link
  AFTER INSERT OR UPDATE OF employee_code ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_employees_sync_profile_link();

-- Audit employee roster changes (create/update/soft-delete)
DROP TRIGGER IF EXISTS trg_audit_employees ON public.employees;
CREATE TRIGGER trg_audit_employees
  AFTER INSERT OR UPDATE OR DELETE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger_fn();

-- ---------------------------------------------------------------------------
-- RPC: manual link by Hospital Staff ID (employees.manage)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_employee_to_portal_account(p_employee_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee RECORD;
  v_profile_id UUID;
  v_profile_count INT;
BEGIN
  IF NOT public.has_permission('employees.manage') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT e.id, trim(e.employee_code) AS employee_code
  INTO v_employee
  FROM public.employees e
  WHERE e.id = p_employee_id
    AND e.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'employee_not_found');
  END IF;

  IF v_employee.employee_code IS NULL OR length(trim(v_employee.employee_code)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'missing_staff_id');
  END IF;

  SELECT COUNT(*) INTO v_profile_count
  FROM public.profiles p
  WHERE p.deleted_at IS NULL
    AND public.normalize_staff_code(p.staff_id) = public.normalize_staff_code(v_employee.employee_code);

  IF v_profile_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'no_portal_account',
      'message', 'No portal account with matching Hospital Staff ID. Portal account required for My Tasks and notifications.'
    );
  END IF;

  IF v_profile_count > 1 THEN
    RETURN jsonb_build_object('success', false, 'code', 'ambiguous_staff_id');
  END IF;

  SELECT p.id INTO v_profile_id
  FROM public.profiles p
  WHERE p.deleted_at IS NULL
    AND public.normalize_staff_code(p.staff_id) = public.normalize_staff_code(v_employee.employee_code)
  LIMIT 1;

  IF EXISTS (
    SELECT 1 FROM public.profiles p2
    WHERE p2.deleted_at IS NULL
      AND p2.employee_id = p_employee_id
      AND p2.id <> v_profile_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'employee_already_linked');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles p3
    WHERE p3.deleted_at IS NULL
      AND p3.id = v_profile_id
      AND p3.employee_id IS NOT NULL
      AND p3.employee_id <> p_employee_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'profile_already_linked');
  END IF;

  UPDATE public.profiles
  SET employee_id = p_employee_id, updated_at = NOW()
  WHERE id = v_profile_id
    AND deleted_at IS NULL
    AND (employee_id IS NULL OR employee_id = p_employee_id);

  RETURN jsonb_build_object(
    'success', true,
    'code', 'linked',
    'profile_id', v_profile_id,
    'employee_id', p_employee_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.recovery_default_job_title() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.normalize_staff_code(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_employee_profile_by_staff_id(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_profile_for_employee(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_employee_to_portal_account(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.link_employee_to_portal_account(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Idempotent backfill: all live profiles with verified unique staff_id
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_profile RECORD;
  v_linked UUID;
  v_linked_count INT := 0;
  v_skipped_count INT := 0;
BEGIN
  FOR v_profile IN
    SELECT p.id
    FROM public.profiles p
    WHERE p.deleted_at IS NULL
      AND p.employee_id IS NULL
      AND p.staff_id IS NOT NULL
      AND length(trim(p.staff_id)) > 0
      AND (
        SELECT COUNT(*)
        FROM public.profiles p2
        WHERE p2.deleted_at IS NULL
          AND public.normalize_staff_code(p2.staff_id) = public.normalize_staff_code(p.staff_id)
      ) = 1
    ORDER BY p.created_at
  LOOP
    v_linked := public.sync_employee_profile_by_staff_id(v_profile.id);
    IF v_linked IS NOT NULL THEN
      v_linked_count := v_linked_count + 1;
    ELSE
      v_skipped_count := v_skipped_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Migration 068 backfill: linked % profile(s), skipped % ambiguous/conflicting profile(s)', v_linked_count, v_skipped_count;
END;
$$;

-- Post-migration verification (counts only)
DO $$
DECLARE
  v_auth_users INT;
  v_profiles INT;
  v_employees INT;
  v_linked INT;
  v_awaiting_staff_id INT;
  v_dup_codes INT;
  v_null_hire_dates INT;
BEGIN
  SELECT count(*) INTO v_auth_users FROM auth.users;
  SELECT count(*) INTO v_profiles FROM public.profiles WHERE deleted_at IS NULL;
  SELECT count(*) INTO v_employees FROM public.employees WHERE deleted_at IS NULL;
  SELECT count(*) INTO v_linked FROM public.profiles WHERE deleted_at IS NULL AND employee_id IS NOT NULL;
  SELECT count(*) INTO v_awaiting_staff_id
  FROM public.profiles
  WHERE deleted_at IS NULL
    AND employee_id IS NULL
    AND (staff_id IS NULL OR length(trim(staff_id)) = 0);
  SELECT count(*) INTO v_dup_codes
  FROM (
    SELECT lower(trim(employee_code))
    FROM public.employees
    WHERE deleted_at IS NULL
    GROUP BY 1
    HAVING count(*) > 1
  ) d;
  SELECT count(*) INTO v_null_hire_dates
  FROM public.employees
  WHERE deleted_at IS NULL AND hire_date IS NULL;

  RAISE NOTICE 'Migration 068 verify: auth.users=% profiles=% employees=% linked_profiles=% awaiting_staff_id=% duplicate_employee_codes=% employees_with_null_hire_date=%',
    v_auth_users, v_profiles, v_employees, v_linked, v_awaiting_staff_id, v_dup_codes, v_null_hire_dates;
END;
$$;

-- ---------------------------------------------------------------------------
-- Permissions: Quality Officer and Quality Link maintain Hematology staff roster
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'employees.manage'
WHERE r.name IN ('quality_officer'::public.app_role, 'quality_link'::public.app_role)
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;

COMMIT;
