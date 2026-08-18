-- Grant system_admin full operational view/manage permissions for production modules.
-- Aligns DB role_permissions with portal UI (roles.ts) and RLS has_permission() checks.
-- Idempotent: restores soft-deleted grants via ON CONFLICT ... DO UPDATE (migration 015 pattern).
-- Does not modify other roles or weaken RLS.

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'reports.view',
  'reports.approve',
  'reports.manage',
  'kpi.view',
  'kpi.manage',
  'employees.manage',
  'employees.evaluate',
  'tasks.view',
  'tasks.manage',
  'tasks.approve',
  'instruments.manage',
  'maintenance.view',
  'maintenance.manage',
  'training.view',
  'training.manage',
  'competencies.view',
  'competencies.manage',
  'documents.view',
  'documents.manage',
  'inventory.view',
  'inventory.manage',
  'meetings.view',
  'meetings.manage',
  'risk.view',
  'risk.manage',
  'capa.view',
  'capa.manage',
  'notifications.view',
  'media.view',
  'media.manage',
  'forms.view',
  'forms.manage',
  'announcements.view',
  'announcements.manage',
  'calendar.view',
  'calendar.manage',
  'report_builder.view',
  'report_builder.manage'
)
WHERE r.name = 'system_admin'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;
