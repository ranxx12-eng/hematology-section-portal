-- Form-Hema-024 Alinity QC checklist.
-- One checklist per instrument, year, and month. Run slots point at existing qc_batch_id values.

CREATE TABLE public.alinity_qc_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id UUID NOT NULL REFERENCES public.instruments(id) ON DELETE RESTRICT,
  checklist_year INTEGER NOT NULL CHECK (checklist_year BETWEEN 2000 AND 2100),
  checklist_month INTEGER NOT NULL CHECK (checklist_month BETWEEN 1 AND 12),
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'finalized')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reviewed_by_name TEXT,
  reviewed_by_staff_id TEXT,
  reviewed_at TIMESTAMPTZ,
  supervisor_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  supervisor_name TEXT,
  supervisor_staff_id TEXT,
  supervisor_at TIMESTAMPTZ,
  frozen_evidence JSONB,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT alinity_qc_checklists_period_unique UNIQUE (instrument_id, checklist_year, checklist_month)
);

CREATE TABLE public.alinity_qc_run_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES public.alinity_qc_checklists(id) ON DELETE RESTRICT,
  day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  run_slot TEXT NOT NULL CHECK (run_slot IN ('run_1', 'run_2')),
  qc_batch_id UUID NOT NULL,
  associated_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  associated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT alinity_qc_run_links_slot_unique UNIQUE (checklist_id, day_of_month, run_slot),
  CONSTRAINT alinity_qc_run_links_batch_unique UNIQUE (qc_batch_id)
);

CREATE TABLE public.alinity_qc_cv_attestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES public.alinity_qc_checklists(id) ON DELETE RESTRICT,
  day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  attested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  attested_by_name TEXT NOT NULL,
  attested_by_staff_id TEXT,
  attested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT alinity_qc_cv_attestations_day_unique UNIQUE (checklist_id, day_of_month)
);

CREATE TABLE public.alinity_qc_checklist_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES public.alinity_qc_checklists(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name TEXT,
  actor_staff_id TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX alinity_qc_run_links_checklist_idx ON public.alinity_qc_run_links (checklist_id);
CREATE INDEX alinity_qc_cv_attestations_checklist_idx ON public.alinity_qc_cv_attestations (checklist_id);
CREATE INDEX alinity_qc_checklist_events_checklist_idx ON public.alinity_qc_checklist_events (checklist_id, created_at);

ALTER TABLE public.alinity_qc_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alinity_qc_run_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alinity_qc_cv_attestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alinity_qc_checklist_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alinity_qc_checklists FORCE ROW LEVEL SECURITY;
ALTER TABLE public.alinity_qc_run_links FORCE ROW LEVEL SECURITY;
ALTER TABLE public.alinity_qc_cv_attestations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.alinity_qc_checklist_events FORCE ROW LEVEL SECURITY;

CREATE POLICY alinity_qc_checklists_select ON public.alinity_qc_checklists
  FOR SELECT TO authenticated
  USING (public.has_permission('qc.view'));

CREATE POLICY alinity_qc_run_links_select ON public.alinity_qc_run_links
  FOR SELECT TO authenticated
  USING (public.has_permission('qc.view'));

CREATE POLICY alinity_qc_cv_attestations_select ON public.alinity_qc_cv_attestations
  FOR SELECT TO authenticated
  USING (public.has_permission('qc.view'));

CREATE POLICY alinity_qc_checklist_events_select ON public.alinity_qc_checklist_events
  FOR SELECT TO authenticated
  USING (public.has_permission('qc.view'));

REVOKE ALL ON public.alinity_qc_checklists FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.alinity_qc_run_links FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.alinity_qc_cv_attestations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.alinity_qc_checklist_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.alinity_qc_checklists TO authenticated;
GRANT SELECT ON public.alinity_qc_run_links TO authenticated;
GRANT SELECT ON public.alinity_qc_cv_attestations TO authenticated;
GRANT SELECT ON public.alinity_qc_checklist_events TO authenticated;

CREATE OR REPLACE FUNCTION public.is_alinity_checklist_instrument(p_instrument_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.instruments i
    WHERE i.id = p_instrument_id
      AND i.deleted_at IS NULL
      AND (
        i.name ~* '^Alinity HQ[[:space:]]*1147$'
        OR i.name ~* '^Alinity HQ[[:space:]]*1149$'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.alinity_checklist_last_day(p_year INTEGER, p_month INTEGER)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT EXTRACT(DAY FROM (make_date(p_year, p_month, 1) + INTERVAL '1 month' - INTERVAL '1 day'))::INTEGER;
$$;

CREATE OR REPLACE FUNCTION public.trg_alinity_qc_checklist_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('alinity_checklist.workflow', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'Alinity QC checklists can only be updated through the workflow';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'finalized' AND NEW.status = 'finalized' THEN
    RAISE EXCEPTION 'Finalized checklists are locked';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Alinity QC checklists cannot be deleted';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_alinity_qc_checklist_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.alinity_qc_checklists
  FOR EACH ROW EXECUTE FUNCTION public.trg_alinity_qc_checklist_guard();

CREATE OR REPLACE FUNCTION public.trg_alinity_qc_run_link_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_year INTEGER;
  v_month INTEGER;
BEGIN
  IF current_setting('alinity_checklist.workflow', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'Alinity QC run links can only be updated through the workflow';
  END IF;
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Alinity QC run links cannot be changed';
  END IF;
  SELECT status, checklist_year, checklist_month
    INTO v_status, v_year, v_month
  FROM public.alinity_qc_checklists
  WHERE id = NEW.checklist_id;
  IF v_status = 'finalized' THEN
    RAISE EXCEPTION 'Finalized checklists are locked';
  END IF;
  IF NEW.day_of_month > public.alinity_checklist_last_day(v_year, v_month) THEN
    RAISE EXCEPTION 'Invalid checklist date';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_alinity_qc_run_link_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.alinity_qc_run_links
  FOR EACH ROW EXECUTE FUNCTION public.trg_alinity_qc_run_link_guard();

CREATE OR REPLACE FUNCTION public.trg_alinity_qc_cv_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_year INTEGER;
  v_month INTEGER;
  v_day INTEGER;
BEGIN
  IF current_setting('alinity_checklist.workflow', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'CV attestations can only be updated through the workflow';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'CV attestations cannot be deleted';
  END IF;
  v_day := NEW.day_of_month;
  SELECT status, checklist_year, checklist_month
    INTO v_status, v_year, v_month
  FROM public.alinity_qc_checklists
  WHERE id = NEW.checklist_id;
  IF v_status = 'finalized' THEN
    RAISE EXCEPTION 'Finalized checklists are locked';
  END IF;
  IF v_day > public.alinity_checklist_last_day(v_year, v_month) THEN
    RAISE EXCEPTION 'Invalid checklist date';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_alinity_qc_cv_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.alinity_qc_cv_attestations
  FOR EACH ROW EXECUTE FUNCTION public.trg_alinity_qc_cv_guard();

CREATE OR REPLACE FUNCTION public.trg_alinity_qc_event_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Checklist audit events are immutable';
  END IF;
  IF current_setting('alinity_checklist.workflow', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'Checklist audit events can only be recorded through the workflow';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_alinity_qc_event_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.alinity_qc_checklist_events
  FOR EACH ROW EXECUTE FUNCTION public.trg_alinity_qc_event_guard();

CREATE OR REPLACE FUNCTION public.alinity_checklist_actor()
RETURNS TABLE(actor_id UUID, actor_name TEXT, actor_staff_id TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, NULLIF(btrim(p.full_name), ''), NULLIF(btrim(p.staff_id), '')
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.deleted_at IS NULL
    AND p.is_active = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Authenticated staff profile is required';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.alinity_checklist_require_name(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' OR p_name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Staff name is required';
  END IF;
  RETURN btrim(p_name);
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_alinity_qc_checklist(
  p_instrument_id UUID,
  p_year INTEGER,
  p_month INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_actor RECORD;
BEGIN
  IF NOT public.has_permission('qc.view') THEN
    RAISE EXCEPTION 'Not authorized to open this checklist';
  END IF;
  IF p_year < 2000 OR p_year > 2100 OR p_month < 1 OR p_month > 12 THEN
    RAISE EXCEPTION 'Invalid checklist month';
  END IF;
  IF NOT public.is_alinity_checklist_instrument(p_instrument_id) THEN
    RAISE EXCEPTION 'This instrument does not use Form-Hema-024';
  END IF;
  SELECT id INTO v_id
  FROM public.alinity_qc_checklists
  WHERE instrument_id = p_instrument_id
    AND checklist_year = p_year
    AND checklist_month = p_month;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;
  SELECT * INTO v_actor FROM public.alinity_checklist_actor();
  PERFORM set_config('alinity_checklist.workflow', '1', true);
  INSERT INTO public.alinity_qc_checklists (instrument_id, checklist_year, checklist_month, created_by)
  VALUES (p_instrument_id, p_year, p_month, v_actor.actor_id)
  ON CONFLICT (instrument_id, checklist_year, checklist_month) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id
    FROM public.alinity_qc_checklists
    WHERE instrument_id = p_instrument_id
      AND checklist_year = p_year
      AND checklist_month = p_month;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.associate_alinity_qc_run(
  p_checklist_id UUID,
  p_day INTEGER,
  p_run_slot TEXT,
  p_qc_batch_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.alinity_qc_checklists%ROWTYPE;
  v_actor RECORD;
  v_id UUID;
  v_target DATE;
BEGIN
  IF NOT (public.has_permission('qc.manage') OR public.has_permission('qc.review_daily')) THEN
    RAISE EXCEPTION 'Not authorized to associate a QC run';
  END IF;
  IF p_run_slot NOT IN ('run_1', 'run_2') THEN
    RAISE EXCEPTION 'Invalid routine run slot';
  END IF;
  SELECT * INTO v_row FROM public.alinity_qc_checklists WHERE id = p_checklist_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checklist was not found';
  END IF;
  IF v_row.status = 'finalized' THEN
    RAISE EXCEPTION 'Finalized checklists are locked';
  END IF;
  IF p_day < 1 OR p_day > public.alinity_checklist_last_day(v_row.checklist_year, v_row.checklist_month) THEN
    RAISE EXCEPTION 'Invalid checklist date';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.alinity_qc_run_links
    WHERE checklist_id = p_checklist_id AND day_of_month = p_day AND run_slot = p_run_slot
  ) THEN
    RAISE EXCEPTION 'Routine run slot is already recorded';
  END IF;
  IF EXISTS (SELECT 1 FROM public.alinity_qc_run_links WHERE qc_batch_id = p_qc_batch_id) THEN
    RAISE EXCEPTION 'QC run is already associated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.qc_records
    WHERE qc_batch_id = p_qc_batch_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'QC run was not found';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.qc_records
    WHERE qc_batch_id = p_qc_batch_id
      AND deleted_at IS NULL
      AND instrument_id IS DISTINCT FROM v_row.instrument_id
  ) THEN
    RAISE EXCEPTION 'QC run belongs to a different instrument';
  END IF;
  v_target := make_date(v_row.checklist_year, v_row.checklist_month, p_day);
  IF EXISTS (
    SELECT 1 FROM public.qc_records
    WHERE qc_batch_id = p_qc_batch_id
      AND deleted_at IS NULL
      AND (recorded_at AT TIME ZONE 'Asia/Riyadh')::date IS DISTINCT FROM v_target
  ) THEN
    RAISE EXCEPTION 'QC run does not match the checklist date';
  END IF;
  SELECT * INTO v_actor FROM public.alinity_checklist_actor();
  PERFORM set_config('alinity_checklist.workflow', '1', true);
  INSERT INTO public.alinity_qc_run_links (checklist_id, day_of_month, run_slot, qc_batch_id, associated_by)
  VALUES (p_checklist_id, p_day, p_run_slot, p_qc_batch_id, v_actor.actor_id)
  RETURNING id INTO v_id;
  INSERT INTO public.alinity_qc_checklist_events (checklist_id, action, actor_id, actor_name, actor_staff_id, detail)
  VALUES (
    p_checklist_id,
    'associate_run',
    v_actor.actor_id,
    v_actor.actor_name,
    v_actor.actor_staff_id,
    jsonb_build_object('day', p_day, 'slot', p_run_slot, 'qcBatchId', p_qc_batch_id)
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.attest_alinity_qc_cv(
  p_checklist_id UUID,
  p_day INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.alinity_qc_checklists%ROWTYPE;
  v_actor RECORD;
  v_name TEXT;
  v_id UUID;
BEGIN
  IF NOT public.has_permission('cv_monitoring.review') THEN
    RAISE EXCEPTION 'Not authorized to attest CV monitoring';
  END IF;
  SELECT * INTO v_row FROM public.alinity_qc_checklists WHERE id = p_checklist_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checklist was not found';
  END IF;
  IF v_row.status = 'finalized' THEN
    RAISE EXCEPTION 'Finalized checklists are locked';
  END IF;
  IF p_day < 1 OR p_day > public.alinity_checklist_last_day(v_row.checklist_year, v_row.checklist_month) THEN
    RAISE EXCEPTION 'Invalid checklist date';
  END IF;
  SELECT * INTO v_actor FROM public.alinity_checklist_actor();
  v_name := public.alinity_checklist_require_name(v_actor.actor_name);
  PERFORM set_config('alinity_checklist.workflow', '1', true);
  INSERT INTO public.alinity_qc_cv_attestations (
    checklist_id, day_of_month, attested_by, attested_by_name, attested_by_staff_id
  ) VALUES (
    p_checklist_id, p_day, v_actor.actor_id, v_name, v_actor.actor_staff_id
  )
  ON CONFLICT (checklist_id, day_of_month) DO UPDATE
    SET attested_by = EXCLUDED.attested_by,
        attested_by_name = EXCLUDED.attested_by_name,
        attested_by_staff_id = EXCLUDED.attested_by_staff_id,
        attested_at = NOW()
  RETURNING id INTO v_id;
  INSERT INTO public.alinity_qc_checklist_events (checklist_id, action, actor_id, actor_name, actor_staff_id, detail)
  VALUES (p_checklist_id, 'attest_cv', v_actor.actor_id, v_name, v_actor.actor_staff_id, jsonb_build_object('day', p_day));
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_alinity_qc_checklist_comment(
  p_checklist_id UUID,
  p_comment TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.alinity_qc_checklists%ROWTYPE;
BEGIN
  IF NOT (public.has_permission('qc.manage') OR public.has_permission('qc.review_monthly')) THEN
    RAISE EXCEPTION 'Not authorized to comment on this checklist';
  END IF;
  SELECT * INTO v_row FROM public.alinity_qc_checklists WHERE id = p_checklist_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checklist was not found';
  END IF;
  IF v_row.status = 'finalized' THEN
    RAISE EXCEPTION 'Finalized checklists are locked';
  END IF;
  PERFORM set_config('alinity_checklist.workflow', '1', true);
  UPDATE public.alinity_qc_checklists
  SET comment = NULLIF(btrim(p_comment), '')
  WHERE id = p_checklist_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_alinity_qc_checklist(p_checklist_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.alinity_qc_checklists%ROWTYPE;
  v_actor RECORD;
  v_name TEXT;
BEGIN
  IF NOT public.has_permission('qc.review_monthly') THEN
    RAISE EXCEPTION 'Not authorized to review this monthly checklist';
  END IF;
  SELECT * INTO v_row FROM public.alinity_qc_checklists WHERE id = p_checklist_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checklist was not found';
  END IF;
  IF v_row.status = 'finalized' THEN
    RAISE EXCEPTION 'Finalized checklists are locked';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.alinity_qc_run_links l
    JOIN public.qc_records r ON r.qc_batch_id = l.qc_batch_id AND r.deleted_at IS NULL
    WHERE l.checklist_id = p_checklist_id
      AND r.performed_by_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Monthly reviewer must not be a performer of the linked QC runs';
  END IF;
  SELECT * INTO v_actor FROM public.alinity_checklist_actor();
  v_name := public.alinity_checklist_require_name(v_actor.actor_name);
  PERFORM set_config('alinity_checklist.workflow', '1', true);
  UPDATE public.alinity_qc_checklists
  SET status = 'reviewed',
      reviewed_by = v_actor.actor_id,
      reviewed_by_name = v_name,
      reviewed_by_staff_id = v_actor.actor_staff_id,
      reviewed_at = NOW()
  WHERE id = p_checklist_id;
  INSERT INTO public.alinity_qc_checklist_events (checklist_id, action, actor_id, actor_name, actor_staff_id)
  VALUES (p_checklist_id, 'monthly_review', v_actor.actor_id, v_name, v_actor.actor_staff_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.alinity_checklist_freeze(p_checklist_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.alinity_qc_checklists%ROWTYPE;
  v_start DATE;
  v_end DATE;
BEGIN
  SELECT * INTO v_row FROM public.alinity_qc_checklists WHERE id = p_checklist_id;
  v_start := make_date(v_row.checklist_year, v_row.checklist_month, 1);
  v_end := (v_start + INTERVAL '1 month')::date;
  RETURN jsonb_build_object(
    'links', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'day', l.day_of_month,
        'slot', l.run_slot,
        'qcBatchId', l.qc_batch_id
      ) ORDER BY l.day_of_month, l.run_slot)
      FROM public.alinity_qc_run_links l
      WHERE l.checklist_id = p_checklist_id
    ), '[]'::jsonb),
    'attestations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'day', a.day_of_month,
        'attestedByUserId', a.attested_by,
        'attestedByName', a.attested_by_name,
        'attestedByStaffId', a.attested_by_staff_id,
        'attestedAt', a.attested_at
      ) ORDER BY a.day_of_month)
      FROM public.alinity_qc_cv_attestations a
      WHERE a.checklist_id = p_checklist_id
    ), '[]'::jsonb),
    'records', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'instrumentId', r.instrument_id,
        'parameter', r.test_name,
        'level', r.control_level,
        'recordedAt', r.recorded_at,
        'qcStatus', r.qc_status,
        'qcBatchId', r.qc_batch_id,
        'qcFrequency', r.qc_frequency,
        'correctiveActions', r.corrective_actions,
        'correctiveActionComment', r.corrective_action_comment,
        'correctiveActionOther', r.corrective_action_other,
        'resolutionStatus', r.resolution_status,
        'actionAt', r.action_at,
        'actionByName', r.action_by_name,
        'actionByStaffId', r.action_by_staff_id,
        'resolvedAt', r.resolved_at,
        'resolvedByName', r.resolved_by_name,
        'performedByUserId', r.performed_by_user_id,
        'performedByName', r.performed_by_name,
        'performedByStaffId', r.performed_by_staff_id,
        'comment', r.comment,
        'lotNumber', r.lot_number,
        'expiryDate', r.expiry_date,
        'reviewStatus', r.review_status,
        'reviewedByUserId', r.reviewed_by,
        'reviewedByName', r.reviewed_by_name,
        'reviewedByStaffId', r.reviewed_by_staff_id,
        'reviewedAt', r.reviewed_at,
        'reviewDecision', r.review_decision,
        'reviewComment', r.review_comment,
        'approvalStatus', r.approval_status,
        'approvedByName', r.approved_by_name,
        'approvedByStaffId', r.approved_by_staff_id,
        'approvedAt', r.approved_at,
        'approvalDecision', r.approval_decision,
        'approvalComment', r.approval_comment
      ))
      FROM public.qc_records r
      WHERE r.deleted_at IS NULL
        AND r.instrument_id = v_row.instrument_id
        AND (r.recorded_at AT TIME ZONE 'Asia/Riyadh')::date >= v_start
        AND (r.recorded_at AT TIME ZONE 'Asia/Riyadh')::date < v_end
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sign_alinity_qc_checklist_supervisor(p_checklist_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.alinity_qc_checklists%ROWTYPE;
  v_actor RECORD;
  v_name TEXT;
  v_frozen JSONB;
BEGIN
  IF NOT public.has_permission('qc.approve') THEN
    RAISE EXCEPTION 'Not authorized to sign this checklist as supervisor';
  END IF;
  SELECT * INTO v_row FROM public.alinity_qc_checklists WHERE id = p_checklist_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checklist was not found';
  END IF;
  IF v_row.status <> 'reviewed' OR v_row.reviewed_by IS NULL THEN
    RAISE EXCEPTION 'Monthly review is required before supervisor sign-off';
  END IF;
  IF v_row.reviewed_by = auth.uid() THEN
    RAISE EXCEPTION 'Supervisor must not be the monthly reviewer';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.alinity_qc_run_links l
    JOIN public.qc_records r ON r.qc_batch_id = l.qc_batch_id AND r.deleted_at IS NULL
    WHERE l.checklist_id = p_checklist_id
      AND r.performed_by_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Supervisor must not be a performer of the linked QC runs';
  END IF;
  SELECT * INTO v_actor FROM public.alinity_checklist_actor();
  v_name := public.alinity_checklist_require_name(v_actor.actor_name);
  v_frozen := public.alinity_checklist_freeze(p_checklist_id);
  PERFORM set_config('alinity_checklist.workflow', '1', true);
  UPDATE public.alinity_qc_checklists
  SET status = 'finalized',
      supervisor_id = v_actor.actor_id,
      supervisor_name = v_name,
      supervisor_staff_id = v_actor.actor_staff_id,
      supervisor_at = NOW(),
      frozen_evidence = v_frozen
  WHERE id = p_checklist_id;
  INSERT INTO public.alinity_qc_checklist_events (checklist_id, action, actor_id, actor_name, actor_staff_id)
  VALUES (p_checklist_id, 'supervisor_sign', v_actor.actor_id, v_name, v_actor.actor_staff_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.reopen_alinity_qc_checklist(p_checklist_id UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.alinity_qc_checklists%ROWTYPE;
  v_actor RECORD;
  v_name TEXT;
BEGIN
  IF NOT public.has_permission('qc.approve') THEN
    RAISE EXCEPTION 'Not authorized to amend this checklist';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 8 THEN
    RAISE EXCEPTION 'An amendment reason is required';
  END IF;
  SELECT * INTO v_row FROM public.alinity_qc_checklists WHERE id = p_checklist_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checklist was not found';
  END IF;
  IF v_row.status <> 'finalized' THEN
    RAISE EXCEPTION 'Only a finalized checklist can be amended';
  END IF;
  SELECT * INTO v_actor FROM public.alinity_checklist_actor();
  v_name := public.alinity_checklist_require_name(v_actor.actor_name);
  PERFORM set_config('alinity_checklist.workflow', '1', true);
  INSERT INTO public.alinity_qc_checklist_events (checklist_id, action, actor_id, actor_name, actor_staff_id, detail)
  VALUES (
    p_checklist_id,
    'amendment_reopen',
    v_actor.actor_id,
    v_name,
    v_actor.actor_staff_id,
    jsonb_build_object('reason', btrim(p_reason), 'previousEvidence', v_row.frozen_evidence)
  );
  UPDATE public.alinity_qc_checklists
  SET status = 'open',
      reviewed_by = NULL,
      reviewed_by_name = NULL,
      reviewed_by_staff_id = NULL,
      reviewed_at = NULL,
      supervisor_id = NULL,
      supervisor_name = NULL,
      supervisor_staff_id = NULL,
      supervisor_at = NULL,
      frozen_evidence = NULL
  WHERE id = p_checklist_id;
END;
$$;

REVOKE ALL ON FUNCTION public.is_alinity_checklist_instrument(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.alinity_checklist_last_day(INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.alinity_checklist_actor() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.alinity_checklist_require_name(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.alinity_checklist_freeze(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_alinity_qc_checklist(UUID, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.associate_alinity_qc_run(UUID, INTEGER, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.attest_alinity_qc_cv(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_alinity_qc_checklist_comment(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_alinity_qc_checklist(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sign_alinity_qc_checklist_supervisor(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reopen_alinity_qc_checklist(UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ensure_alinity_qc_checklist(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.associate_alinity_qc_run(UUID, INTEGER, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attest_alinity_qc_cv(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_alinity_qc_checklist_comment(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_alinity_qc_checklist(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sign_alinity_qc_checklist_supervisor(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_alinity_qc_checklist(UUID, TEXT) TO authenticated;
