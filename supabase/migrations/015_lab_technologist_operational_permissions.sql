-- Grant lab technologist operational permissions for production clinical modules.
-- Excludes maintenance (UI still mock-based; see maintenance/page.tsx).
-- Does not grant admin, user management, or system configuration permissions.
-- role_permissions uses soft delete (hard DELETE blocked by prevent_hard_delete trigger).

ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Permission checks must ignore soft-deleted role_permissions rows.
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
          AND rp.deleted_at IS NULL
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
          AND rp.deleted_at IS NULL
          AND perm.code = p_permission
      )
    );
$$;

REVOKE ALL ON FUNCTION public.has_permission(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permission(TEXT) TO authenticated;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'critical_values.manage',
  'sample_rejections.manage',
  'qc.manage'
)
WHERE r.name = 'lab_technologist'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'critical_values.manage',
  'sample_rejections.manage'
)
WHERE r.name = 'senior_lab_technologist'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;

-- Maintenance page is mock-only; soft-revoke view access so production users are not routed to a crashing page.
UPDATE public.role_permissions rp
SET deleted_at = NOW()
FROM public.roles r, public.permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.name = 'lab_technologist'
  AND p.code = 'maintenance.view'
  AND rp.deleted_at IS NULL;
