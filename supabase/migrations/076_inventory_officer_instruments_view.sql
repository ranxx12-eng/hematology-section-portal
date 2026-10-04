-- Grant inventory_officer instruments.view so the Form-Hema-022 instrument
-- selector can read public.instruments under the existing instruments_select policy.
-- Does not grant instruments.manage or any other permission.

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'instruments.view'
WHERE r.name = 'inventory_officer'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;
