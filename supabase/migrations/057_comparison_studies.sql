-- ============================================================================
-- Migration 057: Comparison Studies (Form-Hema-013 standard + study engine)
-- Does NOT auto-apply.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comparison_study_type') THEN
    CREATE TYPE public.comparison_study_type AS ENUM (
      'standard_comparison',
      'rumke',
      'open_close_mixing'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comparison_study_status') THEN
    CREATE TYPE public.comparison_study_status AS ENUM (
      'draft',
      'submitted',
      'pending_review',
      'pending_approval',
      'approved',
      'returned',
      'rejected',
      'archived'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comparison_overall_result') THEN
    CREATE TYPE public.comparison_overall_result AS ENUM (
      'acceptable',
      'not_acceptable',
      'manual_review_required',
      'incomplete'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comparison_result_status') THEN
    CREATE TYPE public.comparison_result_status AS ENUM (
      'acceptable',
      'not_acceptable',
      'manual_review',
      'incomplete'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comparison_manual_review_decision') THEN
    CREATE TYPE public.comparison_manual_review_decision AS ENUM (
      'accept',
      'not_accept',
      'repeat_required',
      'exclude_result'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comparison_section_code') THEN
    CREATE TYPE public.comparison_section_code AS ENUM ('CBC', 'COAGULATION', 'ESR');
  END IF;
END $$;

INSERT INTO public.permissions (code, module, description) VALUES
  ('comparison.view', 'comparison', 'View comparison studies'),
  ('comparison.create', 'comparison', 'Create comparison studies'),
  ('comparison.edit', 'comparison', 'Edit comparison study drafts'),
  ('comparison.submit', 'comparison', 'Submit comparison studies'),
  ('comparison.review', 'comparison', 'Review comparison studies'),
  ('comparison.approve', 'comparison', 'Approve comparison studies'),
  ('comparison.manage_definitions', 'comparison', 'Manage comparison test definitions'),
  ('comparison.export', 'comparison', 'Export comparison studies'),
  ('comparison.archive', 'comparison', 'Archive comparison studies')
ON CONFLICT (code) DO UPDATE SET
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code LIKE 'comparison.%'
WHERE r.name = 'system_admin'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN ('comparison.view', 'comparison.create', 'comparison.edit', 'comparison.submit')
WHERE r.name = 'lab_technologist'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'comparison.view', 'comparison.create', 'comparison.submit', 'comparison.review', 'comparison.export'
)
WHERE r.name = 'senior_lab_technologist'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'comparison.view', 'comparison.create', 'comparison.review', 'comparison.manage_definitions', 'comparison.export'
)
WHERE r.name IN ('quality_officer', 'quality_link')
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'comparison.view', 'comparison.review', 'comparison.approve', 'comparison.export'
)
WHERE r.name = 'section_supervisor'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN ('comparison.view', 'comparison.approve', 'comparison.export')
WHERE r.name = 'head_of_section'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'comparison.view'
WHERE r.name IN ('lab_director', 'lab_manager')
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.comparison_test_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section public.comparison_section_code NOT NULL,
  test_code TEXT NOT NULL,
  test_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  tae_limit NUMERIC(8,4),
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT comparison_test_definitions_code_unique UNIQUE (test_code)
);

CREATE TABLE IF NOT EXISTS public.comparison_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_number TEXT NOT NULL,
  form_code TEXT,
  study_type public.comparison_study_type NOT NULL,
  comparison_type TEXT,
  study_title TEXT NOT NULL DEFAULT '',
  study_date DATE,
  purpose TEXT,
  reference_label TEXT,
  comparison_label TEXT,
  reference_instrument_id UUID REFERENCES public.instruments(id) ON DELETE SET NULL,
  comparison_instrument_id UUID REFERENCES public.instruments(id) ON DELETE SET NULL,
  status public.comparison_study_status NOT NULL DEFAULT 'draft',
  overall_result public.comparison_overall_result,
  general_comments TEXT,
  prepared_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  prepared_by_name TEXT,
  prepared_by_staff_id TEXT,
  prepared_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_by_name TEXT,
  reviewed_by_staff_id TEXT,
  reviewed_at TIMESTAMPTZ,
  review_comment TEXT,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by_name TEXT,
  approved_by_staff_id TEXT,
  approved_at TIMESTAMPTZ,
  approval_comment TEXT,
  parent_study_id UUID REFERENCES public.comparison_studies(id) ON DELETE SET NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  amendment_reason TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  archived_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_by_name TEXT,
  deleted_by_staff_id TEXT,
  delete_reason TEXT,
  CONSTRAINT comparison_studies_number_version_unique UNIQUE (study_number, version_number)
);

CREATE TABLE IF NOT EXISTS public.comparison_study_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id UUID NOT NULL REFERENCES public.comparison_studies(id) ON DELETE CASCADE,
  section public.comparison_section_code NOT NULL,
  completion_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT comparison_study_sections_unique UNIQUE (study_id, section)
);

CREATE TABLE IF NOT EXISTS public.comparison_study_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id UUID NOT NULL REFERENCES public.comparison_studies(id) ON DELETE CASCADE,
  section public.comparison_section_code NOT NULL,
  sample_id TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT comparison_study_samples_unique UNIQUE (study_id, section, sample_id)
);

CREATE TABLE IF NOT EXISTS public.comparison_study_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id UUID NOT NULL REFERENCES public.comparison_study_samples(id) ON DELETE CASCADE,
  test_definition_id UUID REFERENCES public.comparison_test_definitions(id) ON DELETE SET NULL,
  test_code TEXT NOT NULL,
  test_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  previous_result NUMERIC(14,6),
  new_result NUMERIC(14,6),
  difference_units NUMERIC(14,6),
  difference_percent NUMERIC(10,4),
  tae_limit_snapshot NUMERIC(8,4),
  result_status public.comparison_result_status NOT NULL DEFAULT 'incomplete',
  manual_review_decision public.comparison_manual_review_decision,
  manual_review_comment TEXT,
  manual_reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  manual_reviewed_by_name TEXT,
  manual_reviewed_by_staff_id TEXT,
  manual_reviewed_at TIMESTAMPTZ,
  issue_observation TEXT,
  corrective_action TEXT,
  repeat_performed BOOLEAN NOT NULL DEFAULT FALSE,
  repeat_previous_result NUMERIC(14,6),
  repeat_new_result NUMERIC(14,6),
  repeat_reason TEXT,
  repeat_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  repeat_by_name TEXT,
  repeat_at TIMESTAMPTZ,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT comparison_study_results_unique UNIQUE (sample_id, test_code)
);

CREATE TABLE IF NOT EXISTS public.comparison_study_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id UUID NOT NULL REFERENCES public.comparison_studies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name TEXT,
  staff_id TEXT,
  action TEXT NOT NULL,
  old_status public.comparison_study_status,
  new_status public.comparison_study_status,
  comment TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comparison_studies_status ON public.comparison_studies(status, study_date DESC)
  WHERE deleted_at IS NULL AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_comparison_studies_type ON public.comparison_studies(study_type)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_comparison_studies_number ON public.comparison_studies(study_number);
CREATE INDEX IF NOT EXISTS idx_comparison_samples_study ON public.comparison_study_samples(study_id, section, display_order);
CREATE INDEX IF NOT EXISTS idx_comparison_results_sample ON public.comparison_study_results(sample_id, test_code);
CREATE INDEX IF NOT EXISTS idx_comparison_audit_study ON public.comparison_study_audit_events(study_id, created_at DESC);

INSERT INTO public.comparison_test_definitions (section, test_code, test_name, unit, tae_limit, display_order)
VALUES
  ('CBC', 'WBC', 'WBC', E'×10³/µL', 15, 1),
  ('CBC', 'RBC', 'RBC', E'×10⁶/µL', 6, 2),
  ('CBC', 'HGB', 'HGB', 'g/dL', 7, 3),
  ('CBC', 'PLT', 'PLT', E'×10³/µL', 25, 4),
  ('COAGULATION', 'PT', 'PT', 'sec', 15, 1),
  ('COAGULATION', 'PTT', 'PTT', 'sec', 15, 2),
  ('COAGULATION', 'DDIMER', 'D-Dimer', 'µg/mL FEU', 15, 3),
  ('COAGULATION', 'FIB', 'Fibrinogen', 'mg/dL', 20, 4),
  ('ESR', 'ESR', 'ESR', 'mm/hr', 30, 1)
ON CONFLICT (test_code) DO UPDATE SET
  section = EXCLUDED.section,
  test_name = EXCLUDED.test_name,
  unit = EXCLUDED.unit,
  tae_limit = EXCLUDED.tae_limit,
  display_order = EXCLUDED.display_order,
  is_active = TRUE;

DROP TRIGGER IF EXISTS trg_comparison_test_definitions_updated_at ON public.comparison_test_definitions;
CREATE TRIGGER trg_comparison_test_definitions_updated_at
  BEFORE UPDATE ON public.comparison_test_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_comparison_studies_updated_at ON public.comparison_studies;
CREATE TRIGGER trg_comparison_studies_updated_at
  BEFORE UPDATE ON public.comparison_studies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_comparison_study_sections_updated_at ON public.comparison_study_sections;
CREATE TRIGGER trg_comparison_study_sections_updated_at
  BEFORE UPDATE ON public.comparison_study_sections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_comparison_study_samples_updated_at ON public.comparison_study_samples;
CREATE TRIGGER trg_comparison_study_samples_updated_at
  BEFORE UPDATE ON public.comparison_study_samples
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_comparison_study_results_updated_at ON public.comparison_study_results;
CREATE TRIGGER trg_comparison_study_results_updated_at
  BEFORE UPDATE ON public.comparison_study_results
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.comparison_test_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparison_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparison_study_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparison_study_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparison_study_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparison_study_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comparison_definitions_select ON public.comparison_test_definitions;
CREATE POLICY comparison_definitions_select ON public.comparison_test_definitions
  FOR SELECT TO authenticated USING (public.has_permission('comparison.view'));

DROP POLICY IF EXISTS comparison_definitions_update ON public.comparison_test_definitions;
CREATE POLICY comparison_definitions_update ON public.comparison_test_definitions
  FOR UPDATE TO authenticated
  USING (public.has_permission('comparison.manage_definitions') OR public.is_system_admin())
  WITH CHECK (public.has_permission('comparison.manage_definitions') OR public.is_system_admin());

DROP POLICY IF EXISTS comparison_studies_select ON public.comparison_studies;
CREATE POLICY comparison_studies_select ON public.comparison_studies
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('comparison.view'));

DROP POLICY IF EXISTS comparison_studies_insert ON public.comparison_studies;
CREATE POLICY comparison_studies_insert ON public.comparison_studies
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('comparison.create') OR public.is_system_admin());

DROP POLICY IF EXISTS comparison_studies_update ON public.comparison_studies;
CREATE POLICY comparison_studies_update ON public.comparison_studies
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND archived_at IS NULL
    AND (
      public.has_permission('comparison.edit')
      OR public.has_permission('comparison.review')
      OR public.has_permission('comparison.approve')
      OR public.has_permission('comparison.archive')
      OR public.is_system_admin()
    )
  )
  WITH CHECK (
    public.has_permission('comparison.edit')
    OR public.has_permission('comparison.review')
    OR public.has_permission('comparison.approve')
    OR public.has_permission('comparison.archive')
    OR public.is_system_admin()
  );

DROP POLICY IF EXISTS comparison_sections_all ON public.comparison_study_sections;
CREATE POLICY comparison_sections_all ON public.comparison_study_sections
  FOR ALL TO authenticated
  USING (public.has_permission('comparison.view'))
  WITH CHECK (
    public.has_permission('comparison.create')
    OR public.has_permission('comparison.edit')
    OR public.is_system_admin()
  );

DROP POLICY IF EXISTS comparison_samples_all ON public.comparison_study_samples;
CREATE POLICY comparison_samples_all ON public.comparison_study_samples
  FOR ALL TO authenticated
  USING (public.has_permission('comparison.view'))
  WITH CHECK (
    public.has_permission('comparison.create')
    OR public.has_permission('comparison.edit')
    OR public.is_system_admin()
  );

DROP POLICY IF EXISTS comparison_results_all ON public.comparison_study_results;
CREATE POLICY comparison_results_all ON public.comparison_study_results
  FOR ALL TO authenticated
  USING (public.has_permission('comparison.view'))
  WITH CHECK (
    public.has_permission('comparison.create')
    OR public.has_permission('comparison.edit')
    OR public.has_permission('comparison.review')
    OR public.is_system_admin()
  );

DROP POLICY IF EXISTS comparison_audit_select ON public.comparison_study_audit_events;
CREATE POLICY comparison_audit_select ON public.comparison_study_audit_events
  FOR SELECT TO authenticated USING (public.has_permission('comparison.view'));

DROP POLICY IF EXISTS comparison_audit_insert ON public.comparison_study_audit_events;
CREATE POLICY comparison_audit_insert ON public.comparison_study_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('comparison.create')
    OR public.has_permission('comparison.edit')
    OR public.has_permission('comparison.review')
    OR public.has_permission('comparison.approve')
    OR public.is_system_admin()
  );

COMMIT;
