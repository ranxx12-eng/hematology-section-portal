-- ============================================================================
-- Hematology Section Portal
-- Migration 005: RLS Helper Functions
-- All SECURITY DEFINER functions use fixed search_path and schema-qualified refs.
-- EXECUTE revoked from PUBLIC/anon; granted only to authenticated where needed.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.name
  FROM public.profiles p
  JOIN public.roles r ON r.id = p.primary_role_id
  WHERE p.id = auth.uid()
    AND p.deleted_at IS NULL
    AND p.is_active = TRUE;
$$;

CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.roles r ON r.id = p.primary_role_id
    WHERE p.id = auth.uid()
      AND p.deleted_at IS NULL
      AND p.is_active = TRUE
      AND r.name = 'system_admin'::public.app_role
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = TRUE
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      AND r.name = 'system_admin'::public.app_role
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(p_roles public.app_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_system_admin()
    OR public.current_profile_role() = ANY (p_roles)
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.is_active = TRUE
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        AND r.name = ANY (p_roles)
    );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_permission IS NOT NULL
    AND length(p_permission) <= 128
    AND (
      EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.role_permissions rp ON rp.role_id = p.primary_role_id
        JOIN public.permissions perm ON perm.id = rp.permission_id
        WHERE p.id = auth.uid()
          AND p.deleted_at IS NULL
          AND p.is_active = TRUE
          AND perm.code = p_permission
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON rp.role_id = ur.role_id
        JOIN public.permissions perm ON perm.id = rp.permission_id
        WHERE ur.user_id = auth.uid()
          AND ur.is_active = TRUE
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
          AND perm.code = p_permission
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.has_clinical_phi_access()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_permission('critical_values.view')
    OR public.has_permission('sample_rejections.view')
    OR public.has_permission('corrected_results.view');
$$;

CREATE OR REPLACE FUNCTION public.has_full_phi_access()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_permission('critical_values.manage')
    OR public.has_permission('sample_rejections.manage')
    OR public.has_permission('corrected_results.manage');
$$;

CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.employee_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.deleted_at IS NULL
    AND p.is_active = TRUE;
$$;

CREATE OR REPLACE FUNCTION public.can_view_evaluations()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(ARRAY[
    'lab_director'::public.app_role,
    'lab_manager'::public.app_role,
    'head_of_section'::public.app_role,
    'section_supervisor'::public.app_role
  ])
  OR public.has_permission('employees.evaluate');
$$;

CREATE OR REPLACE FUNCTION public.is_active_row(p_deleted_at TIMESTAMPTZ)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.is_valid_storage_path(p_path TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_path IS NOT NULL
    AND length(p_path) <= 1024
    AND p_path !~ '\.\.'
    AND p_path !~ '^/'
    AND p_path ~ '^[a-zA-Z0-9/_\-.]+$';
$$;

-- Revoke default public execute; grant only to authenticated
REVOKE ALL ON FUNCTION public.current_profile_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_system_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(public.app_role[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_permission(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_clinical_phi_access() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_full_phi_access() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_employee_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_evaluations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_row(TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_valid_storage_path(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_profile_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_system_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_clinical_phi_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_full_phi_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_employee_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_evaluations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_row(TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_storage_path(TEXT) TO authenticated;
