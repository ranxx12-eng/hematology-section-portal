-- ============================================================================
-- Migration 047: Structured QC review/approval decisions
-- Adds review_decision and approval_decision (accept | not_accept | need_follow_up).
-- Idempotent. Does NOT auto-apply — run manually when ready.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qc_decision') THEN
    CREATE TYPE public.qc_decision AS ENUM ('accept', 'not_accept', 'need_follow_up');
  END IF;
END $$;

ALTER TABLE public.qc_records
  ADD COLUMN IF NOT EXISTS review_decision public.qc_decision,
  ADD COLUMN IF NOT EXISTS approval_decision public.qc_decision;

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
    OR OLD.review_decision IS DISTINCT FROM NEW.review_decision
    OR OLD.review_comment IS DISTINCT FROM NEW.review_comment
    OR OLD.reviewed_by IS DISTINCT FROM NEW.reviewed_by
    OR OLD.reviewed_by_name IS DISTINCT FROM NEW.reviewed_by_name
    OR OLD.reviewed_by_staff_id IS DISTINCT FROM NEW.reviewed_by_staff_id
    OR OLD.reviewed_at IS DISTINCT FROM NEW.reviewed_at;

  approval_changed :=
    OLD.approval_status IS DISTINCT FROM NEW.approval_status
    OR OLD.approval_decision IS DISTINCT FROM NEW.approval_decision
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

    IF NEW.review_decision IS NULL THEN
      RAISE EXCEPTION 'Review decision is required'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.review_decision IN ('not_accept'::public.qc_decision, 'need_follow_up'::public.qc_decision)
      AND (NEW.review_comment IS NULL OR btrim(NEW.review_comment) = '') THEN
      RAISE EXCEPTION 'Additional comment is required for this review decision'
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

    IF NEW.approval_decision IS NULL THEN
      RAISE EXCEPTION 'Approval decision is required'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.approval_decision IN ('not_accept'::public.qc_decision, 'need_follow_up'::public.qc_decision)
      AND (NEW.approval_comment IS NULL OR btrim(NEW.approval_comment) = '') THEN
      RAISE EXCEPTION 'Additional comment is required for this approval decision'
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
      OR OLD.review_decision IS DISTINCT FROM NEW.review_decision
      OR OLD.approval_decision IS DISTINCT FROM NEW.approval_decision
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

COMMIT;
