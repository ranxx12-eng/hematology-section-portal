-- Grant lab technologist operational permissions for production clinical modules.
-- Excludes maintenance (UI still mock-based; see maintenance/page.tsx).
-- Does not grant admin, user management, or system configuration permissions.

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'critical_values.manage',
  'sample_rejections.manage',
  'qc.manage'
)
WHERE r.name = 'lab_technologist'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'critical_values.manage',
  'sample_rejections.manage'
)
WHERE r.name = 'senior_lab_technologist'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Maintenance page is mock-only; revoke view access so production users are not routed to a crashing page.
DELETE FROM public.role_permissions rp
USING public.roles r, public.permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.name = 'lab_technologist'
  AND p.code = 'maintenance.view';
