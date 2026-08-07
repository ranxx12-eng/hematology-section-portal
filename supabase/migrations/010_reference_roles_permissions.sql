-- ============================================================================
-- Hematology Section Portal
-- Migration 010: Reference Roles, Permissions & Public Settings
-- Production-safe reference data ONLY. No demo PHI or operational records.
-- Idempotent: safe to re-run after partial failure.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Fix audit_trigger_fn: do not assume every audited table has an id column.
-- role_permissions uses composite PK (role_id, permission_id).
-- Applied here (migration 010) without modifying migration 009.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_module TEXT;
  v_record_id UUID;
  v_old JSONB;
  v_new JSONB;
  v_uid UUID;
  v_source JSONB;
BEGIN
  v_uid := auth.uid();
  v_module := TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME;

  IF TG_OP = 'INSERT' THEN
    v_action := 'insert';
    v_new := to_jsonb(NEW);
    v_old := NULL;
    v_source := v_new;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_source := v_new;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_old := to_jsonb(OLD);
    v_new := NULL;
    v_source := v_old;
  END IF;

  -- Derive record_id only when the row JSON includes a UUID id column
  v_record_id := NULL;
  IF v_source IS NOT NULL AND v_source ? 'id' THEN
    BEGIN
      v_record_id := NULLIF(v_source->>'id', '')::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        v_record_id := NULL;
    END;
  END IF;

  -- Strip sensitive auth fields if ever present
  IF v_old IS NOT NULL THEN
    v_old := v_old - 'encrypted_password' - 'recovery_token' - 'confirmation_token';
  END IF;
  IF v_new IS NOT NULL THEN
    v_new := v_new - 'encrypted_password' - 'recovery_token' - 'confirmation_token';
  END IF;

  -- PHI tables: store accountability fields only
  IF TG_TABLE_NAME IN ('critical_values', 'sample_rejections', 'corrected_results', 'pending_samples') THEN
    IF v_old IS NOT NULL THEN
      v_old := jsonb_build_object(
        'id', v_old->'id',
        'record_date', COALESCE(v_old->'record_date', v_old->'rejection_date'),
        'department', COALESCE(v_old->'department', v_old->'department_name'),
        'updated_at', v_old->'updated_at'
      );
    END IF;
    IF v_new IS NOT NULL THEN
      v_new := jsonb_build_object(
        'id', v_new->'id',
        'record_date', COALESCE(v_new->'record_date', v_new->'rejection_date'),
        'department', COALESCE(v_new->'department', v_new->'department_name'),
        'updated_at', v_new->'updated_at'
      );
    END IF;
  END IF;

  -- Composite-key tables: record_id NULL; keys captured in JSON payload
  IF TG_TABLE_NAME = 'role_permissions' THEN
    v_record_id := NULL;
    IF v_old IS NOT NULL THEN
      v_old := jsonb_build_object(
        'role_id', v_old->'role_id',
        'permission_id', v_old->'permission_id',
        'created_at', v_old->'created_at'
      );
    END IF;
    IF v_new IS NOT NULL THEN
      v_new := jsonb_build_object(
        'role_id', v_new->'role_id',
        'permission_id', v_new->'permission_id',
        'created_at', v_new->'created_at'
      );
    END IF;
  END IF;

  IF v_uid IS NOT NULL THEN
    INSERT INTO public.audit_logs (user_id, action, module, record_id, previous_value, new_value)
    VALUES (v_uid, v_action, v_module, v_record_id, v_old, v_new);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_trigger_fn() FROM PUBLIC;

BEGIN;

-- ---------------------------------------------------------------------------
-- Roles (13 canonical production roles)
-- ---------------------------------------------------------------------------
INSERT INTO public.roles (name, display_name_en, display_name_ar, description) VALUES
  ('system_admin', 'System Admin', 'مدير النظام', 'Technical system administration'),
  ('lab_director', 'Lab Director', 'مدير المختبر', 'Laboratory director'),
  ('lab_manager', 'Lab Manager', 'مدير المختبر التشغيلي', 'Operational lab manager'),
  ('head_of_section', 'Head of Section', 'رئيس القسم', 'Hematology section head'),
  ('section_supervisor', 'Section Supervisor', 'مشرف القسم', 'Shift/section supervisor'),
  ('quality_officer', 'Quality Officer', 'مسؤول الجودة', 'Quality officer'),
  ('education_coordinator', 'Education Coordinator', 'منسق التعليم', 'Training and education coordinator'),
  ('inventory_officer', 'Inventory Officer', 'مسؤول المخزون', 'Inventory officer'),
  ('team_leader', 'Team Leader', 'قائد الفريق', 'Team leader'),
  ('senior_lab_technologist', 'Senior Lab Technologist', 'فني مختبر أول', 'Senior technologist'),
  ('lab_technologist', 'Lab Technologist', 'فني مختبر', 'Lab technologist'),
  ('trainee', 'Trainee', 'متدرب', 'Trainee with restricted access'),
  ('read_only', 'Read Only', 'قراءة فقط', 'Read-only access')
ON CONFLICT (name) DO UPDATE SET
  display_name_en = EXCLUDED.display_name_en,
  display_name_ar = EXCLUDED.display_name_ar,
  description = EXCLUDED.description;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (code, module, description) VALUES
  ('users.manage', 'users', 'Manage user accounts'),
  ('roles.manage', 'users', 'Manage roles and permissions'),
  ('settings.manage', 'system', 'Manage system settings'),
  ('audit.view', 'audit', 'View audit logs'),
  ('reports.view', 'reports', 'View reports'),
  ('reports.approve', 'reports', 'Approve reports'),
  ('reports.manage', 'reports', 'Create and manage reports'),
  ('kpi.view', 'kpi', 'View KPI metrics'),
  ('kpi.manage', 'kpi', 'Manage KPI metrics'),
  ('employees.view', 'employees', 'View employees'),
  ('employees.manage', 'employees', 'Manage employees'),
  ('employees.evaluate', 'employees', 'Create employee evaluations'),
  ('tasks.view', 'tasks', 'View tasks'),
  ('tasks.manage', 'tasks', 'Manage tasks'),
  ('tasks.approve', 'tasks', 'Approve tasks'),
  ('instruments.view', 'instruments', 'View instruments'),
  ('instruments.manage', 'instruments', 'Manage instruments'),
  ('maintenance.view', 'maintenance', 'View maintenance records'),
  ('maintenance.manage', 'maintenance', 'Manage maintenance records'),
  ('qc.view', 'qc', 'View QC records'),
  ('qc.manage', 'qc', 'Manage QC records'),
  ('critical_values.view', 'clinical', 'View critical values'),
  ('critical_values.manage', 'clinical', 'Manage critical values'),
  ('sample_rejections.view', 'clinical', 'View sample rejections'),
  ('sample_rejections.manage', 'clinical', 'Manage sample rejections'),
  ('corrected_results.view', 'clinical', 'View corrected results'),
  ('corrected_results.manage', 'clinical', 'Manage corrected results'),
  ('tat.view', 'tat', 'View TAT records'),
  ('tat.manage', 'tat', 'Manage TAT records'),
  ('training.view', 'training', 'View training'),
  ('training.manage', 'training', 'Manage training'),
  ('competencies.view', 'training', 'View competencies'),
  ('competencies.manage', 'training', 'Manage competencies'),
  ('documents.view', 'documents', 'View documents'),
  ('documents.manage', 'documents', 'Manage documents'),
  ('inventory.view', 'inventory', 'View inventory'),
  ('inventory.manage', 'inventory', 'Manage inventory'),
  ('meetings.view', 'meetings', 'View meetings'),
  ('meetings.manage', 'meetings', 'Manage meetings'),
  ('risk.view', 'risk', 'View risks and incidents'),
  ('risk.manage', 'risk', 'Manage risks'),
  ('capa.view', 'capa', 'View CAPA records'),
  ('capa.manage', 'capa', 'Manage CAPA records'),
  ('notifications.view', 'notifications', 'View notifications'),
  ('notifications.manage', 'notifications', 'Manage notifications'),
  ('media.view', 'media', 'View portal media'),
  ('media.manage', 'media', 'Manage portal media'),
  ('forms.view', 'forms', 'View forms'),
  ('forms.manage', 'forms', 'Manage forms'),
  ('announcements.view', 'announcements', 'View announcements'),
  ('announcements.manage', 'announcements', 'Manage announcements'),
  ('calendar.view', 'calendar', 'View calendar'),
  ('calendar.manage', 'calendar', 'Manage calendar'),
  ('report_builder.view', 'report_builder', 'View report builder'),
  ('report_builder.manage', 'report_builder', 'Manage report builder'),
  ('records.soft_delete', 'system', 'Soft-delete records'),
  ('records.restore', 'system', 'Restore soft-deleted records'),
  ('records.permanent_delete', 'system', 'Permanently delete records (audited)')
ON CONFLICT (code) DO UPDATE SET
  module = EXCLUDED.module,
  description = EXCLUDED.description;

-- ---------------------------------------------------------------------------
-- Role-permission mappings (idempotent; no DELETE — avoids audit churn)
-- ---------------------------------------------------------------------------

-- system_admin: technical administration ONLY (no automatic clinical PHI access)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'system_admin'
  AND p.code IN (
    'users.manage', 'roles.manage', 'settings.manage', 'audit.view',
    'notifications.manage', 'records.soft_delete', 'records.restore', 'records.permanent_delete'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON p.code IN (
  'reports.view','reports.approve','kpi.view','employees.view','employees.evaluate',
  'tasks.view','instruments.view','maintenance.view','qc.view',
  'critical_values.view','sample_rejections.view','corrected_results.view',
  'tat.view','training.view','documents.view','inventory.view',
  'meetings.view','risk.view','capa.view','notifications.view','audit.view',
  'media.view','forms.view','announcements.view','calendar.view','report_builder.view'
) WHERE r.name = 'lab_director'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON p.code IN (
  'reports.view','reports.manage','kpi.view','kpi.manage','employees.view','employees.evaluate',
  'tasks.view','tasks.manage','instruments.view','maintenance.view','qc.view',
  'critical_values.view','sample_rejections.view','corrected_results.view',
  'tat.view','training.view','documents.view','inventory.view',
  'meetings.view','risk.view','capa.view','notifications.view',
  'media.view','forms.view','announcements.view','calendar.view','report_builder.view'
) WHERE r.name = 'lab_manager'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON p.code IN (
  'reports.view','reports.manage','kpi.view','employees.view','employees.manage',
  'tasks.view','tasks.manage','tasks.approve','instruments.view','maintenance.view','qc.view',
  'critical_values.view','sample_rejections.view','corrected_results.view',
  'tat.view','training.view','documents.view','inventory.view',
  'meetings.view','meetings.manage','risk.view','capa.view','notifications.view',
  'media.view','media.manage','forms.view','forms.manage',
  'announcements.view','announcements.manage','calendar.view','calendar.manage',
  'report_builder.view','report_builder.manage'
) WHERE r.name = 'head_of_section'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON p.code IN (
  'employees.view','employees.manage','tasks.view','tasks.manage','tasks.approve',
  'instruments.view','instruments.manage','maintenance.view','maintenance.manage',
  'qc.view','qc.manage','critical_values.view','sample_rejections.view',
  'corrected_results.view','tat.view','training.view','documents.view',
  'inventory.view','meetings.view','notifications.view',
  'announcements.view','calendar.view','forms.view'
) WHERE r.name = 'section_supervisor'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON p.code IN (
  'qc.view','qc.manage','critical_values.view','critical_values.manage',
  'sample_rejections.view','sample_rejections.manage',
  'corrected_results.view','corrected_results.manage',
  'kpi.view','risk.view','risk.manage','capa.view','capa.manage',
  'documents.view','documents.manage','training.view','reports.view',
  'notifications.view','audit.view','media.view','media.manage',
  'forms.view','forms.manage','announcements.view','announcements.manage',
  'calendar.view','calendar.manage','report_builder.view','report_builder.manage',
  'competencies.view','competencies.manage'
) WHERE r.name = 'quality_officer'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON p.code IN (
  'training.view','training.manage','competencies.view','competencies.manage',
  'documents.view','documents.manage','employees.view','tasks.view',
  'meetings.view','notifications.view','announcements.view','calendar.view',
  'forms.view','forms.manage','media.view','media.manage'
) WHERE r.name = 'education_coordinator'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON p.code IN (
  'inventory.view','inventory.manage','documents.view','tasks.view',
  'notifications.view','reports.view','employees.view'
) WHERE r.name = 'inventory_officer'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON p.code IN (
  'employees.view','tasks.view','tasks.manage','tasks.approve',
  'instruments.view','maintenance.view','qc.view',
  'critical_values.view','sample_rejections.view','training.view',
  'documents.view','inventory.view','notifications.view','calendar.view'
) WHERE r.name = 'team_leader'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON p.code IN (
  'tasks.view','tasks.manage','instruments.view','maintenance.view','maintenance.manage',
  'qc.view','qc.manage','critical_values.view','sample_rejections.view',
  'corrected_results.view','tat.view','training.view','documents.view',
  'inventory.view','notifications.view','calendar.view','competencies.view'
) WHERE r.name = 'senior_lab_technologist'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON p.code IN (
  'tasks.view','instruments.view','maintenance.view','qc.view',
  'critical_values.view','sample_rejections.view','corrected_results.view',
  'tat.view','training.view','documents.view','notifications.view',
  'announcements.view','calendar.view'
) WHERE r.name = 'lab_technologist'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON p.code IN (
  'tasks.view','training.view','documents.view','notifications.view',
  'announcements.view','calendar.view'
) WHERE r.name = 'trainee'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON p.code IN (
  'reports.view','employees.view','tasks.view','instruments.view',
  'maintenance.view','qc.view','training.view','documents.view',
  'inventory.view','meetings.view','notifications.view',
  'announcements.view','calendar.view','forms.view'
) WHERE r.name = 'read_only'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Public application settings only (non-sensitive display config)
-- ---------------------------------------------------------------------------
INSERT INTO public.system_settings (setting_key, setting_value, is_public, description) VALUES
  ('laboratory', '{"laboratoryName":"Central Laboratory","sectionName":"Hematology Section","defaultLanguage":"en","timezone":"Asia/Riyadh","dateFormat":"DD/MM/YYYY"}'::JSONB, TRUE, 'Public laboratory display settings'),
  ('tat_targets', '{"stat":60,"routine":240,"dDimer":90,"er":45,"icu":30}'::JSONB, TRUE, 'Public TAT target display values (minutes)'),
  ('portal_display', '{"portalName":"Hematology Section Portal","theme":"purple"}'::JSONB, TRUE, 'Public portal branding settings')
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  is_public = EXCLUDED.is_public,
  description = EXCLUDED.description;

-- Restricted settings (never exposed via safe_system_settings view)
INSERT INTO public.system_settings (setting_key, setting_value, is_public, description) VALUES
  ('evaluation_weights', '{"fte":0.4,"staff":0.3,"supervisor":0.1,"labManager":0.1,"labDirector":0.1}'::JSONB, FALSE, 'Employee evaluation score weights'),
  ('sample_rejection', '{"retentionDays":3}'::JSONB, FALSE, 'Rejected sample retention policy')
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  is_public = EXCLUDED.is_public,
  description = EXCLUDED.description;

COMMIT;

-- Auth profile trigger (requires read_only role from above)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
