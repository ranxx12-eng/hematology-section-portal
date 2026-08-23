-- ============================================================================
-- Migration 031: Audited staff RBAC remediation (6 users only)
-- Adds review permissions, aligns role grants, assigns supplemental roles.
-- Idempotent. Never hard-deletes role_permissions.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Review permissions (permission-based UI + RLS via has_permission)
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (code, module, description) VALUES
  ('critical_values.review', 'clinical', 'Review critical value records'),
  ('sample_rejections.review', 'clinical', 'Supervisor review of sample rejections')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN ('critical_values.review', 'sample_rejections.review')
WHERE r.name IN (
  'section_supervisor',
  'head_of_section',
  'quality_officer',
  'lab_manager',
  'lab_director',
  'system_admin'
)
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;

-- Quality Officer: KPI manage (view already granted)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'kpi.manage'
WHERE r.name = 'quality_officer'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;

-- Lab Technologist: KPI view for operational reporting (Mousa + lab tech accounts)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'kpi.view'
WHERE r.name = 'lab_technologist'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;

-- Ensure lab technologist operational permissions remain active
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'critical_values.view',
  'critical_values.manage',
  'sample_rejections.view',
  'sample_rejections.manage',
  'corrected_results.view',
  'qc.view',
  'qc.manage',
  'maintenance.view',
  'tat.view',
  'tasks.view',
  'instruments.view',
  'training.view',
  'documents.view',
  'notifications.view',
  'announcements.view',
  'calendar.view',
  'cms.view'
)
WHERE r.name = 'lab_technologist'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Effective permissions RPC (UI + server alignment with has_permission)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS SETOF TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT perm.code
  FROM public.profiles p
  JOIN public.role_permissions rp ON rp.role_id = p.primary_role_id AND rp.deleted_at IS NULL
  JOIN public.permissions perm ON perm.id = rp.permission_id
  WHERE p.id = auth.uid()
    AND p.deleted_at IS NULL
    AND p.is_active = TRUE
  UNION
  SELECT DISTINCT perm.code
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_id = ur.role_id AND rp.deleted_at IS NULL
  JOIN public.permissions perm ON perm.id = rp.permission_id
  WHERE ur.user_id = auth.uid()
    AND ur.is_active = TRUE
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW());
$$;

REVOKE ALL ON FUNCTION public.get_my_permissions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_permissions() TO authenticated;

-- ---------------------------------------------------------------------------
-- User-specific remediation (six audited accounts only)
-- ---------------------------------------------------------------------------

-- 1. Rawan Alfaifi — quality_officer primary + senior_lab operational supplement
INSERT INTO public.user_roles (user_id, role_id, is_active)
SELECT p.id, r.id, TRUE
FROM public.profiles p
CROSS JOIN public.roles r
WHERE p.email = 'rawan.alfaifi@drsulaimanalhabib.com'
  AND r.name = 'senior_lab_technologist'
ON CONFLICT (user_id, role_id) DO UPDATE
  SET is_active = TRUE,
      expires_at = NULL,
      updated_at = NOW();

-- 2. Abdullah Alghayamh — senior_lab primary + supervisor + inventory supplements
INSERT INTO public.user_roles (user_id, role_id, is_active)
SELECT p.id, r.id, TRUE
FROM public.profiles p
CROSS JOIN public.roles r
WHERE p.email = 'abdullah.alghayamh@drsulaimanalhabib.com'
  AND r.name IN ('section_supervisor', 'inventory_officer')
ON CONFLICT (user_id, role_id) DO UPDATE
  SET is_active = TRUE,
      expires_at = NULL,
      updated_at = NOW();

-- 3. Mousa Alrashedi — inventory_officer primary + lab technologist supplement
INSERT INTO public.user_roles (user_id, role_id, is_active)
SELECT p.id, r.id, TRUE
FROM public.profiles p
CROSS JOIN public.roles r
WHERE p.email = 'mousa.alrashedi@hmg.local'
  AND r.name = 'lab_technologist'
ON CONFLICT (user_id, role_id) DO UPDATE
  SET is_active = TRUE,
      expires_at = NULL,
      updated_at = NOW();

-- 4. Ahmed Al-Asiri — lab_technologist primary only (Safety Officer role does not exist)
--    Operational lab technologist permissions ensured above; no supplemental roles.

-- 5. Alanoud Alhamdan — active account only: promote primary role to lab_technologist
UPDATE public.profiles p
SET primary_role_id = r.id,
    updated_at = NOW()
FROM public.roles r
WHERE p.email = 'alanoud.alhamdan@dr.sulaimanalhabib.com'
  AND r.name = 'lab_technologist';

-- 6. Renad Alimani — confirm lab_technologist primary
UPDATE public.profiles p
SET primary_role_id = r.id,
    updated_at = NOW()
FROM public.roles r
WHERE p.email = 'renad.alimani@hmg.local'
  AND r.name = 'lab_technologist';

INSERT INTO public.user_roles (user_id, role_id, is_active)
SELECT p.id, r.id, TRUE
FROM public.profiles p
CROSS JOIN public.roles r
WHERE p.email = 'renad.alimani@hmg.local'
  AND r.name = 'lab_technologist'
ON CONFLICT (user_id, role_id) DO UPDATE
  SET is_active = TRUE,
      expires_at = NULL,
      updated_at = NOW();

COMMIT;
