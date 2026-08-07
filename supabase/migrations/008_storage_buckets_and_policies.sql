-- ============================================================================
-- Hematology Section Portal
-- Migration 008: Storage Buckets and Policies
-- All buckets are private. Full SELECT/INSERT/UPDATE/DELETE policies per bucket.
-- ============================================================================

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

-- Helper: path must be module-scoped and safe
CREATE OR REPLACE FUNCTION public.storage_path_matches_module(p_bucket TEXT, p_path TEXT, p_module TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.is_valid_storage_path(p_path)
    AND (
      p_path LIKE p_module || '/%'
      OR p_path LIKE p_module || '%'
    );
$$;

REVOKE ALL ON FUNCTION public.storage_path_matches_module(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_path_matches_module(TEXT, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- patient-documents
-- ---------------------------------------------------------------------------
CREATE POLICY storage_patient_documents_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'patient-documents'
    AND public.is_valid_storage_path(name)
    AND (
      public.has_permission('critical_values.view')
      OR public.has_permission('sample_rejections.view')
    )
  );

CREATE POLICY storage_patient_documents_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'patient-documents'
    AND public.is_valid_storage_path(name)
    AND (
      public.has_permission('critical_values.manage')
      OR public.has_permission('sample_rejections.manage')
    )
  );

CREATE POLICY storage_patient_documents_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'patient-documents'
    AND public.has_permission('critical_values.manage')
  )
  WITH CHECK (
    bucket_id = 'patient-documents'
    AND public.is_valid_storage_path(name)
    AND public.has_permission('critical_values.manage')
  );

CREATE POLICY storage_patient_documents_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'patient-documents'
    AND public.has_permission('critical_values.manage')
  );

-- ---------------------------------------------------------------------------
-- sop-documents
-- ---------------------------------------------------------------------------
CREATE POLICY storage_sop_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'sop-documents' AND public.has_permission('documents.view') AND public.is_valid_storage_path(name));

CREATE POLICY storage_sop_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sop-documents' AND public.has_permission('documents.manage') AND public.storage_path_matches_module('sop-documents', name, 'documents'));

CREATE POLICY storage_sop_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'sop-documents' AND public.has_permission('documents.manage'))
  WITH CHECK (bucket_id = 'sop-documents' AND public.has_permission('documents.manage') AND public.is_valid_storage_path(name));

CREATE POLICY storage_sop_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'sop-documents' AND public.has_permission('documents.manage'));

-- ---------------------------------------------------------------------------
-- policy-documents
-- ---------------------------------------------------------------------------
CREATE POLICY storage_policy_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'policy-documents' AND public.has_permission('documents.view') AND public.is_valid_storage_path(name));

CREATE POLICY storage_policy_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'policy-documents' AND public.has_permission('documents.manage') AND public.storage_path_matches_module('policy-documents', name, 'documents'));

CREATE POLICY storage_policy_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'policy-documents' AND public.has_permission('documents.manage'))
  WITH CHECK (bucket_id = 'policy-documents' AND public.has_permission('documents.manage') AND public.is_valid_storage_path(name));

CREATE POLICY storage_policy_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'policy-documents' AND public.has_permission('documents.manage'));

-- ---------------------------------------------------------------------------
-- qc-files
-- ---------------------------------------------------------------------------
CREATE POLICY storage_qc_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'qc-files' AND public.has_permission('qc.view') AND public.is_valid_storage_path(name));

CREATE POLICY storage_qc_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'qc-files' AND public.has_permission('qc.manage') AND public.storage_path_matches_module('qc-files', name, 'qc'));

CREATE POLICY storage_qc_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'qc-files' AND public.has_permission('qc.manage'))
  WITH CHECK (bucket_id = 'qc-files' AND public.has_permission('qc.manage') AND public.is_valid_storage_path(name));

CREATE POLICY storage_qc_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'qc-files' AND public.has_permission('qc.manage'));

-- ---------------------------------------------------------------------------
-- maintenance-records
-- ---------------------------------------------------------------------------
CREATE POLICY storage_maintenance_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'maintenance-records' AND public.has_permission('maintenance.view') AND public.is_valid_storage_path(name));

CREATE POLICY storage_maintenance_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'maintenance-records' AND public.has_permission('maintenance.manage') AND public.storage_path_matches_module('maintenance-records', name, 'maintenance'));

CREATE POLICY storage_maintenance_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'maintenance-records' AND public.has_permission('maintenance.manage'))
  WITH CHECK (bucket_id = 'maintenance-records' AND public.has_permission('maintenance.manage') AND public.is_valid_storage_path(name));

CREATE POLICY storage_maintenance_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'maintenance-records' AND public.has_permission('maintenance.manage'));

-- ---------------------------------------------------------------------------
-- competency-files
-- ---------------------------------------------------------------------------
CREATE POLICY storage_competency_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'competency-files'
    AND public.is_valid_storage_path(name)
    AND (
      public.has_permission('training.manage')
      OR (
        public.has_permission('training.view')
        AND name LIKE ('employees/' || COALESCE(public.current_employee_id()::TEXT, '') || '/%')
      )
    )
  );

CREATE POLICY storage_competency_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'competency-files' AND public.has_permission('training.manage') AND public.storage_path_matches_module('competency-files', name, 'competencies'));

CREATE POLICY storage_competency_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'competency-files' AND public.has_permission('training.manage'))
  WITH CHECK (bucket_id = 'competency-files' AND public.has_permission('training.manage') AND public.is_valid_storage_path(name));

CREATE POLICY storage_competency_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'competency-files' AND public.has_permission('training.manage'));

-- ---------------------------------------------------------------------------
-- audit-evidence (append-oriented: no user UPDATE/DELETE)
-- ---------------------------------------------------------------------------
CREATE POLICY storage_audit_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'audit-evidence' AND public.has_permission('audit.view') AND public.is_valid_storage_path(name));

CREATE POLICY storage_audit_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'audit-evidence'
    AND (public.is_system_admin() OR public.has_permission('audit.view'))
    AND public.storage_path_matches_module('audit-evidence', name, 'audit')
  );

CREATE POLICY storage_audit_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'audit-evidence' AND public.is_system_admin())
  WITH CHECK (bucket_id = 'audit-evidence' AND public.is_system_admin());

CREATE POLICY storage_audit_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'audit-evidence' AND public.is_system_admin());

-- ---------------------------------------------------------------------------
-- certificates
-- ---------------------------------------------------------------------------
CREATE POLICY storage_certificates_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'certificates'
    AND public.is_valid_storage_path(name)
    AND (
      public.has_permission('training.manage')
      OR (
        public.has_permission('training.view')
        AND name LIKE ('employees/' || COALESCE(public.current_employee_id()::TEXT, '') || '/%')
      )
    )
  );

CREATE POLICY storage_certificates_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'certificates' AND public.has_permission('training.manage') AND public.storage_path_matches_module('certificates', name, 'certificates'));

CREATE POLICY storage_certificates_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'certificates' AND public.has_permission('training.manage'))
  WITH CHECK (bucket_id = 'certificates' AND public.has_permission('training.manage') AND public.is_valid_storage_path(name));

CREATE POLICY storage_certificates_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'certificates' AND public.has_permission('training.manage'));

-- ---------------------------------------------------------------------------
-- portal-media
-- ---------------------------------------------------------------------------
CREATE POLICY storage_portal_media_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'portal-media' AND public.has_permission('media.view') AND public.is_valid_storage_path(name));

CREATE POLICY storage_portal_media_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'portal-media' AND public.has_permission('media.manage') AND public.storage_path_matches_module('portal-media', name, 'media'));

CREATE POLICY storage_portal_media_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'portal-media' AND public.has_permission('media.manage'))
  WITH CHECK (bucket_id = 'portal-media' AND public.has_permission('media.manage') AND public.is_valid_storage_path(name));

CREATE POLICY storage_portal_media_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'portal-media' AND public.has_permission('media.manage'));
