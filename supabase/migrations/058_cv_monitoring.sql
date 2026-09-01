-- ============================================================================
-- Migration 058: CV Monitoring (Form-Hema-015 Monthly CV Comparison)
-- Does NOT auto-apply.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cv_monitoring_status') THEN
    CREATE TYPE public.cv_monitoring_status AS ENUM (
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
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cv_result_status') THEN
    CREATE TYPE public.cv_result_status AS ENUM (
      'ok',
      'high_cv',
      'manual_review',
      'incomplete'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cv_overall_status') THEN
    CREATE TYPE public.cv_overall_status AS ENUM (
      'all_within_limit',
      'high_cv_detected',
      'manual_review_required',
      'incomplete'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cv_trend_status') THEN
    CREATE TYPE public.cv_trend_status AS ENUM (
      'improved',
      'increased',
      'no_change'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cv_previous_source_type') THEN
    CREATE TYPE public.cv_previous_source_type AS ENUM (
      'auto_from_approved_record',
      'historical_paper_record',
      'instrument_report',
      'qc_report',
      'other'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cv_quality_disposition') THEN
    CREATE TYPE public.cv_quality_disposition AS ENUM (
      'accepted_after_investigation',
      'corrective_action_required',
      'repeat_monitoring_required',
      'invalid_excluded'
    );
  END IF;
END $$;

INSERT INTO public.permissions (code, module, description) VALUES
  ('cv_monitoring.view', 'cv_monitoring', 'View CV monitoring records'),
  ('cv_monitoring.create', 'cv_monitoring', 'Create CV monitoring records'),
  ('cv_monitoring.edit', 'cv_monitoring', 'Edit CV monitoring drafts'),
  ('cv_monitoring.submit', 'cv_monitoring', 'Submit CV monitoring records'),
  ('cv_monitoring.review', 'cv_monitoring', 'Review CV monitoring records'),
  ('cv_monitoring.approve', 'cv_monitoring', 'Approve CV monitoring records'),
  ('cv_monitoring.manage_definitions', 'cv_monitoring', 'Manage CV monitoring definitions'),
  ('cv_monitoring.export', 'cv_monitoring', 'Export CV monitoring records'),
  ('cv_monitoring.archive', 'cv_monitoring', 'Archive CV monitoring records')
ON CONFLICT (code) DO UPDATE SET
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code LIKE 'cv_monitoring.%'
WHERE r.name = 'system_admin'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'cv_monitoring.view', 'cv_monitoring.create', 'cv_monitoring.edit', 'cv_monitoring.submit'
)
WHERE r.name = 'lab_technologist'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'cv_monitoring.view', 'cv_monitoring.create', 'cv_monitoring.submit', 'cv_monitoring.review', 'cv_monitoring.export'
)
WHERE r.name = 'senior_lab_technologist'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'cv_monitoring.view', 'cv_monitoring.create', 'cv_monitoring.review', 'cv_monitoring.manage_definitions', 'cv_monitoring.export'
)
WHERE r.name IN ('quality_officer', 'quality_link')
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'cv_monitoring.view', 'cv_monitoring.review', 'cv_monitoring.approve', 'cv_monitoring.export'
)
WHERE r.name = 'section_supervisor'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN ('cv_monitoring.view', 'cv_monitoring.approve', 'cv_monitoring.export')
WHERE r.name = 'head_of_section'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'cv_monitoring.view'
WHERE r.name IN ('lab_director', 'lab_manager')
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.cv_monitoring_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id UUID NOT NULL REFERENCES public.instruments(id) ON DELETE RESTRICT,
  analyte_code TEXT NOT NULL,
  analyte_name TEXT NOT NULL,
  qc_level TEXT NOT NULL CHECK (qc_level IN ('N', 'P')),
  unit TEXT,
  cv_limit_percent NUMERIC(10,4) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from DATE,
  effective_to DATE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cv_monitoring_definitions_unique UNIQUE (instrument_id, analyte_code, qc_level, effective_from)
);

CREATE TABLE IF NOT EXISTS public.cv_monitoring_definition_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES public.cv_monitoring_definitions(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_by_name TEXT,
  staff_id TEXT,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cv_monitoring_monthly_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitoring_number TEXT NOT NULL UNIQUE,
  form_code TEXT NOT NULL DEFAULT 'Form-Hema-015',
  qid TEXT NOT NULL DEFAULT 'HMG/SAH/QID/9167',
  instrument_id UUID NOT NULL REFERENCES public.instruments(id) ON DELETE RESTRICT,
  instrument_name_snapshot TEXT NOT NULL,
  current_month INTEGER NOT NULL CHECK (current_month BETWEEN 1 AND 12),
  current_year INTEGER NOT NULL,
  previous_month INTEGER NOT NULL CHECK (previous_month BETWEEN 1 AND 12),
  previous_year INTEGER NOT NULL,
  status public.cv_monitoring_status NOT NULL DEFAULT 'draft',
  overall_status public.cv_overall_status,
  general_comments TEXT,
  notes TEXT,
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
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  archived_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.cv_monitoring_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_record_id UUID NOT NULL REFERENCES public.cv_monitoring_monthly_records(id) ON DELETE CASCADE,
  qc_level TEXT NOT NULL CHECK (qc_level IN ('N', 'P')),
  lot_number TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cv_monitoring_levels_unique UNIQUE (monthly_record_id, qc_level)
);

CREATE TABLE IF NOT EXISTS public.cv_monitoring_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_record_id UUID NOT NULL REFERENCES public.cv_monitoring_monthly_records(id) ON DELETE CASCADE,
  level_id UUID NOT NULL REFERENCES public.cv_monitoring_levels(id) ON DELETE CASCADE,
  definition_id UUID REFERENCES public.cv_monitoring_definitions(id) ON DELETE SET NULL,
  analyte_code_snapshot TEXT NOT NULL,
  analyte_name_snapshot TEXT NOT NULL,
  unit_snapshot TEXT,
  cv_limit_snapshot NUMERIC(10,4),
  previous_mean NUMERIC(14,6),
  previous_sd NUMERIC(14,6),
  previous_cv_percent NUMERIC(10,4),
  previous_status public.cv_result_status NOT NULL DEFAULT 'incomplete',
  previous_source_type public.cv_previous_source_type,
  previous_source_record_id UUID REFERENCES public.cv_monitoring_monthly_records(id) ON DELETE SET NULL,
  previous_manual_reason TEXT,
  previous_manual_entered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  previous_manual_entered_by_name TEXT,
  previous_manual_entered_at TIMESTAMPTZ,
  current_mean NUMERIC(14,6),
  current_sd NUMERIC(14,6),
  current_cv_percent NUMERIC(10,4),
  current_status public.cv_result_status NOT NULL DEFAULT 'incomplete',
  cv_change NUMERIC(10,4),
  trend_status public.cv_trend_status,
  comment TEXT,
  observation TEXT,
  investigation TEXT,
  possible_cause TEXT,
  corrective_action TEXT,
  follow_up_required BOOLEAN,
  follow_up_comment TEXT,
  quality_disposition public.cv_quality_disposition,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cv_monitoring_results_unique UNIQUE (level_id, analyte_code_snapshot)
);

CREATE TABLE IF NOT EXISTS public.cv_monitoring_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES public.cv_monitoring_monthly_records(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name TEXT,
  staff_id TEXT,
  action TEXT NOT NULL,
  old_status public.cv_monitoring_status,
  new_status public.cv_monitoring_status,
  comment TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cv_monitoring_records_period
  ON public.cv_monitoring_monthly_records(instrument_id, current_year DESC, current_month DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cv_monitoring_records_status
  ON public.cv_monitoring_monthly_records(status)
  WHERE deleted_at IS NULL AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cv_monitoring_results_record
  ON public.cv_monitoring_results(monthly_record_id, display_order);
CREATE INDEX IF NOT EXISTS idx_cv_monitoring_definitions_instrument
  ON public.cv_monitoring_definitions(instrument_id, qc_level, is_active);
CREATE INDEX IF NOT EXISTS idx_cv_monitoring_audit_record
  ON public.cv_monitoring_audit_events(record_id, created_at DESC);

-- Seed official STAGO Form-Hema-015 CV limits
DO $$
DECLARE
  v_stago_id UUID;
BEGIN
  v_stago_id := public.find_instrument_for_official_seed(
    'N5562', 'HMG87227', 'Stago STA-R MAX3', ARRAY['Stago STA R MAX3']
  );

  IF v_stago_id IS NOT NULL THEN
    INSERT INTO public.cv_monitoring_definitions (instrument_id, analyte_code, analyte_name, qc_level, cv_limit_percent, display_order)
    VALUES
      (v_stago_id, 'PT', 'PT', 'N', 7.627, 1),
      (v_stago_id, 'PTT', 'PTT', 'N', 7.971, 2),
      (v_stago_id, 'FIB', 'Fibrinogen', 'N', 10.656, 3),
      (v_stago_id, 'DD', 'D-Dimer', 'N', 33.33, 4),
      (v_stago_id, 'PT', 'PT', 'P', 11.194, 1),
      (v_stago_id, 'PTT', 'PTT', 'P', 7.576, 2),
      (v_stago_id, 'FIB', 'Fibrinogen', 'P', 9.615, 3),
      (v_stago_id, 'DD', 'D-Dimer', 'P', 9.756, 4)
    ON CONFLICT (instrument_id, analyte_code, qc_level, effective_from) DO UPDATE SET
      analyte_name = EXCLUDED.analyte_name,
      cv_limit_percent = EXCLUDED.cv_limit_percent,
      display_order = EXCLUDED.display_order,
      is_active = TRUE,
      updated_at = NOW();
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_cv_monitoring_definitions_updated_at ON public.cv_monitoring_definitions;
CREATE TRIGGER trg_cv_monitoring_definitions_updated_at
  BEFORE UPDATE ON public.cv_monitoring_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_cv_monitoring_records_updated_at ON public.cv_monitoring_monthly_records;
CREATE TRIGGER trg_cv_monitoring_records_updated_at
  BEFORE UPDATE ON public.cv_monitoring_monthly_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_cv_monitoring_levels_updated_at ON public.cv_monitoring_levels;
CREATE TRIGGER trg_cv_monitoring_levels_updated_at
  BEFORE UPDATE ON public.cv_monitoring_levels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_cv_monitoring_results_updated_at ON public.cv_monitoring_results;
CREATE TRIGGER trg_cv_monitoring_results_updated_at
  BEFORE UPDATE ON public.cv_monitoring_results
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cv_monitoring_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cv_monitoring_definition_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cv_monitoring_monthly_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cv_monitoring_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cv_monitoring_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cv_monitoring_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cv_definitions_select ON public.cv_monitoring_definitions;
CREATE POLICY cv_definitions_select ON public.cv_monitoring_definitions
  FOR SELECT TO authenticated USING (public.has_permission('cv_monitoring.view'));

DROP POLICY IF EXISTS cv_definitions_insert ON public.cv_monitoring_definitions;
CREATE POLICY cv_definitions_insert ON public.cv_monitoring_definitions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('cv_monitoring.manage_definitions') OR public.is_system_admin());

DROP POLICY IF EXISTS cv_definitions_update ON public.cv_monitoring_definitions;
CREATE POLICY cv_definitions_update ON public.cv_monitoring_definitions
  FOR UPDATE TO authenticated
  USING (public.has_permission('cv_monitoring.manage_definitions') OR public.is_system_admin())
  WITH CHECK (public.has_permission('cv_monitoring.manage_definitions') OR public.is_system_admin());

DROP POLICY IF EXISTS cv_definition_audit_select ON public.cv_monitoring_definition_audit_events;
CREATE POLICY cv_definition_audit_select ON public.cv_monitoring_definition_audit_events
  FOR SELECT TO authenticated USING (public.has_permission('cv_monitoring.view'));

DROP POLICY IF EXISTS cv_definition_audit_insert ON public.cv_monitoring_definition_audit_events;
CREATE POLICY cv_definition_audit_insert ON public.cv_monitoring_definition_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('cv_monitoring.manage_definitions') OR public.is_system_admin());

DROP POLICY IF EXISTS cv_records_select ON public.cv_monitoring_monthly_records;
CREATE POLICY cv_records_select ON public.cv_monitoring_monthly_records
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('cv_monitoring.view'));

DROP POLICY IF EXISTS cv_records_insert ON public.cv_monitoring_monthly_records;
CREATE POLICY cv_records_insert ON public.cv_monitoring_monthly_records
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('cv_monitoring.create') OR public.is_system_admin());

DROP POLICY IF EXISTS cv_records_update ON public.cv_monitoring_monthly_records;
CREATE POLICY cv_records_update ON public.cv_monitoring_monthly_records
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL AND archived_at IS NULL
    AND (
      public.has_permission('cv_monitoring.edit')
      OR public.has_permission('cv_monitoring.review')
      OR public.has_permission('cv_monitoring.approve')
      OR public.has_permission('cv_monitoring.archive')
      OR public.is_system_admin()
    )
  )
  WITH CHECK (
    public.has_permission('cv_monitoring.edit')
    OR public.has_permission('cv_monitoring.review')
    OR public.has_permission('cv_monitoring.approve')
    OR public.has_permission('cv_monitoring.archive')
    OR public.is_system_admin()
  );

DROP POLICY IF EXISTS cv_levels_all ON public.cv_monitoring_levels;
CREATE POLICY cv_levels_all ON public.cv_monitoring_levels
  FOR ALL TO authenticated
  USING (public.has_permission('cv_monitoring.view'))
  WITH CHECK (
    public.has_permission('cv_monitoring.create')
    OR public.has_permission('cv_monitoring.edit')
    OR public.is_system_admin()
  );

DROP POLICY IF EXISTS cv_results_all ON public.cv_monitoring_results;
CREATE POLICY cv_results_all ON public.cv_monitoring_results
  FOR ALL TO authenticated
  USING (public.has_permission('cv_monitoring.view'))
  WITH CHECK (
    public.has_permission('cv_monitoring.create')
    OR public.has_permission('cv_monitoring.edit')
    OR public.has_permission('cv_monitoring.review')
    OR public.is_system_admin()
  );

DROP POLICY IF EXISTS cv_audit_select ON public.cv_monitoring_audit_events;
CREATE POLICY cv_audit_select ON public.cv_monitoring_audit_events
  FOR SELECT TO authenticated USING (public.has_permission('cv_monitoring.view'));

DROP POLICY IF EXISTS cv_audit_insert ON public.cv_monitoring_audit_events;
CREATE POLICY cv_audit_insert ON public.cv_monitoring_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('cv_monitoring.create')
    OR public.has_permission('cv_monitoring.edit')
    OR public.has_permission('cv_monitoring.review')
    OR public.has_permission('cv_monitoring.approve')
    OR public.is_system_admin()
  );

COMMIT;
