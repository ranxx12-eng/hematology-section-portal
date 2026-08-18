-- Restore maintenance.view for lab_technologist now that the maintenance module uses Supabase.
-- View only; maintenance.manage remains with senior_lab_technologist and above.

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'maintenance.view'
WHERE r.name = 'lab_technologist'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;
