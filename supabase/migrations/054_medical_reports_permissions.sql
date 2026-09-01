-- ============================================================================
-- Migration 054: Medical Reports module permissions
-- UI/navigation shell only — no report tables in this phase.
-- Does NOT auto-apply.
-- ============================================================================

BEGIN;

INSERT INTO public.permissions (code, module, description) VALUES
  ('medical_reports.view', 'medical_reports', 'View medical reports and worksheets'),
  ('medical_reports.create', 'medical_reports', 'Create medical reports and worksheets'),
  ('medical_reports.edit', 'medical_reports', 'Edit medical reports and worksheets'),
  ('medical_reports.review', 'medical_reports', 'Review medical reports and worksheets'),
  ('medical_reports.approve', 'medical_reports', 'Approve medical reports and worksheets'),
  ('medical_reports.print', 'medical_reports', 'Print or export medical reports')
ON CONFLICT (code) DO UPDATE SET
  module = EXCLUDED.module,
  description = EXCLUDED.description;

-- system_admin: all medical_reports permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code LIKE 'medical_reports.%'
WHERE r.name = 'system_admin'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

-- lab_technologist: view, create
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN ('medical_reports.view', 'medical_reports.create')
WHERE r.name = 'lab_technologist'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

-- senior_lab_technologist: view, create, review, print
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'medical_reports.view', 'medical_reports.create', 'medical_reports.review', 'medical_reports.print'
)
WHERE r.name = 'senior_lab_technologist'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

-- section_supervisor: view, review, approve, print
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'medical_reports.view', 'medical_reports.review', 'medical_reports.approve', 'medical_reports.print'
)
WHERE r.name = 'section_supervisor'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

-- quality_officer: view, print
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN ('medical_reports.view', 'medical_reports.print')
WHERE r.name IN ('quality_officer', 'quality_link')
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

-- head_of_section, lab_manager, lab_director: view
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'medical_reports.view'
WHERE r.name IN ('head_of_section', 'lab_manager', 'lab_director')
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

COMMIT;
