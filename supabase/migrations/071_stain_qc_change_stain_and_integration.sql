-- ============================================================================
-- Migration 071: Form-Hema-021 Change Stain schema delta (additive, idempotent)
-- Safe when production applied original 070 OR the modified 070 working tree.
-- Does not modify migration 070 file history. Does not delete stain QC data.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stain_qc_corrective_actions'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'stain_qc_corrective_actions'
        AND column_name = 'action_code'
    ) THEN
      ALTER TABLE public.stain_qc_corrective_actions
        ADD COLUMN action_code TEXT NOT NULL DEFAULT 'change_stain';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'stain_qc_corrective_actions'
        AND column_name = 'recorded_by_initials'
    ) THEN
      ALTER TABLE public.stain_qc_corrective_actions
        ADD COLUMN recorded_by_initials TEXT;
      UPDATE public.stain_qc_corrective_actions
      SET recorded_by_initials = COALESCE(
        NULLIF(trim(recorded_by_initials), ''),
        NULLIF(
          (
            SELECT string_agg(upper(left(word, 1)), '')
            FROM regexp_split_to_table(trim(recorded_by_name), '\s+') AS word
            WHERE word <> ''
          ),
          ''
        ),
        '—'
      )
      WHERE recorded_by_initials IS NULL OR trim(recorded_by_initials) = '';
      ALTER TABLE public.stain_qc_corrective_actions
        ALTER COLUMN recorded_by_initials SET NOT NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'stain_qc_corrective_actions'
        AND column_name = 'confirmed_at'
    ) THEN
      ALTER TABLE public.stain_qc_corrective_actions
        ADD COLUMN confirmed_at TIMESTAMPTZ;
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'stain_qc_corrective_actions'
          AND column_name = 'completed_at'
      ) THEN
        UPDATE public.stain_qc_corrective_actions
        SET confirmed_at = COALESCE(completed_at, recorded_at, NOW())
        WHERE confirmed_at IS NULL;
      ELSE
        UPDATE public.stain_qc_corrective_actions
        SET confirmed_at = COALESCE(recorded_at, NOW())
        WHERE confirmed_at IS NULL;
      END IF;
      ALTER TABLE public.stain_qc_corrective_actions
        ALTER COLUMN confirmed_at SET NOT NULL,
        ALTER COLUMN confirmed_at SET DEFAULT NOW();
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'stain_qc_corrective_actions'
        AND column_name = 'completed_at'
    ) THEN
      UPDATE public.stain_qc_corrective_actions
      SET confirmed_at = COALESCE(confirmed_at, completed_at, recorded_at, NOW())
      WHERE confirmed_at IS NULL;
      ALTER TABLE public.stain_qc_corrective_actions DROP COLUMN completed_at;
    END IF;

    ALTER TABLE public.stain_qc_corrective_actions
      ALTER COLUMN comment DROP NOT NULL;

    UPDATE public.stain_qc_corrective_actions
    SET action_code = 'change_stain'
    WHERE action_code IS NULL OR trim(action_code) = '';

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'stain_qc_corrective_actions_action_code_check'
        AND conrelid = 'public.stain_qc_corrective_actions'::regclass
    ) THEN
      ALTER TABLE public.stain_qc_corrective_actions
        ADD CONSTRAINT stain_qc_corrective_actions_action_code_check
        CHECK (action_code = 'change_stain');
    END IF;
  END IF;
END $$;

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
        AND (
          ca.id IS NULL
          OR ca.confirmed_at IS NULL
          OR ca.action_code IS DISTINCT FROM 'change_stain'
        )
    ) THEN
      RAISE EXCEPTION 'All Not Acceptable results require Change Stain confirmation before submission';
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

COMMIT;
