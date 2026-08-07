-- ============================================================================
-- Hematology Section Portal
-- Migration 009: Security Hardening
-- Auth triggers, audit system, secure views, admin bootstrap function.
-- Production-safe. No seed data.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Profile creation on auth signup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_read_only_role_id UUID;
BEGIN
  SELECT r.id INTO v_read_only_role_id
  FROM public.roles r
  WHERE r.name = 'read_only'::public.app_role
  LIMIT 1;

  IF v_read_only_role_id IS NULL THEN
    RAISE EXCEPTION 'Required role read_only is not configured';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, primary_role_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''), split_part(NEW.email, '@', 1)),
    v_read_only_role_id
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Profile creation failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
-- Trigger created in migration 010 after read_only role exists
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id = auth.uid() AND NOT public.has_permission('users.manage') THEN
    IF NEW.primary_role_id IS DISTINCT FROM OLD.primary_role_id THEN
      RAISE EXCEPTION 'Cannot change your own role';
    END IF;
    IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
      RAISE EXCEPTION 'Cannot change your own employee link';
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Cannot change your own active status';
    END IF;
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      RAISE EXCEPTION 'Cannot modify your own deletion status';
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Cannot change email directly';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_profile_safe_self_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id = auth.uid() AND NOT public.has_permission('users.manage') THEN
    -- Restore protected fields; allow only safe personal preferences
    NEW.primary_role_id := OLD.primary_role_id;
    NEW.employee_id := OLD.employee_id;
    NEW.is_active := OLD.is_active;
    NEW.deleted_at := OLD.deleted_at;
    NEW.email := OLD.email;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_self_update ON public.profiles;
CREATE TRIGGER trg_protect_profile_self_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_self_update();

DROP TRIGGER IF EXISTS trg_enforce_profile_safe_self_fields ON public.profiles;
CREATE TRIGGER trg_enforce_profile_safe_self_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_safe_self_fields();

-- ---------------------------------------------------------------------------
-- Audit log helper (acting user always auth.uid())
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action TEXT,
  p_module TEXT,
  p_record_id UUID DEFAULT NULL,
  p_previous_value JSONB DEFAULT NULL,
  p_new_value JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Audit events require an authenticated user';
  END IF;

  IF p_action IS NULL OR length(trim(p_action)) = 0 OR length(p_action) > 64 THEN
    RAISE EXCEPTION 'Invalid audit action';
  END IF;

  IF p_module IS NULL OR length(trim(p_module)) = 0 OR length(p_module) > 64 THEN
    RAISE EXCEPTION 'Invalid audit module';
  END IF;

  INSERT INTO public.audit_logs (user_id, action, module, record_id, previous_value, new_value)
  VALUES (v_uid, p_action, p_module, p_record_id, p_previous_value, p_new_value)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_audit_event(TEXT, TEXT, UUID, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_audit_event(TEXT, TEXT, UUID, JSONB, JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- Database-level audit triggers (sensitive tables)
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
BEGIN
  v_uid := auth.uid();
  v_module := TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME;

  IF TG_OP = 'INSERT' THEN
    v_action := 'insert';
    v_record_id := NEW.id;
    v_new := to_jsonb(NEW);
    v_old := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_record_id := NEW.id;
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_record_id := OLD.id;
    v_old := to_jsonb(OLD);
    v_new := NULL;
  END IF;

  -- Strip tokens/secrets if ever present
  v_old := v_old - 'encrypted_password' - 'recovery_token' - 'confirmation_token';
  v_new := v_new - 'encrypted_password' - 'recovery_token' - 'confirmation_token';

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

CREATE TRIGGER trg_audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER trg_audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER trg_audit_role_permissions
  AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER trg_audit_critical_values
  AFTER INSERT OR UPDATE OR DELETE ON public.critical_values
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER trg_audit_sample_rejections
  AFTER INSERT OR UPDATE OR DELETE ON public.sample_rejections
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER trg_audit_corrected_results
  AFTER INSERT OR UPDATE OR DELETE ON public.corrected_results
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER trg_audit_pending_samples
  AFTER INSERT OR UPDATE OR DELETE ON public.pending_samples
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER trg_audit_documents
  AFTER INSERT OR UPDATE OR DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER trg_audit_document_versions
  AFTER INSERT OR UPDATE OR DELETE ON public.document_versions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER trg_audit_system_settings
  AFTER INSERT OR UPDATE OR DELETE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

-- Append-only audit_logs policies (override migration 006)
DROP POLICY IF EXISTS audit_logs_update ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_delete ON public.audit_logs;

CREATE POLICY audit_logs_update ON public.audit_logs
  FOR UPDATE TO authenticated USING (FALSE);

CREATE POLICY audit_logs_delete ON public.audit_logs
  FOR DELETE TO authenticated USING (FALSE);

-- ---------------------------------------------------------------------------
-- Secure views (security_invoker = true)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.safe_system_settings
WITH (security_invoker = true) AS
SELECT id, setting_key, setting_value, description, updated_at
FROM public.system_settings
WHERE is_public = TRUE;

CREATE OR REPLACE VIEW public.staff_directory_public
WITH (security_invoker = true) AS
SELECT
  e.id,
  e.employee_code,
  e.full_name,
  e.job_title,
  e.section,
  e.shift,
  e.employment_status,
  e.is_active
FROM public.employees e
WHERE e.deleted_at IS NULL AND e.is_active = TRUE;

CREATE OR REPLACE VIEW public.masked_critical_values
WITH (security_invoker = true) AS
SELECT
  cv.id,
  cv.recorded_at,
  cv.record_date,
  CASE WHEN public.has_full_phi_access() THEN cv.patient_id ELSE '***' END AS patient_id,
  CASE WHEN public.has_full_phi_access() THEN cv.patient_name ELSE '***' END AS patient_name,
  CASE WHEN public.has_full_phi_access() THEN cv.patient_acc_number ELSE '***' END AS patient_acc_number,
  cv.test_name,
  CASE WHEN public.has_clinical_phi_access() THEN cv.critical_value ELSE '***' END AS critical_value,
  cv.department,
  CASE WHEN public.has_full_phi_access() THEN cv.informed_to_dr ELSE '***' END AS informed_to_dr,
  cv.reported_by,
  cv.created_at,
  cv.updated_at
FROM public.critical_values cv
WHERE cv.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.masked_sample_rejections
WITH (security_invoker = true) AS
SELECT
  sr.id,
  CASE WHEN public.has_full_phi_access() THEN sr.patient_id ELSE '***' END AS patient_id,
  CASE WHEN public.has_full_phi_access() THEN sr.patient_name ELSE '***' END AS patient_name,
  CASE WHEN public.has_clinical_phi_access() THEN sr.patient_lab_accession ELSE '***' END AS patient_lab_accession,
  sr.department_name,
  sr.rejection_date,
  sr.rejection_time,
  sr.supervisor_review_status,
  sr.replacement_sample_status,
  sr.discard_status,
  sr.created_at,
  sr.updated_at
FROM public.sample_rejections sr
WHERE sr.deleted_at IS NULL;

GRANT SELECT ON public.safe_system_settings TO authenticated;
GRANT SELECT ON public.staff_directory_public TO authenticated;
GRANT SELECT ON public.masked_critical_values TO authenticated;
GRANT SELECT ON public.masked_sample_rejections TO authenticated;

-- ---------------------------------------------------------------------------
-- One-time admin bootstrap (callable only by service_role / postgres)
-- Revoked from authenticated and anon.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bootstrap_system_admin(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id) THEN
    RAISE EXCEPTION 'Auth user not found';
  END IF;

  SELECT r.id INTO v_admin_role_id
  FROM public.roles r
  WHERE r.name = 'system_admin'::public.app_role
  LIMIT 1;

  IF v_admin_role_id IS NULL THEN
    RAISE EXCEPTION 'system_admin role not configured';
  END IF;

  UPDATE public.profiles
  SET primary_role_id = v_admin_role_id, is_active = TRUE, deleted_at = NULL
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user. Ensure auth signup completed first.';
  END IF;

  INSERT INTO public.audit_logs (user_id, action, module, record_id, new_value)
  VALUES (p_user_id, 'bootstrap_system_admin', 'auth', p_user_id, jsonb_build_object('primary_role', 'system_admin'));
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_system_admin(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bootstrap_system_admin(UUID) FROM authenticated;
REVOKE ALL ON FUNCTION public.bootstrap_system_admin(UUID) FROM anon;
-- service_role retains access via SECURITY DEFINER ownership

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_profile_self_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_profile_safe_self_fields() FROM PUBLIC;
