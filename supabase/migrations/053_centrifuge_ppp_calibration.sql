-- ============================================================================
-- Migration 053: Centrifuge Calibration for PPP (Form-Hema-009)
-- Dedicated parent/child workflow for Centrifuge platelet-poor plasma verification.
-- Does NOT auto-apply.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'centrifuge_ppp_calibration_status') THEN
    CREATE TYPE public.centrifuge_ppp_calibration_status AS ENUM (
      'draft',
      'completed',
      'pending_review',
      'pending_approval',
      'approved',
      'failed'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'centrifuge_ppp_sample_result') THEN
    CREATE TYPE public.centrifuge_ppp_sample_result AS ENUM ('pass', 'fail');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (code, module, description) VALUES
  ('ppm_calibration.approve', 'ppm_calibration', 'Approve PPM and calibration records')
ON CONFLICT (code) DO UPDATE SET
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'ppm_calibration.approve'
WHERE r.name IN ('system_admin', 'head_of_section')
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

-- Senior Technologist review
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'ppm_calibration.review'
WHERE r.name = 'senior_lab_technologist'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

-- Create permission for senior technologists
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'ppm_calibration.create'
WHERE r.name = 'senior_lab_technologist'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Parent: centrifuge PPP calibrations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.centrifuge_ppp_calibrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_equipment_id UUID NOT NULL REFERENCES public.instruments(id) ON DELETE RESTRICT,
  calibration_date DATE NOT NULL,
  next_due_date DATE,
  performed_by_type public.calibration_performed_by_type NOT NULL DEFAULT 'internal_staff',
  performed_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  performed_by_name TEXT NOT NULL,
  performed_by_staff_id TEXT,
  overall_result public.centrifuge_ppp_sample_result,
  status public.centrifuge_ppp_calibration_status NOT NULL DEFAULT 'draft',
  problem TEXT,
  corrective_action TEXT,
  comment TEXT,
  review_status TEXT NOT NULL DEFAULT 'Pending Review',
  review_decision TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_by_name TEXT,
  reviewed_by_staff_id TEXT,
  reviewed_at TIMESTAMPTZ,
  review_comment TEXT,
  approval_status TEXT NOT NULL DEFAULT 'Pending Approval',
  approval_decision TEXT,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by_name TEXT,
  approved_by_staff_id TEXT,
  approved_at TIMESTAMPTZ,
  approval_comment TEXT,
  final_pdf_path TEXT,
  final_pdf_name TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_by_name TEXT,
  deleted_by_staff_id TEXT,
  delete_reason TEXT,
  CONSTRAINT centrifuge_ppp_calibrations_review_status_check
    CHECK (review_status IN ('Pending Review', 'Reviewed')),
  CONSTRAINT centrifuge_ppp_calibrations_approval_status_check
    CHECK (approval_status IN ('Pending Approval', 'Approved'))
);

CREATE INDEX IF NOT EXISTS idx_centrifuge_ppp_calibrations_instrument
  ON public.centrifuge_ppp_calibrations(instrument_equipment_id, calibration_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_centrifuge_ppp_calibrations_status
  ON public.centrifuge_ppp_calibrations(status)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Child: five samples per calibration
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.centrifuge_ppp_calibration_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calibration_id UUID NOT NULL REFERENCES public.centrifuge_ppp_calibrations(id) ON DELETE CASCADE,
  sample_number SMALLINT NOT NULL,
  plt_result NUMERIC(8,2),
  centrifuge_speed_rpm NUMERIC(8,2),
  centrifuge_time_minutes NUMERIC(8,2),
  calculated_result public.centrifuge_ppp_sample_result,
  evidence_path TEXT,
  evidence_name TEXT,
  evidence_uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  evidence_uploaded_by_name TEXT,
  evidence_uploaded_by_staff_id TEXT,
  evidence_uploaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT centrifuge_ppp_samples_number_check
    CHECK (sample_number BETWEEN 1 AND 5),
  CONSTRAINT centrifuge_ppp_samples_unique_number
    UNIQUE (calibration_id, sample_number)
);

CREATE INDEX IF NOT EXISTS idx_centrifuge_ppp_samples_calibration
  ON public.centrifuge_ppp_calibration_samples(calibration_id, sample_number);

-- ---------------------------------------------------------------------------
-- Evidence replacement history
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.centrifuge_ppp_evidence_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calibration_id UUID NOT NULL REFERENCES public.centrifuge_ppp_calibrations(id) ON DELETE CASCADE,
  sample_id UUID NOT NULL REFERENCES public.centrifuge_ppp_calibration_samples(id) ON DELETE CASCADE,
  sample_number SMALLINT NOT NULL,
  previous_path TEXT NOT NULL,
  previous_name TEXT NOT NULL,
  new_path TEXT NOT NULL,
  new_name TEXT NOT NULL,
  replacement_reason TEXT,
  replaced_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  replaced_by_name TEXT NOT NULL,
  replaced_by_staff_id TEXT,
  replaced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_centrifuge_ppp_evidence_history_calibration
  ON public.centrifuge_ppp_evidence_history(calibration_id, replaced_at DESC);

-- ---------------------------------------------------------------------------
-- Audit events
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.centrifuge_ppp_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calibration_id UUID NOT NULL REFERENCES public.centrifuge_ppp_calibrations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  performed_by_name TEXT,
  performed_by_staff_id TEXT,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_centrifuge_ppp_audit_calibration
  ON public.centrifuge_ppp_audit_events(calibration_id, performed_at DESC);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_centrifuge_ppp_calibrations_updated_at ON public.centrifuge_ppp_calibrations;
CREATE TRIGGER trg_centrifuge_ppp_calibrations_updated_at
  BEFORE UPDATE ON public.centrifuge_ppp_calibrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_centrifuge_ppp_samples_updated_at ON public.centrifuge_ppp_calibration_samples;
CREATE TRIGGER trg_centrifuge_ppp_samples_updated_at
  BEFORE UPDATE ON public.centrifuge_ppp_calibration_samples
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sync instrument calibration due date when approved
CREATE OR REPLACE FUNCTION public.sync_centrifuge_ppp_calibration_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved'::public.centrifuge_ppp_calibration_status
     AND NEW.deleted_at IS NULL
     AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.next_due_date IS DISTINCT FROM NEW.next_due_date)
  THEN
    UPDATE public.instruments
    SET
      calibration_due_date = NEW.next_due_date,
      updated_at = NOW()
    WHERE id = NEW.instrument_equipment_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_centrifuge_ppp_sync_instrument ON public.centrifuge_ppp_calibrations;
CREATE TRIGGER trg_centrifuge_ppp_sync_instrument
  AFTER INSERT OR UPDATE ON public.centrifuge_ppp_calibrations
  FOR EACH ROW EXECUTE FUNCTION public.sync_centrifuge_ppp_calibration_summary();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.centrifuge_ppp_calibrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centrifuge_ppp_calibration_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centrifuge_ppp_evidence_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centrifuge_ppp_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS centrifuge_ppp_calibrations_select ON public.centrifuge_ppp_calibrations;
CREATE POLICY centrifuge_ppp_calibrations_select ON public.centrifuge_ppp_calibrations
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.has_permission('ppm_calibration.view')
  );

DROP POLICY IF EXISTS centrifuge_ppp_calibrations_insert ON public.centrifuge_ppp_calibrations;
CREATE POLICY centrifuge_ppp_calibrations_insert ON public.centrifuge_ppp_calibrations
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('ppm_calibration.create') OR public.is_system_admin());

DROP POLICY IF EXISTS centrifuge_ppp_calibrations_update ON public.centrifuge_ppp_calibrations;
CREATE POLICY centrifuge_ppp_calibrations_update ON public.centrifuge_ppp_calibrations
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.has_permission('ppm_calibration.edit')
      OR public.has_permission('ppm_calibration.review')
      OR public.has_permission('ppm_calibration.approve')
      OR public.is_system_admin()
    )
  )
  WITH CHECK (
    public.has_permission('ppm_calibration.edit')
    OR public.has_permission('ppm_calibration.review')
    OR public.has_permission('ppm_calibration.approve')
    OR public.is_system_admin()
  );

DROP POLICY IF EXISTS centrifuge_ppp_samples_select ON public.centrifuge_ppp_calibration_samples;
CREATE POLICY centrifuge_ppp_samples_select ON public.centrifuge_ppp_calibration_samples
  FOR SELECT TO authenticated
  USING (public.has_permission('ppm_calibration.view'));

DROP POLICY IF EXISTS centrifuge_ppp_samples_insert ON public.centrifuge_ppp_calibration_samples;
CREATE POLICY centrifuge_ppp_samples_insert ON public.centrifuge_ppp_calibration_samples
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('ppm_calibration.create') OR public.has_permission('ppm_calibration.edit') OR public.is_system_admin());

DROP POLICY IF EXISTS centrifuge_ppp_samples_update ON public.centrifuge_ppp_calibration_samples;
CREATE POLICY centrifuge_ppp_samples_update ON public.centrifuge_ppp_calibration_samples
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('ppm_calibration.edit')
    OR public.has_permission('ppm_calibration.create')
    OR public.is_system_admin()
  )
  WITH CHECK (
    public.has_permission('ppm_calibration.edit')
    OR public.has_permission('ppm_calibration.create')
    OR public.is_system_admin()
  );

DROP POLICY IF EXISTS centrifuge_ppp_evidence_history_select ON public.centrifuge_ppp_evidence_history;
CREATE POLICY centrifuge_ppp_evidence_history_select ON public.centrifuge_ppp_evidence_history
  FOR SELECT TO authenticated
  USING (public.has_permission('ppm_calibration.view'));

DROP POLICY IF EXISTS centrifuge_ppp_evidence_history_insert ON public.centrifuge_ppp_evidence_history;
CREATE POLICY centrifuge_ppp_evidence_history_insert ON public.centrifuge_ppp_evidence_history
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('ppm_calibration.create')
    OR public.has_permission('ppm_calibration.edit')
    OR public.is_system_admin()
  );

DROP POLICY IF EXISTS centrifuge_ppp_audit_select ON public.centrifuge_ppp_audit_events;
CREATE POLICY centrifuge_ppp_audit_select ON public.centrifuge_ppp_audit_events
  FOR SELECT TO authenticated
  USING (public.has_permission('ppm_calibration.view'));

DROP POLICY IF EXISTS centrifuge_ppp_audit_insert ON public.centrifuge_ppp_audit_events;
CREATE POLICY centrifuge_ppp_audit_insert ON public.centrifuge_ppp_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('ppm_calibration.create')
    OR public.has_permission('ppm_calibration.edit')
    OR public.has_permission('ppm_calibration.review')
    OR public.has_permission('ppm_calibration.approve')
    OR public.is_system_admin()
  );

COMMIT;
