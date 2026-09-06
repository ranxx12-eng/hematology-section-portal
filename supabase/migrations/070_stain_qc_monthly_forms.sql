-- ============================================================================
-- Migration 070: Monthly Stain QC controlled forms (Form-Hema-021 RAPI Stain)
-- Additive only. Does not modify migrations 001–069.
-- Reusable structure supports Form-Hema-039 (Giemsa) as a separate form code.
-- Does NOT auto-apply to production.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stain_qc_workflow_status') THEN
    CREATE TYPE public.stain_qc_workflow_status AS ENUM (
      'draft',
      'submitted',
      'reviewed',
      'approved'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stain_qc_cell_status') THEN
    CREATE TYPE public.stain_qc_cell_status AS ENUM (
      'acceptable',
      'not_acceptable',
      'na'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stain_qc_overall_evaluation') THEN
    CREATE TYPE public.stain_qc_overall_evaluation AS ENUM (
      'acceptable',
      'not_acceptable',
      'na'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stain_qc_responsibility_type') THEN
    CREATE TYPE public.stain_qc_responsibility_type AS ENUM (
      'slide_prepared',
      'slide_checked',
      'qc_correction_change_stain'
    );
  END IF;
END $$;

INSERT INTO public.permissions (code, module, description) VALUES
  ('stain_qc.view', 'stain_qc', 'View monthly stain QC forms'),
  ('stain_qc.record', 'stain_qc', 'Record daily stain QC checks'),
  ('stain_qc.submit', 'stain_qc', 'Submit monthly stain QC forms for review'),
  ('stain_qc.review', 'stain_qc', 'Review monthly stain QC forms'),
  ('stain_qc.approve', 'stain_qc', 'Approve monthly stain QC forms'),
  ('stain_qc.export', 'stain_qc', 'Export/print monthly stain QC forms'),
  ('stain_qc.amend', 'stain_qc', 'Create controlled amendments to approved stain QC forms')
ON CONFLICT (code) DO UPDATE SET
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code LIKE 'stain_qc.%'
WHERE r.name = 'system_admin'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN ('stain_qc.view', 'stain_qc.record', 'stain_qc.submit')
WHERE r.name = 'lab_technologist'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'stain_qc.view', 'stain_qc.record', 'stain_qc.submit', 'stain_qc.review', 'stain_qc.export'
)
WHERE r.name = 'senior_lab_technologist'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'stain_qc.view', 'stain_qc.record', 'stain_qc.submit', 'stain_qc.review', 'stain_qc.export'
)
WHERE r.name IN ('quality_officer', 'quality_link')
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN ('stain_qc.view', 'stain_qc.approve', 'stain_qc.export')
WHERE r.name = 'section_supervisor'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'stain_qc.view'
WHERE r.name IN ('lab_director', 'lab_manager', 'head_of_section', 'read_only', 'viewer')
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.stain_qc_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_code TEXT NOT NULL CHECK (form_code IN ('Form-Hema-021', 'Form-Hema-039')),
  criterion_key TEXT NOT NULL,
  section_key TEXT NOT NULL,
  section_label TEXT NOT NULL,
  row_label TEXT NOT NULL,
  component_label TEXT,
  ideal_color TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stain_qc_criteria_unique UNIQUE (form_code, criterion_key)
);

CREATE TABLE IF NOT EXISTS public.stain_qc_monthly_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_number TEXT NOT NULL UNIQUE,
  form_code TEXT NOT NULL CHECK (form_code IN ('Form-Hema-021', 'Form-Hema-039')),
  form_title TEXT NOT NULL,
  stain_name TEXT NOT NULL,
  lot_number TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  sheet_month INTEGER NOT NULL CHECK (sheet_month BETWEEN 1 AND 12),
  sheet_year INTEGER NOT NULL CHECK (sheet_year BETWEEN 2000 AND 2100),
  overall_evaluation public.stain_qc_overall_evaluation,
  status public.stain_qc_workflow_status NOT NULL DEFAULT 'draft',
  version_number INTEGER NOT NULL DEFAULT 1 CHECK (version_number >= 1),
  parent_sheet_id UUID REFERENCES public.stain_qc_monthly_sheets(id) ON DELETE SET NULL,
  amendment_reason TEXT,
  submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  submitted_by_name TEXT,
  submitted_by_staff_id TEXT,
  submitted_at TIMESTAMPTZ,
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
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stain_qc_monthly_sheets_identity
  ON public.stain_qc_monthly_sheets(form_code, sheet_year, sheet_month, lot_number, version_number)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.stain_qc_daily_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id UUID NOT NULL REFERENCES public.stain_qc_monthly_sheets(id) ON DELETE CASCADE,
  form_code TEXT NOT NULL CHECK (form_code IN ('Form-Hema-021', 'Form-Hema-039')),
  criterion_key TEXT NOT NULL,
  day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  result_status public.stain_qc_cell_status NOT NULL,
  lot_number_snapshot TEXT NOT NULL,
  recorded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  recorded_by_name TEXT NOT NULL,
  recorded_by_staff_id TEXT,
  recorded_by_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  recorded_by_initials TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_updated_by_name TEXT,
  last_updated_at TIMESTAMPTZ,
  amendment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stain_qc_daily_results_unique UNIQUE (sheet_id, criterion_key, day_of_month)
);

CREATE TABLE IF NOT EXISTS public.stain_qc_responsibility_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id UUID NOT NULL REFERENCES public.stain_qc_monthly_sheets(id) ON DELETE CASCADE,
  form_code TEXT NOT NULL CHECK (form_code IN ('Form-Hema-021', 'Form-Hema-039')),
  responsibility_type public.stain_qc_responsibility_type NOT NULL,
  day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  lot_number_snapshot TEXT NOT NULL,
  recorded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  recorded_by_name TEXT NOT NULL,
  recorded_by_staff_id TEXT,
  recorded_by_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  recorded_by_initials TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stain_qc_responsibility_unique UNIQUE (sheet_id, responsibility_type, day_of_month)
);

CREATE TABLE IF NOT EXISTS public.stain_qc_corrective_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id UUID NOT NULL REFERENCES public.stain_qc_monthly_sheets(id) ON DELETE CASCADE,
  daily_result_id UUID NOT NULL UNIQUE REFERENCES public.stain_qc_daily_results(id) ON DELETE CASCADE,
  form_code TEXT NOT NULL CHECK (form_code IN ('Form-Hema-021', 'Form-Hema-039')),
  criterion_key TEXT NOT NULL,
  day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  lot_number_snapshot TEXT NOT NULL,
  comment TEXT NOT NULL,
  recorded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  recorded_by_name TEXT NOT NULL,
  recorded_by_staff_id TEXT,
  recorded_by_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stain_qc_workflow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id UUID NOT NULL REFERENCES public.stain_qc_monthly_sheets(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name TEXT,
  actor_staff_id TEXT,
  action TEXT NOT NULL,
  old_status public.stain_qc_workflow_status,
  new_status public.stain_qc_workflow_status,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stain_qc_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id UUID NOT NULL REFERENCES public.stain_qc_monthly_sheets(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('daily_result', 'responsibility', 'sheet_header', 'corrective_action')),
  entity_id UUID,
  criterion_key TEXT,
  day_of_month INTEGER,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_by_name TEXT,
  changed_by_staff_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stain_qc_sheets_period
  ON public.stain_qc_monthly_sheets(form_code, sheet_year DESC, sheet_month DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stain_qc_daily_results_sheet
  ON public.stain_qc_daily_results(sheet_id, criterion_key, day_of_month);
CREATE INDEX IF NOT EXISTS idx_stain_qc_workflow_events_sheet
  ON public.stain_qc_workflow_events(sheet_id, created_at DESC);

-- Seed Form-Hema-021 criteria only (Form-Hema-039 seeded separately in a future migration)
INSERT INTO public.stain_qc_criteria (
  form_code, criterion_key, section_key, section_label, row_label, component_label, ideal_color, display_order
) VALUES
  ('Form-Hema-021', 'pbf_spreading', 'peripheral_blood_film', 'Peripheral Blood Film', 'Spreading', NULL, NULL, 1),
  ('Form-Hema-021', 'pbf_distribution_10x', 'peripheral_blood_film', 'Peripheral Blood Film', 'Distribution of RBCs/WBCs', '10×', NULL, 2),
  ('Form-Hema-021', 'pbf_distribution_40x', 'peripheral_blood_film', 'Peripheral Blood Film', 'Distribution of RBCs/WBCs', '40×', NULL, 3),
  ('Form-Hema-021', 'bc_platelets', 'blood_cells', 'Blood Cells', 'Platelets', NULL, 'Violet to Purple', 4),
  ('Form-Hema-021', 'bc_rbcs', 'blood_cells', 'Blood Cells', 'RBCs', NULL, 'Pink-Red', 5),
  ('Form-Hema-021', 'bc_neutrophil_nucleus', 'blood_cells', 'Blood Cells', 'Neutrophil', 'Nucleus', 'Blue-Purple', 6),
  ('Form-Hema-021', 'bc_neutrophil_cytoplasm', 'blood_cells', 'Blood Cells', 'Neutrophil', 'Cytoplasm', 'Pale Pink', 7),
  ('Form-Hema-021', 'bc_neutrophil_granules', 'blood_cells', 'Blood Cells', 'Neutrophil', 'Granules', 'Pink-Red', 8),
  ('Form-Hema-021', 'bc_lymphocyte_nucleus', 'blood_cells', 'Blood Cells', 'Lymphocyte', 'Nucleus', 'Dark Purple', 9),
  ('Form-Hema-021', 'bc_lymphocyte_cytoplasm', 'blood_cells', 'Blood Cells', 'Lymphocyte', 'Cytoplasm', 'Sky Blue', 10),
  ('Form-Hema-021', 'bc_monocyte_cytoplasm', 'blood_cells', 'Blood Cells', 'Monocyte', 'Cytoplasm', 'Gray to Gray-Blue', 11),
  ('Form-Hema-021', 'bc_eosinophil_granules', 'blood_cells', 'Blood Cells', 'Eosinophil', 'Granules', 'Red-Orange', 12),
  ('Form-Hema-021', 'bc_basophil_granules', 'blood_cells', 'Blood Cells', 'Basophil', 'Granules', 'Blue-Black', 13)
ON CONFLICT (form_code, criterion_key) DO UPDATE SET
  section_key = EXCLUDED.section_key,
  section_label = EXCLUDED.section_label,
  row_label = EXCLUDED.row_label,
  component_label = EXCLUDED.component_label,
  ideal_color = EXCLUDED.ideal_color,
  display_order = EXCLUDED.display_order,
  is_active = TRUE;

CREATE OR REPLACE FUNCTION public.stain_qc_sheet_is_editable(p_status public.stain_qc_workflow_status)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_status = 'draft';
$$;

CREATE OR REPLACE FUNCTION public.stain_qc_transition_workflow(
  p_sheet_id UUID,
  p_action TEXT,
  p_comment TEXT DEFAULT NULL
)
RETURNS public.stain_qc_monthly_sheets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sheet public.stain_qc_monthly_sheets;
  v_old_status public.stain_qc_workflow_status;
  v_actor UUID := auth.uid();
  v_profile RECORD;
  v_new_status public.stain_qc_workflow_status;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT p.id, p.full_name, p.staff_id
  INTO v_profile
  FROM public.profiles p
  WHERE p.id = v_actor AND p.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  SELECT * INTO v_sheet
  FROM public.stain_qc_monthly_sheets
  WHERE id = p_sheet_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sheet not found';
  END IF;

  v_old_status := v_sheet.status;

  IF p_action = 'submit' THEN
    IF NOT public.has_permission('stain_qc.submit') AND NOT public.is_system_admin() THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
    IF v_sheet.status <> 'draft' THEN
      RAISE EXCEPTION 'Only draft sheets can be submitted';
    END IF;
    IF v_sheet.lot_number IS NULL OR length(trim(v_sheet.lot_number)) = 0 OR v_sheet.expiry_date IS NULL THEN
      RAISE EXCEPTION 'Lot number and expiry date are required before submission';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.stain_qc_daily_results dr
      LEFT JOIN public.stain_qc_corrective_actions ca ON ca.daily_result_id = dr.id
      WHERE dr.sheet_id = v_sheet.id
        AND dr.result_status = 'not_acceptable'
        AND (ca.id IS NULL OR length(trim(ca.comment)) = 0)
    ) THEN
      RAISE EXCEPTION 'All Not Acceptable results require corrective action before submission';
    END IF;
    v_new_status := 'submitted';
    UPDATE public.stain_qc_monthly_sheets
    SET status = v_new_status,
        submitted_by = v_actor,
        submitted_by_name = v_profile.full_name,
        submitted_by_staff_id = v_profile.staff_id,
        submitted_at = NOW(),
        updated_by = v_actor,
        updated_at = NOW()
    WHERE id = v_sheet.id
    RETURNING * INTO v_sheet;
  ELSIF p_action = 'review' THEN
    IF NOT public.has_permission('stain_qc.review') AND NOT public.is_system_admin() THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
    IF v_sheet.status <> 'submitted' THEN
      RAISE EXCEPTION 'Only submitted sheets can be reviewed';
    END IF;
    IF v_sheet.submitted_by = v_actor THEN
      RAISE EXCEPTION 'Self-review is not allowed';
    END IF;
    v_new_status := 'reviewed';
    UPDATE public.stain_qc_monthly_sheets
    SET status = v_new_status,
        reviewed_by = v_actor,
        reviewed_by_name = v_profile.full_name,
        reviewed_by_staff_id = v_profile.staff_id,
        reviewed_at = NOW(),
        review_comment = NULLIF(trim(p_comment), ''),
        updated_by = v_actor,
        updated_at = NOW()
    WHERE id = v_sheet.id
    RETURNING * INTO v_sheet;
  ELSIF p_action = 'approve' THEN
    IF NOT public.has_permission('stain_qc.approve') AND NOT public.is_system_admin() THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
    IF v_sheet.status <> 'reviewed' THEN
      RAISE EXCEPTION 'Only reviewed sheets can be approved';
    END IF;
    v_new_status := 'approved';
    UPDATE public.stain_qc_monthly_sheets
    SET status = v_new_status,
        approved_by = v_actor,
        approved_by_name = v_profile.full_name,
        approved_by_staff_id = v_profile.staff_id,
        approved_at = NOW(),
        approval_comment = NULLIF(trim(p_comment), ''),
        updated_by = v_actor,
        updated_at = NOW()
    WHERE id = v_sheet.id
    RETURNING * INTO v_sheet;
  ELSE
    RAISE EXCEPTION 'Unsupported workflow action: %', p_action;
  END IF;

  INSERT INTO public.stain_qc_workflow_events (
    sheet_id, actor_id, actor_name, actor_staff_id, action, old_status, new_status, comment
  ) VALUES (
    v_sheet.id, v_actor, v_profile.full_name, v_profile.staff_id, p_action, v_old_status, v_new_status, p_comment
  );

  RETURN v_sheet;
END;
$$;

REVOKE ALL ON FUNCTION public.stain_qc_transition_workflow(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stain_qc_transition_workflow(UUID, TEXT, TEXT) TO authenticated;

DROP TRIGGER IF EXISTS trg_stain_qc_sheets_updated_at ON public.stain_qc_monthly_sheets;
CREATE TRIGGER trg_stain_qc_sheets_updated_at
  BEFORE UPDATE ON public.stain_qc_monthly_sheets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_stain_qc_daily_results_updated_at ON public.stain_qc_daily_results;
CREATE TRIGGER trg_stain_qc_daily_results_updated_at
  BEFORE UPDATE ON public.stain_qc_daily_results
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.trg_stain_qc_block_locked_sheet_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' AND NEW.status = 'approved' THEN
    IF NEW.form_code IS DISTINCT FROM OLD.form_code
       OR NEW.sheet_month IS DISTINCT FROM OLD.sheet_month
       OR NEW.sheet_year IS DISTINCT FROM OLD.sheet_year
       OR NEW.lot_number IS DISTINCT FROM OLD.lot_number
       OR NEW.expiry_date IS DISTINCT FROM OLD.expiry_date THEN
      RAISE EXCEPTION 'Approved stain QC sheets are locked. Create a controlled amendment instead.';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status IN ('submitted', 'reviewed', 'approved')
     AND NEW.status = 'draft'
     AND NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Workflow stage cannot be skipped or reversed without admin override';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stain_qc_block_locked_sheet_updates ON public.stain_qc_monthly_sheets;
CREATE TRIGGER trg_stain_qc_block_locked_sheet_updates
  BEFORE UPDATE ON public.stain_qc_monthly_sheets
  FOR EACH ROW EXECUTE FUNCTION public.trg_stain_qc_block_locked_sheet_updates();

ALTER TABLE public.stain_qc_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stain_qc_monthly_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stain_qc_daily_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stain_qc_responsibility_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stain_qc_corrective_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stain_qc_workflow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stain_qc_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stain_qc_criteria_select ON public.stain_qc_criteria;
CREATE POLICY stain_qc_criteria_select ON public.stain_qc_criteria
  FOR SELECT TO authenticated USING (public.has_permission('stain_qc.view'));

DROP POLICY IF EXISTS stain_qc_sheets_select ON public.stain_qc_monthly_sheets;
CREATE POLICY stain_qc_sheets_select ON public.stain_qc_monthly_sheets
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('stain_qc.view'));

DROP POLICY IF EXISTS stain_qc_sheets_insert ON public.stain_qc_monthly_sheets;
CREATE POLICY stain_qc_sheets_insert ON public.stain_qc_monthly_sheets
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('stain_qc.record') OR public.is_system_admin());

DROP POLICY IF EXISTS stain_qc_sheets_update ON public.stain_qc_monthly_sheets;
CREATE POLICY stain_qc_sheets_update ON public.stain_qc_monthly_sheets
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      (public.stain_qc_sheet_is_editable(status) AND public.has_permission('stain_qc.record'))
      OR public.has_permission('stain_qc.review')
      OR public.has_permission('stain_qc.approve')
      OR public.is_system_admin()
    )
  )
  WITH CHECK (
    public.has_permission('stain_qc.record')
    OR public.has_permission('stain_qc.review')
    OR public.has_permission('stain_qc.approve')
    OR public.is_system_admin()
  );

DROP POLICY IF EXISTS stain_qc_daily_results_all ON public.stain_qc_daily_results;
CREATE POLICY stain_qc_daily_results_all ON public.stain_qc_daily_results
  FOR ALL TO authenticated
  USING (public.has_permission('stain_qc.view'))
  WITH CHECK (
    public.has_permission('stain_qc.record')
    OR public.is_system_admin()
  );

DROP POLICY IF EXISTS stain_qc_responsibility_all ON public.stain_qc_responsibility_entries;
CREATE POLICY stain_qc_responsibility_all ON public.stain_qc_responsibility_entries
  FOR ALL TO authenticated
  USING (public.has_permission('stain_qc.view'))
  WITH CHECK (
    public.has_permission('stain_qc.record')
    OR public.is_system_admin()
  );

DROP POLICY IF EXISTS stain_qc_corrective_all ON public.stain_qc_corrective_actions;
CREATE POLICY stain_qc_corrective_all ON public.stain_qc_corrective_actions
  FOR ALL TO authenticated
  USING (public.has_permission('stain_qc.view'))
  WITH CHECK (
    public.has_permission('stain_qc.record')
    OR public.is_system_admin()
  );

DROP POLICY IF EXISTS stain_qc_workflow_events_select ON public.stain_qc_workflow_events;
CREATE POLICY stain_qc_workflow_events_select ON public.stain_qc_workflow_events
  FOR SELECT TO authenticated USING (public.has_permission('stain_qc.view'));

DROP POLICY IF EXISTS stain_qc_workflow_events_insert ON public.stain_qc_workflow_events;
CREATE POLICY stain_qc_workflow_events_insert ON public.stain_qc_workflow_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('stain_qc.record')
    OR public.has_permission('stain_qc.review')
    OR public.has_permission('stain_qc.approve')
    OR public.is_system_admin()
  );

DROP POLICY IF EXISTS stain_qc_audit_select ON public.stain_qc_audit_events;
CREATE POLICY stain_qc_audit_select ON public.stain_qc_audit_events
  FOR SELECT TO authenticated USING (public.has_permission('stain_qc.view'));

DROP POLICY IF EXISTS stain_qc_audit_insert ON public.stain_qc_audit_events;
CREATE POLICY stain_qc_audit_insert ON public.stain_qc_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('stain_qc.record')
    OR public.has_permission('stain_qc.review')
    OR public.has_permission('stain_qc.approve')
    OR public.is_system_admin()
  );

COMMIT;
