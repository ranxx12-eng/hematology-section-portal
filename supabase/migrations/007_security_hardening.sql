-- ============================================================================
-- Hematology Section Portal
-- Migration 007: Security Hardening
-- ============================================================================

-- Expand app_role enum with production role names (legacy values retained)
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'quality_officer';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'education_coordinator';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'inventory_officer';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'team_leader';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'trainee';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'read_only';

-- New users always receive viewer/read_only role — never trust signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    'read_only'::app_role
  );
  RETURN NEW;
END;
$$;

-- Prevent users from self-escalating role or reactivating disabled accounts
CREATE OR REPLACE FUNCTION public.protect_profile_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id = auth.uid() AND NOT public.has_permission('users.manage') THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Cannot change your own role';
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Cannot change your own active status';
    END IF;
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      RAISE EXCEPTION 'Cannot modify your own deletion status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_self_update ON public.profiles;
CREATE TRIGGER trg_protect_profile_self_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_self_update();

-- Audit logs: append-only for all users; broad insert for authenticated actions
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
CREATE POLICY audit_logs_insert ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_system_admin());

DROP POLICY IF EXISTS audit_logs_update ON public.audit_logs;
CREATE POLICY audit_logs_update ON public.audit_logs
  FOR UPDATE TO authenticated
  USING (FALSE);

DROP POLICY IF EXISTS audit_logs_delete ON public.audit_logs;
CREATE POLICY audit_logs_delete ON public.audit_logs
  FOR DELETE TO authenticated
  USING (FALSE);

-- Private storage buckets for sensitive files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('patient-documents', 'patient-documents', FALSE, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png']),
  ('sop-documents', 'sop-documents', FALSE, 10485760, ARRAY['application/pdf']),
  ('policy-documents', 'policy-documents', FALSE, 10485760, ARRAY['application/pdf']),
  ('qc-files', 'qc-files', FALSE, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png']),
  ('maintenance-records', 'maintenance-records', FALSE, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png']),
  ('competency-files', 'competency-files', FALSE, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png']),
  ('audit-evidence', 'audit-evidence', FALSE, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png']),
  ('certificates', 'certificates', FALSE, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png']),
  ('portal-media', 'portal-media', FALSE, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS: authenticated users with relevant permissions
DROP POLICY IF EXISTS storage_patient_documents_select ON storage.objects;
DROP POLICY IF EXISTS storage_patient_documents_insert ON storage.objects;
DROP POLICY IF EXISTS storage_sop_select ON storage.objects;
DROP POLICY IF EXISTS storage_sop_insert ON storage.objects;
DROP POLICY IF EXISTS storage_qc_select ON storage.objects;
DROP POLICY IF EXISTS storage_qc_insert ON storage.objects;
DROP POLICY IF EXISTS storage_portal_media_select ON storage.objects;
DROP POLICY IF EXISTS storage_portal_media_insert ON storage.objects;

CREATE POLICY storage_patient_documents_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'patient-documents' AND public.has_permission('critical_values.view'));

CREATE POLICY storage_patient_documents_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'patient-documents' AND public.has_permission('critical_values.manage'));

CREATE POLICY storage_sop_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'sop-documents' AND public.has_permission('documents.view'));

CREATE POLICY storage_sop_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sop-documents' AND public.has_permission('documents.manage'));

CREATE POLICY storage_qc_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'qc-files' AND public.has_permission('qc.view'));

CREATE POLICY storage_qc_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'qc-files' AND public.has_permission('qc.manage'));

CREATE POLICY storage_portal_media_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'portal-media' AND public.has_permission('media.view'));

CREATE POLICY storage_portal_media_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'portal-media' AND public.has_permission('media.manage'));

-- Map legacy role names to new canonical roles in roles table
UPDATE public.roles SET name = 'quality_officer'::app_role, display_name_en = 'Quality Officer'
WHERE name = 'quality_link'::app_role;

UPDATE public.roles SET name = 'read_only'::app_role, display_name_en = 'Read Only'
WHERE name = 'viewer'::app_role;

UPDATE public.profiles SET role = 'quality_officer'::app_role WHERE role = 'quality_link';
UPDATE public.profiles SET role = 'read_only'::app_role WHERE role = 'viewer';
UPDATE public.employees SET role = 'quality_officer'::app_role WHERE role = 'quality_link';
