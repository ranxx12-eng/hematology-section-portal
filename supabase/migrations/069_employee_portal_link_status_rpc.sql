-- ============================================================================
-- Migration 069: RLS-safe employee portal link status for task assignment pickers
-- Additive only. Does not modify migrations 001–068.
--
-- Root cause: migration 067 allows tasks.manage users to read employees, but
-- profiles_select still requires employees.view. Task managers therefore see
-- employee rows but cannot read linked profile rows through PostgREST/RLS.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.fetch_employee_portal_link_status()
RETURNS TABLE (
  employee_id UUID,
  portal_linked BOOLEAN,
  portal_login_active BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF NOT (
    public.has_permission('employees.view')
    OR public.has_permission('tasks.manage')
    OR public.has_permission('tasks.review')
    OR public.has_permission('tasks.approve')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    e.id AS employee_id,
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.deleted_at IS NULL
        AND p.employee_id = e.id
    ) AS portal_linked,
    COALESCE(
      (
        SELECT p.is_active
        FROM public.profiles p
        WHERE p.deleted_at IS NULL
          AND p.employee_id = e.id
        ORDER BY p.created_at
        LIMIT 1
      ),
      FALSE
    ) AS portal_login_active
  FROM public.employees e
  WHERE e.deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.fetch_employee_portal_link_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_employee_portal_link_status() TO authenticated;

-- Align DB role permissions with app expectations for roster/profile visibility.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'employees.view'
WHERE r.name IN (
  'quality_officer'::public.app_role,
  'quality_link'::public.app_role,
  'senior_lab_technologist'::public.app_role
)
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;

COMMIT;
