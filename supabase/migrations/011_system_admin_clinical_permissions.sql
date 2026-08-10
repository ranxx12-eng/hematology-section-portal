-- Grant system_admin operational clinical permissions to align with portal UI
-- and requirement that system_admin can operate all modules.

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'qc.view',
  'qc.manage',
  'critical_values.view',
  'critical_values.manage',
  'sample_rejections.view',
  'sample_rejections.manage',
  'corrected_results.view',
  'corrected_results.manage',
  'tat.view',
  'tat.manage',
  'instruments.view',
  'employees.view'
)
WHERE r.name = 'system_admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;
