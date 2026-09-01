-- ============================================================================
-- Migration 055: Body Fluid Worksheet (Form-Hema-010)
-- Does NOT auto-apply.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'body_fluid_worksheet_status') THEN
    CREATE TYPE public.body_fluid_worksheet_status AS ENUM ('draft', 'submitted');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'body_fluid_specimen_type') THEN
    CREATE TYPE public.body_fluid_specimen_type AS ENUM (
      'csf', 'pleural', 'peritoneal', 'synovial', 'pericardial', 'other'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'body_fluid_clot_status') THEN
    CREATE TYPE public.body_fluid_clot_status AS ENUM ('clotted', 'not_clotted');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'body_fluid_agreement_result') THEN
    CREATE TYPE public.body_fluid_agreement_result AS ENUM (
      'not_performed', 'acceptable', 'discrepancy'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.body_fluid_worksheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_label_reference TEXT NOT NULL DEFAULT '',
  time_received TIMESTAMPTZ,
  specimen_type public.body_fluid_specimen_type,
  specimen_type_other TEXT,
  tube_number TEXT,
  clot_status public.body_fluid_clot_status,
  color_appearance TEXT,
  chamber_background TEXT,
  dilution_used BOOLEAN NOT NULL DEFAULT FALSE,
  dilution_background_ok BOOLEAN,
  dilution_factor NUMERIC(10,4),
  second_tech_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  primary_tech_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  primary_tech_name TEXT NOT NULL,
  primary_tech_staff_id TEXT,
  second_tech_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  second_tech_name TEXT,
  second_tech_staff_id TEXT,
  tech1_total_wbc NUMERIC(10,2),
  tech1_avg_wbc NUMERIC(10,4),
  tech1_total_rbc NUMERIC(10,2),
  tech1_avg_rbc NUMERIC(10,4),
  tech2_total_wbc NUMERIC(10,2),
  tech2_avg_wbc NUMERIC(10,4),
  tech2_total_rbc NUMERIC(10,2),
  tech2_avg_rbc NUMERIC(10,4),
  wbc_agreement public.body_fluid_agreement_result NOT NULL DEFAULT 'not_performed',
  rbc_agreement public.body_fluid_agreement_result NOT NULL DEFAULT 'not_performed',
  final_wbc NUMERIC(12,2),
  final_rbc NUMERIC(12,2),
  differential_neutrophils NUMERIC(6,2),
  differential_lymphocytes NUMERIC(6,2),
  differential_monocytes NUMERIC(6,2),
  differential_other_type TEXT,
  differential_other_quantity NUMERIC(6,2),
  comments TEXT,
  pathologist_name TEXT,
  pathologist_staff_id TEXT,
  pathologist_reviewed_at TIMESTAMPTZ,
  pathologist_comment TEXT,
  status public.body_fluid_worksheet_status NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_by_name TEXT,
  deleted_by_staff_id TEXT,
  delete_reason TEXT,
  CONSTRAINT body_fluid_specimen_other_check
    CHECK (specimen_type IS DISTINCT FROM 'other'::public.body_fluid_specimen_type OR btrim(COALESCE(specimen_type_other, '')) <> '')
);

CREATE TABLE IF NOT EXISTS public.body_fluid_count_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worksheet_id UUID NOT NULL REFERENCES public.body_fluid_worksheets(id) ON DELETE CASCADE,
  tech_number SMALLINT NOT NULL,
  cell_type TEXT NOT NULL,
  square_number SMALLINT NOT NULL,
  count_value NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT body_fluid_count_tech_check CHECK (tech_number IN (1, 2)),
  CONSTRAINT body_fluid_count_cell_type_check CHECK (cell_type IN ('wbc', 'rbc')),
  CONSTRAINT body_fluid_count_unique UNIQUE (worksheet_id, tech_number, cell_type, square_number)
);

CREATE TABLE IF NOT EXISTS public.body_fluid_worksheet_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worksheet_id UUID NOT NULL REFERENCES public.body_fluid_worksheets(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  performed_by_name TEXT,
  performed_by_staff_id TEXT,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_body_fluid_worksheets_status
  ON public.body_fluid_worksheets(status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_body_fluid_worksheets_patient
  ON public.body_fluid_worksheets(patient_label_reference)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_body_fluid_counts_worksheet
  ON public.body_fluid_count_entries(worksheet_id, tech_number, cell_type);

DROP TRIGGER IF EXISTS trg_body_fluid_worksheets_updated_at ON public.body_fluid_worksheets;
CREATE TRIGGER trg_body_fluid_worksheets_updated_at
  BEFORE UPDATE ON public.body_fluid_worksheets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_body_fluid_count_entries_updated_at ON public.body_fluid_count_entries;
CREATE TRIGGER trg_body_fluid_count_entries_updated_at
  BEFORE UPDATE ON public.body_fluid_count_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.body_fluid_worksheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_fluid_count_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_fluid_worksheet_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS body_fluid_worksheets_select ON public.body_fluid_worksheets;
CREATE POLICY body_fluid_worksheets_select ON public.body_fluid_worksheets
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('medical_reports.view'));

DROP POLICY IF EXISTS body_fluid_worksheets_insert ON public.body_fluid_worksheets;
CREATE POLICY body_fluid_worksheets_insert ON public.body_fluid_worksheets
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('medical_reports.create') OR public.is_system_admin());

DROP POLICY IF EXISTS body_fluid_worksheets_update ON public.body_fluid_worksheets;
CREATE POLICY body_fluid_worksheets_update ON public.body_fluid_worksheets
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.has_permission('medical_reports.edit')
      OR public.has_permission('medical_reports.create')
      OR public.has_permission('medical_reports.review')
      OR public.is_system_admin()
    )
  )
  WITH CHECK (
    public.has_permission('medical_reports.edit')
    OR public.has_permission('medical_reports.create')
    OR public.has_permission('medical_reports.review')
    OR public.is_system_admin()
  );

DROP POLICY IF EXISTS body_fluid_counts_select ON public.body_fluid_count_entries;
CREATE POLICY body_fluid_counts_select ON public.body_fluid_count_entries
  FOR SELECT TO authenticated
  USING (public.has_permission('medical_reports.view'));

DROP POLICY IF EXISTS body_fluid_counts_insert ON public.body_fluid_count_entries;
CREATE POLICY body_fluid_counts_insert ON public.body_fluid_count_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('medical_reports.create')
    OR public.has_permission('medical_reports.edit')
    OR public.is_system_admin()
  );

DROP POLICY IF EXISTS body_fluid_counts_update ON public.body_fluid_count_entries;
CREATE POLICY body_fluid_counts_update ON public.body_fluid_count_entries
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('medical_reports.create')
    OR public.has_permission('medical_reports.edit')
    OR public.is_system_admin()
  )
  WITH CHECK (
    public.has_permission('medical_reports.create')
    OR public.has_permission('medical_reports.edit')
    OR public.is_system_admin()
  );

DROP POLICY IF EXISTS body_fluid_audit_select ON public.body_fluid_worksheet_audit_events;
CREATE POLICY body_fluid_audit_select ON public.body_fluid_worksheet_audit_events
  FOR SELECT TO authenticated
  USING (public.has_permission('medical_reports.view'));

DROP POLICY IF EXISTS body_fluid_audit_insert ON public.body_fluid_worksheet_audit_events;
CREATE POLICY body_fluid_audit_insert ON public.body_fluid_worksheet_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('medical_reports.create')
    OR public.has_permission('medical_reports.edit')
    OR public.has_permission('medical_reports.review')
    OR public.is_system_admin()
  );

-- Allow technologists to edit their own drafts after create
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'medical_reports.edit'
WHERE r.name = 'lab_technologist'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

COMMIT;
