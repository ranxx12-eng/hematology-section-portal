-- ============================================================================
-- Migration 039: Granular Form Builder permissions and RLS
-- Depends on 020 (dynamic forms) and 038 (form status/metadata).
-- Idempotent. Does not weaken existing access — forms.manage retains full access.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (code, module, description) VALUES
  ('forms.submit', 'forms', 'Submit published forms'),
  ('forms.build', 'forms', 'Design and edit form drafts'),
  ('forms.publish', 'forms', 'Publish, unpublish, and archive forms'),
  ('forms.manage_responses', 'forms', 'View, export, and print form responses')
ON CONFLICT (code) DO UPDATE SET
  module = EXCLUDED.module,
  description = EXCLUDED.description;

-- ---------------------------------------------------------------------------
-- Role grants — builder roles
-- ---------------------------------------------------------------------------

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'forms.view',
  'forms.submit',
  'forms.build',
  'forms.publish',
  'forms.manage_responses'
)
WHERE r.name IN (
  'system_admin',
  'lab_manager',
  'head_of_section',
  'section_supervisor',
  'quality_officer',
  'education_coordinator'
)
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Role grants — routine staff (view + submit only)
-- ---------------------------------------------------------------------------

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN ('forms.view', 'forms.submit')
WHERE r.name IN ('senior_lab_technologist', 'lab_technologist')
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_access_form_design()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_permission('forms.build')
    OR public.has_permission('forms.manage');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_form_responses()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_permission('forms.manage_responses')
    OR public.has_permission('forms.manage');
$$;

CREATE OR REPLACE FUNCTION public.can_submit_forms()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_permission('forms.submit')
    OR public.has_permission('forms.manage');
$$;

CREATE OR REPLACE FUNCTION public.is_published_form(p_status TEXT, p_is_published BOOLEAN)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_status = 'published', FALSE) OR COALESCE(p_is_published, FALSE);
$$;

REVOKE ALL ON FUNCTION public.can_access_form_design() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_form_responses() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_submit_forms() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_published_form(TEXT, BOOLEAN) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.can_access_form_design() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_form_responses() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_submit_forms() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_published_form(TEXT, BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------------
-- dynamic_forms policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS dynamic_forms_select ON public.dynamic_forms;
DROP POLICY IF EXISTS dynamic_forms_insert ON public.dynamic_forms;
DROP POLICY IF EXISTS dynamic_forms_update ON public.dynamic_forms;
DROP POLICY IF EXISTS dynamic_forms_delete ON public.dynamic_forms;

CREATE POLICY dynamic_forms_select ON public.dynamic_forms
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.can_access_form_design()
      OR public.can_manage_form_responses()
      OR (
        (public.has_permission('forms.view') OR public.can_submit_forms())
        AND public.is_published_form(status, is_published)
      )
    )
  );

CREATE POLICY dynamic_forms_insert ON public.dynamic_forms
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_form_design());

CREATE POLICY dynamic_forms_update ON public.dynamic_forms
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.can_access_form_design()
      OR public.has_permission('forms.publish')
      OR public.has_permission('forms.manage')
    )
  )
  WITH CHECK (
    public.can_access_form_design()
    OR public.has_permission('forms.publish')
    OR public.has_permission('forms.manage')
  );

CREATE POLICY dynamic_forms_delete ON public.dynamic_forms
  FOR DELETE TO authenticated
  USING (
    public.can_access_form_design()
    OR public.has_permission('forms.publish')
    OR public.has_permission('forms.manage')
  );

-- ---------------------------------------------------------------------------
-- form_fields policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS form_fields_select ON public.form_fields;
DROP POLICY IF EXISTS form_fields_manage ON public.form_fields;

CREATE POLICY form_fields_select ON public.form_fields
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.dynamic_forms f
      WHERE f.id = form_id
        AND f.deleted_at IS NULL
        AND (
          public.can_access_form_design()
          OR public.can_manage_form_responses()
          OR (
            (public.has_permission('forms.view') OR public.can_submit_forms())
            AND public.is_published_form(f.status, f.is_published)
          )
        )
    )
  );

CREATE POLICY form_fields_manage ON public.form_fields
  FOR ALL TO authenticated
  USING (public.can_access_form_design() AND deleted_at IS NULL)
  WITH CHECK (public.can_access_form_design());

-- ---------------------------------------------------------------------------
-- form_submissions policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS form_submissions_select ON public.form_submissions;
DROP POLICY IF EXISTS form_submissions_insert ON public.form_submissions;
DROP POLICY IF EXISTS form_submissions_manage ON public.form_submissions;

CREATE POLICY form_submissions_select ON public.form_submissions
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.can_manage_form_responses()
  );

CREATE POLICY form_submissions_insert ON public.form_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_submit_forms()
    AND EXISTS (
      SELECT 1
      FROM public.dynamic_forms f
      WHERE f.id = form_id
        AND f.deleted_at IS NULL
        AND public.is_published_form(f.status, f.is_published)
    )
  );

CREATE POLICY form_submissions_manage ON public.form_submissions
  FOR ALL TO authenticated
  USING (public.can_manage_form_responses() AND deleted_at IS NULL)
  WITH CHECK (public.can_manage_form_responses());

COMMIT;
