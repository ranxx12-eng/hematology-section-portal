-- ============================================================================
-- Migration 046: QC Review & Approval workflow by frequency (Daily / Monthly)
-- Idempotent. Does NOT auto-apply — run manually when ready.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- QC frequency enum
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qc_frequency') THEN
    CREATE TYPE public.qc_frequency AS ENUM ('daily', 'monthly');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Workflow columns on qc_records
-- ---------------------------------------------------------------------------

ALTER TABLE public.qc_records
  ADD COLUMN IF NOT EXISTS qc_frequency public.qc_frequency NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'Pending Review',
  ADD COLUMN IF NOT EXISTS reviewed_by_name TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by_staff_id TEXT,
  ADD COLUMN IF NOT EXISTS review_comment TEXT,
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'Pending Approval',
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by_name TEXT,
  ADD COLUMN IF NOT EXISTS approved_by_staff_id TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_comment TEXT;

-- reviewed_by / reviewed_at may exist from original schema; ensure reviewed_at exists
ALTER TABLE public.qc_records
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

UPDATE public.qc_records
SET review_status = 'Pending Review'
WHERE review_status IS NULL OR btrim(review_status) = '';

UPDATE public.qc_records
SET approval_status = 'Pending Approval'
WHERE approval_status IS NULL OR btrim(approval_status) = '';

UPDATE public.qc_records
SET qc_frequency = 'daily'::public.qc_frequency
WHERE qc_frequency IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'qc_records_review_status_check'
      AND conrelid = 'public.qc_records'::regclass
  ) THEN
    ALTER TABLE public.qc_records
      ADD CONSTRAINT qc_records_review_status_check
      CHECK (review_status IN ('Pending Review', 'Reviewed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'qc_records_approval_status_check'
      AND conrelid = 'public.qc_records'::regclass
  ) THEN
    ALTER TABLE public.qc_records
      ADD CONSTRAINT qc_records_approval_status_check
      CHECK (approval_status IN ('Pending Approval', 'Approved'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_qc_records_qc_frequency
  ON public.qc_records(qc_frequency) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_qc_records_review_status
  ON public.qc_records(review_status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_qc_records_approval_status
  ON public.qc_records(approval_status) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (code, module, description) VALUES
  ('qc.review_daily', 'qc', 'Review Daily QC records'),
  ('qc.review_monthly', 'qc', 'Review Monthly QC records'),
  ('qc.approve', 'qc', 'Supervisor approval of reviewed QC records')
ON CONFLICT (code) DO UPDATE SET
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'qc.review_daily'
WHERE r.name IN ('senior_lab_technologist', 'quality_officer', 'system_admin')
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'qc.review_monthly'
WHERE r.name IN ('quality_officer', 'system_admin')
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'qc.approve'
WHERE r.name IN ('section_supervisor', 'system_admin')
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_review_qc_record(p_frequency public.qc_frequency)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (p_frequency = 'daily'::public.qc_frequency AND public.has_permission('qc.review_daily'))
    OR (p_frequency = 'monthly'::public.qc_frequency AND public.has_permission('qc.review_monthly'));
$$;

CREATE OR REPLACE FUNCTION public.can_approve_qc_record()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_permission('qc.approve');
$$;

CREATE OR REPLACE FUNCTION public.enforce_qc_workflow_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  review_changed BOOLEAN;
  approval_changed BOOLEAN;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  review_changed :=
    OLD.review_status IS DISTINCT FROM NEW.review_status
    OR OLD.review_comment IS DISTINCT FROM NEW.review_comment
    OR OLD.reviewed_by IS DISTINCT FROM NEW.reviewed_by
    OR OLD.reviewed_by_name IS DISTINCT FROM NEW.reviewed_by_name
    OR OLD.reviewed_by_staff_id IS DISTINCT FROM NEW.reviewed_by_staff_id
    OR OLD.reviewed_at IS DISTINCT FROM NEW.reviewed_at;

  approval_changed :=
    OLD.approval_status IS DISTINCT FROM NEW.approval_status
    OR OLD.approval_comment IS DISTINCT FROM NEW.approval_comment
    OR OLD.approved_by IS DISTINCT FROM NEW.approved_by
    OR OLD.approved_by_name IS DISTINCT FROM NEW.approved_by_name
    OR OLD.approved_by_staff_id IS DISTINCT FROM NEW.approved_by_staff_id
    OR OLD.approved_at IS DISTINCT FROM NEW.approved_at;

  IF review_changed THEN
    IF OLD.review_status <> 'Pending Review' OR NEW.review_status <> 'Reviewed' THEN
      RAISE EXCEPTION 'QC review can only transition from Pending Review to Reviewed'
        USING ERRCODE = '42501';
    END IF;

    IF NOT public.can_review_qc_record(NEW.qc_frequency) THEN
      RAISE EXCEPTION 'Not authorized to review this QC frequency'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.performed_by_user_id IS NOT NULL AND NEW.performed_by_user_id = auth.uid() THEN
      RAISE EXCEPTION 'Cannot review QC performed by yourself'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.reviewed_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Reviewer identity must match authenticated user'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF approval_changed THEN
    IF OLD.approval_status <> 'Pending Approval' OR NEW.approval_status <> 'Approved' THEN
      RAISE EXCEPTION 'QC approval can only transition from Pending Approval to Approved'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.review_status <> 'Reviewed' THEN
      RAISE EXCEPTION 'QC must be reviewed before supervisor approval'
        USING ERRCODE = '42501';
    END IF;

    IF NOT public.can_approve_qc_record() THEN
      RAISE EXCEPTION 'Not authorized to approve QC records'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.approved_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Approver identity must match authenticated user'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF review_changed OR approval_changed THEN
    IF NOT public.is_system_admin() THEN
      IF OLD.qc_frequency IS DISTINCT FROM NEW.qc_frequency
        OR OLD.instrument_id IS DISTINCT FROM NEW.instrument_id
        OR OLD.test_name IS DISTINCT FROM NEW.test_name
        OR OLD.control_level IS DISTINCT FROM NEW.control_level
        OR OLD.recorded_at IS DISTINCT FROM NEW.recorded_at
        OR OLD.qc_status IS DISTINCT FROM NEW.qc_status
        OR OLD.corrective_actions IS DISTINCT FROM NEW.corrective_actions
        OR OLD.corrective_action_comment IS DISTINCT FROM NEW.corrective_action_comment
        OR OLD.corrective_action_other IS DISTINCT FROM NEW.corrective_action_other
        OR OLD.resolution_status IS DISTINCT FROM NEW.resolution_status
        OR OLD.action_at IS DISTINCT FROM NEW.action_at
        OR OLD.action_by IS DISTINCT FROM NEW.action_by
        OR OLD.action_by_name IS DISTINCT FROM NEW.action_by_name
        OR OLD.action_by_staff_id IS DISTINCT FROM NEW.action_by_staff_id
        OR OLD.resolved_at IS DISTINCT FROM NEW.resolved_at
        OR OLD.resolved_by IS DISTINCT FROM NEW.resolved_by
        OR OLD.resolved_by_name IS DISTINCT FROM NEW.resolved_by_name
        OR OLD.performed_by_user_id IS DISTINCT FROM NEW.performed_by_user_id
        OR OLD.performed_by_name IS DISTINCT FROM NEW.performed_by_name
        OR OLD.performed_by_staff_id IS DISTINCT FROM NEW.performed_by_staff_id
        OR OLD.comment IS DISTINCT FROM NEW.comment
      THEN
        RAISE EXCEPTION 'Review/approval updates cannot modify operational QC fields'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  IF NOT review_changed AND NOT approval_changed AND NOT public.is_system_admin() THEN
    IF OLD.review_status IS DISTINCT FROM NEW.review_status
      OR OLD.approval_status IS DISTINCT FROM NEW.approval_status
      OR OLD.reviewed_by IS DISTINCT FROM NEW.reviewed_by
      OR OLD.reviewed_by_name IS DISTINCT FROM NEW.reviewed_by_name
      OR OLD.reviewed_by_staff_id IS DISTINCT FROM NEW.reviewed_by_staff_id
      OR OLD.reviewed_at IS DISTINCT FROM NEW.reviewed_at
      OR OLD.review_comment IS DISTINCT FROM NEW.review_comment
      OR OLD.approved_by IS DISTINCT FROM NEW.approved_by
      OR OLD.approved_by_name IS DISTINCT FROM NEW.approved_by_name
      OR OLD.approved_by_staff_id IS DISTINCT FROM NEW.approved_by_staff_id
      OR OLD.approved_at IS DISTINCT FROM NEW.approved_at
      OR OLD.approval_comment IS DISTINCT FROM NEW.approval_comment
    THEN
      RAISE EXCEPTION 'QC review/approval fields can only be changed through review or approval workflow'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.can_review_qc_record(public.qc_frequency) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_approve_qc_record() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_qc_workflow_update() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.can_review_qc_record(public.qc_frequency) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_approve_qc_record() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_qc_workflow_update() TO authenticated;

DROP TRIGGER IF EXISTS trg_qc_records_workflow ON public.qc_records;

CREATE TRIGGER trg_qc_records_workflow
  BEFORE UPDATE ON public.qc_records
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_qc_workflow_update();

COMMIT;
