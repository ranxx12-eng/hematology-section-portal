-- ============================================================================
-- Migration 059: QC Corrective Actions (Form-Hema-016 ALINITY-HQ)
-- Does NOT auto-apply.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qc_corrective_action_status') THEN
    CREATE TYPE public.qc_corrective_action_status AS ENUM (
      'required',
      'in_progress',
      'completed'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qc_corrective_result_after_action') THEN
    CREATE TYPE public.qc_corrective_result_after_action AS ENUM (
      'resolved_within_range',
      'still_out_of_range',
      'follow_up_required',
      'not_applicable'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qc_corrective_monthly_status') THEN
    CREATE TYPE public.qc_corrective_monthly_status AS ENUM (
      'open',
      'ready_for_review',
      'reviewed',
      'approved',
      'returned',
      'archived'
    );
  END IF;
END $$;

INSERT INTO public.permissions (code, module, description) VALUES
  ('qc_corrective.view', 'qc_corrective', 'View QC corrective action worklist'),
  ('qc_corrective.edit', 'qc_corrective', 'Enter QC corrective actions'),
  ('qc_corrective.review', 'qc_corrective', 'Review monthly QC corrective action reports'),
  ('qc_corrective.approve', 'qc_corrective', 'Approve monthly QC corrective action reports'),
  ('qc_corrective.export', 'qc_corrective', 'Export/print Form-Hema-016'),
  ('qc_corrective.archive', 'qc_corrective', 'Archive QC corrective action records')
ON CONFLICT (code) DO UPDATE SET
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code LIKE 'qc_corrective.%'
WHERE r.name = 'system_admin'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN ('qc_corrective.view', 'qc_corrective.edit')
WHERE r.name = 'lab_technologist'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'qc_corrective.view', 'qc_corrective.edit', 'qc_corrective.review', 'qc_corrective.export'
)
WHERE r.name = 'senior_lab_technologist'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'qc_corrective.view', 'qc_corrective.edit', 'qc_corrective.review', 'qc_corrective.export'
)
WHERE r.name IN ('quality_officer', 'quality_link')
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'qc_corrective.view', 'qc_corrective.review', 'qc_corrective.approve', 'qc_corrective.export'
)
WHERE r.name = 'section_supervisor'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'qc_corrective.view', 'qc_corrective.approve', 'qc_corrective.export'
)
WHERE r.name = 'head_of_section'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'qc_corrective.view'
WHERE r.name IN ('lab_director', 'lab_manager', 'team_leader')
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.qc_corrective_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qc_record_id UUID NOT NULL UNIQUE REFERENCES public.qc_records(id) ON DELETE CASCADE,
  corrected_value NUMERIC(12, 4),
  corrected_value_text TEXT,
  corrective_action_code TEXT CHECK (
    corrective_action_code IS NULL OR corrective_action_code IN ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I')
  ),
  corrective_action_text_snapshot TEXT,
  explanation TEXT,
  remarks TEXT,
  result_after_action public.qc_corrective_result_after_action,
  action_status public.qc_corrective_action_status NOT NULL DEFAULT 'required',
  completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_by_name TEXT,
  completed_by_staff_id TEXT,
  completed_at TIMESTAMPTZ,
  prepared_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  prepared_by_name TEXT,
  prepared_by_staff_id TEXT,
  prepared_at TIMESTAMPTZ,
  instrument_id_snapshot UUID,
  instrument_name_snapshot TEXT,
  qc_material_snapshot TEXT,
  analyte_snapshot TEXT,
  qc_level_snapshot TEXT,
  failed_value_snapshot TEXT,
  operator_name_snapshot TEXT,
  operator_staff_id_snapshot TEXT,
  recorded_at_snapshot TIMESTAMPTZ,
  lot_number_snapshot TEXT,
  expiry_date_snapshot DATE,
  original_qc_status_snapshot TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.qc_corrective_action_monthly_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL CHECK (year >= 2000 AND year <= 2100),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  instrument_id UUID NOT NULL REFERENCES public.instruments(id) ON DELETE RESTRICT,
  form_code TEXT NOT NULL DEFAULT 'Form-Hema-016',
  qid TEXT NOT NULL DEFAULT 'HMG/SAH/QID/9168',
  status public.qc_corrective_monthly_status NOT NULL DEFAULT 'open',
  version_number INTEGER NOT NULL DEFAULT 1,
  parent_review_id UUID REFERENCES public.qc_corrective_action_monthly_reviews(id) ON DELETE SET NULL,
  amendment_reason TEXT,
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT qc_corrective_monthly_unique UNIQUE (year, month, instrument_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.qc_corrective_action_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qc_record_id UUID REFERENCES public.qc_records(id) ON DELETE SET NULL,
  monthly_review_id UUID REFERENCES public.qc_corrective_action_monthly_reviews(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name TEXT,
  staff_id TEXT,
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  comment TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qc_corrective_actions_record ON public.qc_corrective_actions(qc_record_id);
CREATE INDEX IF NOT EXISTS idx_qc_corrective_actions_status ON public.qc_corrective_actions(action_status)
  WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_qc_corrective_monthly_period ON public.qc_corrective_action_monthly_reviews(year, month, instrument_id);
CREATE INDEX IF NOT EXISTS idx_qc_corrective_audit_record ON public.qc_corrective_action_audit_events(qc_record_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qc_corrective_audit_monthly ON public.qc_corrective_action_audit_events(monthly_review_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_qc_corrective_actions_updated_at ON public.qc_corrective_actions;
CREATE TRIGGER trg_qc_corrective_actions_updated_at
  BEFORE UPDATE ON public.qc_corrective_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_qc_corrective_monthly_updated_at ON public.qc_corrective_action_monthly_reviews;
CREATE TRIGGER trg_qc_corrective_monthly_updated_at
  BEFORE UPDATE ON public.qc_corrective_action_monthly_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.qc_corrective_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_corrective_action_monthly_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_corrective_action_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qc_corrective_actions_select ON public.qc_corrective_actions;
CREATE POLICY qc_corrective_actions_select ON public.qc_corrective_actions
  FOR SELECT TO authenticated
  USING (archived_at IS NULL AND public.has_permission('qc_corrective.view'));

DROP POLICY IF EXISTS qc_corrective_actions_insert ON public.qc_corrective_actions;
CREATE POLICY qc_corrective_actions_insert ON public.qc_corrective_actions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('qc_corrective.edit') OR public.is_system_admin());

DROP POLICY IF EXISTS qc_corrective_actions_update ON public.qc_corrective_actions;
CREATE POLICY qc_corrective_actions_update ON public.qc_corrective_actions
  FOR UPDATE TO authenticated
  USING (
    archived_at IS NULL
    AND (
      public.has_permission('qc_corrective.edit')
      OR public.has_permission('qc_corrective.review')
      OR public.has_permission('qc_corrective.approve')
      OR public.is_system_admin()
    )
  )
  WITH CHECK (
    public.has_permission('qc_corrective.edit')
    OR public.has_permission('qc_corrective.review')
    OR public.has_permission('qc_corrective.approve')
    OR public.is_system_admin()
  );

DROP POLICY IF EXISTS qc_corrective_monthly_select ON public.qc_corrective_action_monthly_reviews;
CREATE POLICY qc_corrective_monthly_select ON public.qc_corrective_action_monthly_reviews
  FOR SELECT TO authenticated
  USING (public.has_permission('qc_corrective.view'));

DROP POLICY IF EXISTS qc_corrective_monthly_insert ON public.qc_corrective_monthly_reviews;
CREATE POLICY qc_corrective_monthly_insert ON public.qc_corrective_action_monthly_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('qc_corrective.review')
    OR public.has_permission('qc_corrective.approve')
    OR public.has_permission('qc_corrective.edit')
    OR public.is_system_admin()
  );

DROP POLICY IF EXISTS qc_corrective_monthly_update ON public.qc_corrective_action_monthly_reviews;
CREATE POLICY qc_corrective_monthly_update ON public.qc_corrective_action_monthly_reviews
  FOR UPDATE TO authenticated
  USING (
    status <> 'approved'::public.qc_corrective_monthly_status
    OR public.is_system_admin()
  )
  WITH CHECK (
    public.has_permission('qc_corrective.review')
    OR public.has_permission('qc_corrective.approve')
    OR public.has_permission('qc_corrective.edit')
    OR public.is_system_admin()
  );

DROP POLICY IF EXISTS qc_corrective_audit_select ON public.qc_corrective_action_audit_events;
CREATE POLICY qc_corrective_audit_select ON public.qc_corrective_action_audit_events
  FOR SELECT TO authenticated
  USING (public.has_permission('qc_corrective.view'));

DROP POLICY IF EXISTS qc_corrective_audit_insert ON public.qc_corrective_action_audit_events;
CREATE POLICY qc_corrective_audit_insert ON public.qc_corrective_action_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('qc_corrective.edit')
    OR public.has_permission('qc_corrective.review')
    OR public.has_permission('qc_corrective.approve')
    OR public.has_permission('qc_corrective.export')
    OR public.is_system_admin()
  );

COMMIT;
