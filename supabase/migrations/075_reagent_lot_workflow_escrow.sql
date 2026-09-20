-- ============================================================================
-- Migration 075: Replace session bypass flags with internal workflow escrows
-- Authenticated users cannot set bypass flags or insert escrows directly.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public._reagent_lot_workflow_escrows (
  comparison_id UUID PRIMARY KEY,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public._reagent_lot_activation_escrows (
  comparison_id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE ALL ON public._reagent_lot_workflow_escrows FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public._reagent_lot_activation_escrows FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._claim_reagent_lot_workflow_escrow(
  p_comparison_id UUID,
  p_action TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public._reagent_lot_workflow_escrows (comparison_id, action)
  VALUES (p_comparison_id, p_action)
  ON CONFLICT (comparison_id) DO UPDATE
    SET action = EXCLUDED.action,
        created_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public._consume_reagent_lot_workflow_escrow(p_comparison_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public._reagent_lot_workflow_escrows
  WHERE comparison_id = p_comparison_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public._claim_reagent_lot_activation_escrow(p_comparison_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public._reagent_lot_activation_escrows (comparison_id)
  VALUES (p_comparison_id)
  ON CONFLICT (comparison_id) DO UPDATE SET created_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public._consume_reagent_lot_activation_escrow(p_comparison_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public._reagent_lot_activation_escrows
  WHERE comparison_id = p_comparison_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

REVOKE ALL ON FUNCTION public._claim_reagent_lot_workflow_escrow(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._consume_reagent_lot_workflow_escrow(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._claim_reagent_lot_activation_escrow(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._consume_reagent_lot_activation_escrow(UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.enforce_reagent_lot_workflow_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  workflow_changed BOOLEAN;
  activation_changed BOOLEAN;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  workflow_changed :=
    OLD.status IS DISTINCT FROM NEW.status
    OR OLD.prepared_by IS DISTINCT FROM NEW.prepared_by
    OR OLD.prepared_by_name IS DISTINCT FROM NEW.prepared_by_name
    OR OLD.prepared_by_staff_id IS DISTINCT FROM NEW.prepared_by_staff_id
    OR OLD.prepared_at IS DISTINCT FROM NEW.prepared_at
    OR OLD.reviewed_by IS DISTINCT FROM NEW.reviewed_by
    OR OLD.reviewed_by_name IS DISTINCT FROM NEW.reviewed_by_name
    OR OLD.reviewed_by_staff_id IS DISTINCT FROM NEW.reviewed_by_staff_id
    OR OLD.reviewed_at IS DISTINCT FROM NEW.reviewed_at
    OR OLD.review_comment IS DISTINCT FROM NEW.review_comment
    OR OLD.approved_by IS DISTINCT FROM NEW.approved_by
    OR OLD.approved_by_name IS DISTINCT FROM NEW.approved_by_name
    OR OLD.approved_by_staff_id IS DISTINCT FROM NEW.approved_by_staff_id
    OR OLD.approved_at IS DISTINCT FROM NEW.approved_at
    OR OLD.approval_comment IS DISTINCT FROM NEW.approval_comment;

  activation_changed :=
    OLD.activated_at IS DISTINCT FROM NEW.activated_at
    OR OLD.activated_by IS DISTINCT FROM NEW.activated_by;

  IF workflow_changed
    AND NOT public._consume_reagent_lot_workflow_escrow(NEW.id) THEN
    RAISE EXCEPTION 'Reagent lot study workflow fields can only be changed through workflow actions'
      USING ERRCODE = '42501';
  END IF;

  IF activation_changed
    AND NOT public._consume_reagent_lot_activation_escrow(NEW.id) THEN
    RAISE EXCEPTION 'Reagent lot activation can only be performed through activate_reagent_lot_study'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;

-- Rewrite workflow RPC to use escrows (no session bypass flags)
CREATE OR REPLACE FUNCTION public.perform_reagent_lot_workflow_action(
  p_comparison_id UUID,
  p_action TEXT,
  p_comment TEXT DEFAULT NULL
)
RETURNS public.inventory_reagent_lot_comparisons
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_row public.inventory_reagent_lot_comparisons%ROWTYPE;
  v_staff_name TEXT;
  v_staff_id TEXT;
  v_new_status public.inventory_lot_study_status;
  v_previous_status public.inventory_lot_study_status;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT public.has_permission('inventory.manage') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  SELECT p.full_name, p.staff_id
  INTO v_staff_name, v_staff_id
  FROM public.profiles p
  WHERE p.id = v_actor AND p.deleted_at IS NULL;

  SELECT * INTO v_row
  FROM public.inventory_reagent_lot_comparisons
  WHERE id = p_comparison_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Study not found';
  END IF;

  v_previous_status := v_row.status;
  v_new_status := v_row.status;

  CASE p_action
    WHEN 'submit' THEN
      IF v_row.status NOT IN ('draft'::public.inventory_lot_study_status, 'returned'::public.inventory_lot_study_status) THEN
        RAISE EXCEPTION 'Study cannot be submitted in its current status';
      END IF;
      v_new_status := 'pending_review'::public.inventory_lot_study_status;
      PERFORM public._claim_reagent_lot_workflow_escrow(p_comparison_id, p_action);
      UPDATE public.inventory_reagent_lot_comparisons
      SET
        status = v_new_status,
        prepared_at = NOW(),
        prepared_by = v_actor,
        prepared_by_name = v_staff_name,
        prepared_by_staff_id = v_staff_id,
        updated_by = v_actor,
        updated_at = NOW()
      WHERE id = p_comparison_id
      RETURNING * INTO v_row;

    WHEN 'review' THEN
      IF v_row.status <> 'pending_review'::public.inventory_lot_study_status THEN
        RAISE EXCEPTION 'Study is not pending review';
      END IF;
      IF v_row.prepared_by IS NOT NULL AND v_row.prepared_by = v_actor THEN
        RAISE EXCEPTION 'Prepared by and reviewed by must be different users';
      END IF;
      v_new_status := 'pending_approval'::public.inventory_lot_study_status;
      PERFORM public._claim_reagent_lot_workflow_escrow(p_comparison_id, p_action);
      UPDATE public.inventory_reagent_lot_comparisons
      SET
        status = v_new_status,
        reviewed_by = v_actor,
        reviewed_by_name = v_staff_name,
        reviewed_by_staff_id = v_staff_id,
        reviewed_at = NOW(),
        review_comment = p_comment,
        updated_by = v_actor,
        updated_at = NOW()
      WHERE id = p_comparison_id
      RETURNING * INTO v_row;

    WHEN 'return' THEN
      IF v_row.status = 'pending_review'::public.inventory_lot_study_status THEN
        IF v_row.prepared_by IS NOT NULL AND v_row.prepared_by = v_actor THEN
          RAISE EXCEPTION 'Prepared by and reviewed by must be different users';
        END IF;
        v_new_status := 'returned'::public.inventory_lot_study_status;
        PERFORM public._claim_reagent_lot_workflow_escrow(p_comparison_id, p_action);
        UPDATE public.inventory_reagent_lot_comparisons
        SET
          status = v_new_status,
          reviewed_by = v_actor,
          reviewed_by_name = v_staff_name,
          reviewed_by_staff_id = v_staff_id,
          reviewed_at = NOW(),
          review_comment = p_comment,
          updated_by = v_actor,
          updated_at = NOW()
        WHERE id = p_comparison_id
        RETURNING * INTO v_row;
      ELSIF v_row.status = 'pending_approval'::public.inventory_lot_study_status THEN
        v_new_status := 'returned'::public.inventory_lot_study_status;
        PERFORM public._claim_reagent_lot_workflow_escrow(p_comparison_id, p_action);
        UPDATE public.inventory_reagent_lot_comparisons
        SET
          status = v_new_status,
          approved_by = NULL,
          approved_by_name = NULL,
          approved_by_staff_id = NULL,
          approved_at = NULL,
          approval_comment = p_comment,
          updated_by = v_actor,
          updated_at = NOW()
        WHERE id = p_comparison_id
        RETURNING * INTO v_row;
      ELSE
        RAISE EXCEPTION 'Study is not pending review or approval';
      END IF;

    WHEN 'reject' THEN
      IF v_row.status = 'pending_review'::public.inventory_lot_study_status THEN
        IF v_row.prepared_by IS NOT NULL AND v_row.prepared_by = v_actor THEN
          RAISE EXCEPTION 'Prepared by and reviewed by must be different users';
        END IF;
        v_new_status := 'rejected'::public.inventory_lot_study_status;
        PERFORM public._claim_reagent_lot_workflow_escrow(p_comparison_id, p_action);
        UPDATE public.inventory_reagent_lot_comparisons
        SET
          status = v_new_status,
          reviewed_by = v_actor,
          reviewed_by_name = v_staff_name,
          reviewed_by_staff_id = v_staff_id,
          reviewed_at = NOW(),
          review_comment = p_comment,
          updated_by = v_actor,
          updated_at = NOW()
        WHERE id = p_comparison_id
        RETURNING * INTO v_row;
      ELSIF v_row.status = 'pending_approval'::public.inventory_lot_study_status THEN
        v_new_status := 'rejected'::public.inventory_lot_study_status;
        PERFORM public._claim_reagent_lot_workflow_escrow(p_comparison_id, p_action);
        UPDATE public.inventory_reagent_lot_comparisons
        SET
          status = v_new_status,
          approved_by = NULL,
          approved_by_name = NULL,
          approved_by_staff_id = NULL,
          approved_at = NULL,
          approval_comment = p_comment,
          updated_by = v_actor,
          updated_at = NOW()
        WHERE id = p_comparison_id
        RETURNING * INTO v_row;
      ELSE
        RAISE EXCEPTION 'Study is not pending review or approval';
      END IF;

    WHEN 'approve' THEN
      IF v_row.status <> 'pending_approval'::public.inventory_lot_study_status THEN
        RAISE EXCEPTION 'Study is not pending approval';
      END IF;
      IF v_row.prepared_by IS NOT NULL AND v_row.prepared_by = v_actor THEN
        RAISE EXCEPTION 'Prepared by and approved by must be different users';
      END IF;
      IF v_row.reviewed_by IS NOT NULL AND v_row.reviewed_by = v_actor THEN
        RAISE EXCEPTION 'Reviewed by and approved by must be different users';
      END IF;
      v_new_status := 'approved'::public.inventory_lot_study_status;
      PERFORM public._claim_reagent_lot_workflow_escrow(p_comparison_id, p_action);
      UPDATE public.inventory_reagent_lot_comparisons
      SET
        status = v_new_status,
        approved_by = v_actor,
        approved_by_name = v_staff_name,
        approved_by_staff_id = v_staff_id,
        approved_at = NOW(),
        approval_comment = p_comment,
        updated_by = v_actor,
        updated_at = NOW()
      WHERE id = p_comparison_id
      RETURNING * INTO v_row;

    ELSE
      RAISE EXCEPTION 'Unsupported workflow action: %', p_action;
  END CASE;

  INSERT INTO public.inventory_audit_events (
    entity_type, entity_id, action, user_id, user_name, staff_id, comment, metadata
  ) VALUES (
    'reagent_lot_comparison',
    p_comparison_id,
    CASE p_action
      WHEN 'submit' THEN 'STUDY_SUBMITTED'
      WHEN 'review' THEN 'STUDY_REVIEWED'
      WHEN 'approve' THEN 'STUDY_APPROVED'
      WHEN 'return' THEN 'STUDY_RETURNED'
      WHEN 'reject' THEN 'STUDY_REJECTED'
      ELSE 'STUDY_WORKFLOW'
    END,
    v_actor,
    v_staff_name,
    v_staff_id,
    p_comment,
    jsonb_build_object('action', p_action, 'previousStatus', v_previous_status, 'newStatus', v_new_status)
  );

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_reagent_lot_study(p_comparison_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_comparison public.inventory_reagent_lot_comparisons%ROWTYPE;
  v_item public.inventory_items%ROWTYPE;
  v_existing public.inventory_lot_usage%ROWTYPE;
  v_context_key TEXT;
  v_usage_id UUID;
  v_staff_name TEXT;
  v_staff_id TEXT;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT public.has_permission('inventory.manage') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  SELECT p.full_name, p.staff_id
  INTO v_staff_name, v_staff_id
  FROM public.profiles p
  WHERE p.id = v_actor AND p.deleted_at IS NULL;

  SELECT * INTO v_comparison
  FROM public.inventory_reagent_lot_comparisons
  WHERE id = p_comparison_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Study not found';
  END IF;
  IF v_comparison.status <> 'approved'::public.inventory_lot_study_status THEN
    RAISE EXCEPTION 'Study must be approved before activating the new lot';
  END IF;
  IF v_comparison.activated_at IS NOT NULL THEN
    RAISE EXCEPTION 'New lot was already activated for this study';
  END IF;

  IF v_comparison.new_store_item_id IS NULL THEN
    SELECT * INTO v_item
    FROM public.inventory_items
    WHERE deleted_at IS NULL
      AND lot_number = v_comparison.new_lot_number
      AND lower(item_name) = lower(v_comparison.reagent_name)
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
    SELECT * INTO v_item
    FROM public.inventory_items
    WHERE id = v_comparison.new_store_item_id AND deleted_at IS NULL;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link a new store item before activation';
  END IF;

  v_context_key := concat(
    'kind:reagent|instrument:', coalesce(v_comparison.instrument_id::text, 'none'),
    CASE WHEN v_item.category IS NOT NULL THEN '|category:' || v_item.category ELSE '' END,
    CASE WHEN v_comparison.test_parameter IS NOT NULL THEN '|param:' || v_comparison.test_parameter ELSE '' END
  );

  SELECT * INTO v_existing
  FROM public.inventory_lot_usage
  WHERE context_key = v_context_key AND status = 'active'::public.inventory_lot_usage_status
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.inventory_lot_usage
    SET status = 'superseded'::public.inventory_lot_usage_status,
        updated_at = NOW()
    WHERE id = v_existing.id;

    INSERT INTO public.inventory_audit_events (
      entity_type, entity_id, inventory_item_id, lot_number, action, user_id, user_name, staff_id, metadata
    ) VALUES (
      'inventory_lot_usage', v_existing.id, v_existing.inventory_item_id, v_existing.lot_number_snapshot,
      'LOT_SUPERSEDED', v_actor, v_staff_name, v_staff_id,
      jsonb_build_object('contextKey', v_context_key, 'reagentComparisonId', p_comparison_id)
    );
  END IF;

  INSERT INTO public.inventory_lot_usage (
    inventory_item_id, item_name_snapshot, category_snapshot, lot_number_snapshot,
    manufacturer_snapshot, context_key, instrument_id, instrument_name_snapshot,
    test_parameter, start_date, expiry_date, quantity_remaining, status,
    started_by, started_by_name, started_by_staff_id, reagent_comparison_id
  ) VALUES (
    v_item.id, v_item.item_name, v_item.category, coalesce(v_item.lot_number, '—'),
    v_item.manufacturer, v_context_key, v_comparison.instrument_id, v_comparison.instrument_name_snapshot,
    v_comparison.test_parameter, CURRENT_DATE, v_item.expiry_date, v_item.quantity,
    'active'::public.inventory_lot_usage_status,
    v_actor, v_staff_name, v_staff_id, p_comparison_id
  )
  RETURNING id INTO v_usage_id;

  PERFORM public._claim_reagent_lot_activation_escrow(p_comparison_id);
  UPDATE public.inventory_reagent_lot_comparisons
  SET activated_at = NOW(), activated_by = v_actor, updated_by = v_actor, updated_at = NOW()
  WHERE id = p_comparison_id;

  INSERT INTO public.inventory_audit_events (
    entity_type, entity_id, inventory_item_id, lot_number, action, user_id, user_name, staff_id, metadata
  ) VALUES (
    'inventory_lot_usage', v_usage_id, v_item.id, coalesce(v_item.lot_number, '—'),
    'LOT_ACTIVATED', v_actor, v_staff_name, v_staff_id,
    jsonb_build_object('contextKey', v_context_key, 'reagentComparisonId', p_comparison_id)
  );

  INSERT INTO public.inventory_audit_events (
    entity_type, entity_id, inventory_item_id, lot_number, action, user_id, user_name, staff_id
  ) VALUES (
    'reagent_lot_comparison', p_comparison_id, v_item.id, v_comparison.new_lot_number,
    'NEW_LOT_ACTIVATED', v_actor, v_staff_name, v_staff_id
  );

  RETURN v_usage_id;
END;
$$;

REVOKE ALL ON FUNCTION public.perform_reagent_lot_workflow_action(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.perform_reagent_lot_workflow_action(UUID, TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.activate_reagent_lot_study(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_reagent_lot_study(UUID) TO authenticated;
