-- ============================================================================
-- Migration 077: Form-Hema-023 coagulation mixing study worksheet
-- Additive. Does not alter QC, inventory, employees, tasks, or Form-Hema-022.
-- Does NOT auto-apply.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mixing_study_status') THEN
    CREATE TYPE public.mixing_study_status AS ENUM (
      'draft', 'pending_review', 'changes_requested', 'reviewed'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mixing_study_test_selection') THEN
    CREATE TYPE public.mixing_study_test_selection AS ENUM ('aptt', 'pt', 'both');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mixing_study_test_type') THEN
    CREATE TYPE public.mixing_study_test_type AS ENUM ('aptt', 'pt');
  END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS public.medical_mixing_study_number_seq;

CREATE TABLE IF NOT EXISTS public.medical_mixing_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_number TEXT NOT NULL UNIQUE,
  linked_report_id UUID,
  test_selection public.mixing_study_test_selection NOT NULL DEFAULT 'both',
  study_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status public.mixing_study_status NOT NULL DEFAULT 'draft',
  sample_reference_ciphertext TEXT,
  sample_reference_key_version TEXT,
  sample_reference_present BOOLEAN NOT NULL DEFAULT FALSE,
  performed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  performed_by_name TEXT NOT NULL,
  performed_by_staff_id TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reviewed_by_name TEXT,
  reviewed_by_staff_id TEXT,
  reviewed_at TIMESTAMPTZ,
  review_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT mixing_study_sample_reference_pair CHECK (
    (sample_reference_ciphertext IS NULL AND sample_reference_key_version IS NULL)
    OR (sample_reference_ciphertext IS NOT NULL AND sample_reference_key_version IS NOT NULL)
  ),
  CONSTRAINT mixing_study_sample_reference_flag CHECK (
    sample_reference_present = (sample_reference_ciphertext IS NOT NULL)
  ),
  CONSTRAINT mixing_study_review_comment_length CHECK (
    review_comment IS NULL OR char_length(review_comment) <= 2000
  ),
  CONSTRAINT mixing_study_reviewer_not_performer CHECK (
    reviewed_by IS NULL OR reviewed_by <> performed_by
  )
);

COMMENT ON COLUMN public.medical_mixing_studies.linked_report_id IS
  'Opaque internal UUID only. No patient identifier and no foreign key, because Medical Reports has no shared parent free of plaintext identifiers.';
COMMENT ON COLUMN public.medical_mixing_studies.sample_reference_ciphertext IS
  'Form-Hema-023 domain-separated ciphertext. Never store a plaintext patient or sample identifier.';

CREATE TABLE IF NOT EXISTS public.medical_mixing_study_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id UUID NOT NULL REFERENCES public.medical_mixing_studies(id) ON DELETE CASCADE,
  test_type public.mixing_study_test_type NOT NULL,
  patient_clotting_time NUMERIC,
  npp_clotting_time NUMERIC,
  target_value NUMERIC,
  immediate_mix_clotting_time NUMERIC,
  immediate_rosner_index NUMERIC,
  immediate_interpretation TEXT,
  incubated_mix_clotting_time NUMERIC,
  incubated_rosner_index NUMERIC,
  incubated_interpretation TEXT,
  conclusion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mixing_result_unique UNIQUE (study_id, test_type),
  CONSTRAINT mixing_result_patient_positive CHECK (patient_clotting_time IS NULL OR patient_clotting_time > 0),
  CONSTRAINT mixing_result_npp_positive CHECK (npp_clotting_time IS NULL OR npp_clotting_time > 0),
  CONSTRAINT mixing_result_target_positive CHECK (target_value IS NULL OR target_value > 0),
  CONSTRAINT mixing_result_immediate_positive CHECK (immediate_mix_clotting_time IS NULL OR immediate_mix_clotting_time > 0),
  CONSTRAINT mixing_result_incubated_positive CHECK (incubated_mix_clotting_time IS NULL OR incubated_mix_clotting_time > 0),
  CONSTRAINT mixing_result_conclusion_length CHECK (conclusion IS NULL OR char_length(conclusion) <= 2000),
  CONSTRAINT mixing_result_immediate_interpretation CHECK (
    immediate_interpretation IS NULL OR immediate_interpretation IN (
      'Suggests presence of an inhibitor',
      'Does not exceed the Form-Hema-023 inhibitor threshold.',
      'Incomplete',
      'Cannot Calculate'
    )
  ),
  CONSTRAINT mixing_result_incubated_interpretation CHECK (
    incubated_interpretation IS NULL OR incubated_interpretation IN (
      'Suggests presence of an inhibitor',
      'Does not exceed the Form-Hema-023 inhibitor threshold.',
      'Incomplete',
      'Cannot Calculate'
    )
  )
);

CREATE TABLE IF NOT EXISTS public.medical_mixing_study_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id UUID NOT NULL REFERENCES public.medical_mixing_studies(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name TEXT,
  actor_staff_id TEXT,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mixing_study_event_type_check CHECK (
    event_type IN (
      'created', 'draft_updated', 'submitted', 'changes_requested', 'reviewed', 'pdf_exported'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_medical_mixing_studies_status
  ON public.medical_mixing_studies(status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_medical_mixing_study_results_study
  ON public.medical_mixing_study_results(study_id, test_type);

CREATE INDEX IF NOT EXISTS idx_medical_mixing_study_events_study
  ON public.medical_mixing_study_events(study_id, performed_at);

DROP TRIGGER IF EXISTS trg_medical_mixing_studies_updated_at ON public.medical_mixing_studies;
CREATE TRIGGER trg_medical_mixing_studies_updated_at
  BEFORE UPDATE ON public.medical_mixing_studies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_medical_mixing_study_results_updated_at ON public.medical_mixing_study_results;
CREATE TRIGGER trg_medical_mixing_study_results_updated_at
  BEFORE UPDATE ON public.medical_mixing_study_results
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.mixing_study_rosner(
  p_patient NUMERIC,
  p_npp NUMERIC,
  p_mix NUMERIC
)
RETURNS TABLE (rosner_index NUMERIC, interpretation TEXT)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_index NUMERIC;
BEGIN
  IF p_patient IS NULL OR p_npp IS NULL OR p_mix IS NULL THEN
    rosner_index := NULL;
    interpretation := 'Incomplete';
    RETURN NEXT;
    RETURN;
  END IF;
  IF p_patient < 0 OR p_npp < 0 OR p_mix < 0 OR p_npp = 0 OR p_mix = 0 THEN
    RAISE EXCEPTION 'Clotting times must be positive';
  END IF;
  IF p_patient = 0 THEN
    rosner_index := NULL;
    interpretation := 'Cannot Calculate';
    RETURN NEXT;
    RETURN;
  END IF;
  v_index := ((p_mix - p_npp) / p_patient) * 100;
  rosner_index := v_index;
  IF v_index > 15 THEN
    interpretation := 'Suggests presence of an inhibitor';
  ELSE
    interpretation := 'Does not exceed the Form-Hema-023 inhibitor threshold.';
  END IF;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.mixing_study_parse_decimal(p_text TEXT, p_label TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_text TEXT := NULLIF(btrim(p_text), '');
BEGIN
  IF v_text IS NULL THEN
    RETURN NULL;
  END IF;
  IF v_text !~ '^[0-9]+(\.[0-9]+)?$' THEN
    RAISE EXCEPTION '% must be a positive number', p_label;
  END IF;
  RETURN v_text::NUMERIC;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_medical_mixing_studies_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('mixing_study.workflow', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'Mixing studies can only be updated through the workflow';
  END IF;

  IF NEW.sample_reference_ciphertext IS NOT NULL THEN
    IF NEW.sample_reference_key_version NOT IN ('v1:form-hema-023', 'synthetic-v1:form-hema-023')
      OR NEW.sample_reference_ciphertext !~ '^(synthetic:)?[A-Za-z0-9_-]{43,}$' THEN
      RAISE EXCEPTION 'Invalid sample reference protection';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'reviewed' THEN
      RAISE EXCEPTION 'Reviewed mixing studies are locked';
    END IF;
    IF NEW.performed_by IS DISTINCT FROM OLD.performed_by
      OR NEW.performed_by_name IS DISTINCT FROM OLD.performed_by_name
      OR NEW.performed_by_staff_id IS DISTINCT FROM OLD.performed_by_staff_id THEN
      RAISE EXCEPTION 'Performed by cannot be changed';
    END IF;
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      RAISE EXCEPTION 'Mixing studies cannot be deleted from this workflow';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
      (OLD.status = 'draft' AND NEW.status = 'pending_review')
      OR (OLD.status = 'changes_requested' AND NEW.status = 'pending_review')
      OR (OLD.status = 'pending_review' AND NEW.status = 'reviewed')
      OR (OLD.status = 'pending_review' AND NEW.status = 'changes_requested')
    ) THEN
      RAISE EXCEPTION 'Workflow stage cannot be skipped';
    END IF;
    IF NEW.reviewed_by IS NOT NULL AND NEW.reviewed_by = NEW.performed_by THEN
      RAISE EXCEPTION 'The reviewer must not be the performer';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_medical_mixing_studies_guard ON public.medical_mixing_studies;
CREATE TRIGGER trg_medical_mixing_studies_guard
  BEFORE INSERT OR UPDATE ON public.medical_mixing_studies
  FOR EACH ROW EXECUTE FUNCTION public.trg_medical_mixing_studies_guard();

CREATE OR REPLACE FUNCTION public.trg_medical_mixing_study_results_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status public.mixing_study_status;
  v_study UUID;
BEGIN
  IF current_setting('mixing_study.workflow', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'Mixing study results can only be updated through the workflow';
  END IF;
  v_study := COALESCE(NEW.study_id, OLD.study_id);
  SELECT status INTO v_status FROM public.medical_mixing_studies WHERE id = v_study;
  IF v_status = 'reviewed' THEN
    RAISE EXCEPTION 'Reviewed mixing studies are locked';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_medical_mixing_study_results_guard ON public.medical_mixing_study_results;
CREATE TRIGGER trg_medical_mixing_study_results_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.medical_mixing_study_results
  FOR EACH ROW EXECUTE FUNCTION public.trg_medical_mixing_study_results_guard();

CREATE OR REPLACE FUNCTION public.trg_medical_mixing_study_events_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Mixing study audit events are immutable';
  END IF;
  IF current_setting('mixing_study.workflow', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'Mixing study audit events can only be recorded through the workflow';
  END IF;
  IF NEW.event_type NOT IN (
    'created', 'draft_updated', 'submitted', 'changes_requested', 'reviewed', 'pdf_exported'
  ) THEN
    RAISE EXCEPTION 'Invalid mixing study audit event';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_medical_mixing_study_events_guard ON public.medical_mixing_study_events;
CREATE TRIGGER trg_medical_mixing_study_events_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.medical_mixing_study_events
  FOR EACH ROW EXECUTE FUNCTION public.trg_medical_mixing_study_events_guard();

CREATE OR REPLACE FUNCTION public.mixing_study_json(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_row public.medical_mixing_studies%ROWTYPE;
  v_is_performer BOOLEAN;
BEGIN
  SELECT * INTO v_row
  FROM public.medical_mixing_studies
  WHERE id = p_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  v_is_performer := v_actor IS NOT NULL AND v_actor = v_row.performed_by;
  RETURN jsonb_build_object(
    'id', v_row.id,
    'studyNumber', v_row.study_number,
    'testSelection', v_row.test_selection,
    'studyDate', to_char(v_row.study_date, 'YYYY-MM-DD'),
    'status', v_row.status,
    'sampleReferencePresent', v_row.sample_reference_present,
    'performedByName', v_row.performed_by_name,
    'performedByStaffId', v_row.performed_by_staff_id,
    'submittedAt', v_row.submitted_at,
    'reviewedByName', v_row.reviewed_by_name,
    'reviewedByStaffId', v_row.reviewed_by_staff_id,
    'reviewedAt', v_row.reviewed_at,
    'reviewComment', v_row.review_comment,
    'canEdit', v_is_performer AND v_row.status IN ('draft', 'changes_requested')
      AND (public.has_permission('medical_reports.create') OR public.has_permission('medical_reports.edit')),
    'canSubmit', v_is_performer AND v_row.status IN ('draft', 'changes_requested')
      AND (public.has_permission('medical_reports.create') OR public.has_permission('medical_reports.edit')),
    'canReview', (NOT v_is_performer) AND v_row.status = 'pending_review'
      AND public.has_permission('medical_reports.review'),
    'canRequestChanges', (NOT v_is_performer) AND v_row.status = 'pending_review'
      AND public.has_permission('medical_reports.review'),
    'canPrint', public.has_permission('medical_reports.print'),
    'results', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'testType', r.test_type,
        'patientClottingTime', r.patient_clotting_time::TEXT,
        'nppClottingTime', r.npp_clotting_time::TEXT,
        'targetValue', r.target_value::TEXT,
        'immediateMixClottingTime', r.immediate_mix_clotting_time::TEXT,
        'immediateRosnerIndex', r.immediate_rosner_index::TEXT,
        'immediateInterpretation', r.immediate_interpretation,
        'incubatedMixClottingTime', r.incubated_mix_clotting_time::TEXT,
        'incubatedRosnerIndex', r.incubated_rosner_index::TEXT,
        'incubatedInterpretation', r.incubated_interpretation,
        'conclusion', r.conclusion
      ) ORDER BY r.test_type)
      FROM public.medical_mixing_study_results r
      WHERE r.study_id = v_row.id
    ), '[]'::JSONB),
    'events', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'eventType', e.event_type,
        'actorName', e.actor_name,
        'actorStaffId', e.actor_staff_id,
        'performedAt', e.performed_at
      ) ORDER BY e.performed_at)
      FROM public.medical_mixing_study_events e
      WHERE e.study_id = v_row.id
    ), '[]'::JSONB)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_mixing_study(p_study_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT public.has_permission('medical_reports.view') THEN
    RAISE EXCEPTION 'You do not have permission to view mixing studies';
  END IF;
  RETURN public.mixing_study_json(p_study_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_mixing_studies(p_query TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query TEXT := NULLIF(btrim(p_query), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT public.has_permission('medical_reports.view') THEN
    RAISE EXCEPTION 'You do not have permission to view mixing studies';
  END IF;
  IF v_query IS NOT NULL AND v_query !~ '^[A-Za-z0-9-]+$' THEN
    RAISE EXCEPTION 'Search can only use the study number';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(item ORDER BY item->>'createdAt' DESC)
    FROM (
      SELECT jsonb_build_object(
        'id', s.id,
        'studyNumber', s.study_number,
        'testSelection', s.test_selection,
        'studyDate', to_char(s.study_date, 'YYYY-MM-DD'),
        'status', s.status,
        'sampleReferencePresent', s.sample_reference_present,
        'performedByName', s.performed_by_name,
        'performedByStaffId', s.performed_by_staff_id,
        'reviewedByName', s.reviewed_by_name,
        'reviewedByStaffId', s.reviewed_by_staff_id,
        'createdAt', s.created_at
      ) AS item
      FROM public.medical_mixing_studies s
      WHERE s.deleted_at IS NULL
        AND (v_query IS NULL OR s.study_number ILIKE '%' || v_query || '%')
      ORDER BY s.created_at DESC
      LIMIT 100
    ) listed
  ), '[]'::JSONB);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_mixing_study(p_test_selection TEXT DEFAULT 'both')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_id UUID;
  v_number TEXT;
  v_name TEXT;
  v_staff TEXT;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT (
    public.has_permission('medical_reports.create')
    OR public.has_permission('medical_reports.edit')
  ) THEN
    RAISE EXCEPTION 'You do not have permission to create a mixing study';
  END IF;
  IF p_test_selection IS NULL OR p_test_selection NOT IN ('aptt', 'pt', 'both') THEN
    RAISE EXCEPTION 'Test selection must be APTT, PT, or both';
  END IF;
  SELECT full_name, NULLIF(btrim(staff_id), '')
    INTO v_name, v_staff
  FROM public.profiles
  WHERE id = v_actor AND deleted_at IS NULL AND is_active = TRUE;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_number := 'H023-' || lpad(nextval('public.medical_mixing_study_number_seq')::TEXT, 6, '0');
  PERFORM set_config('mixing_study.workflow', '1', true);
  INSERT INTO public.medical_mixing_studies (
    study_number, test_selection, study_date, status,
    performed_by, performed_by_name, performed_by_staff_id
  ) VALUES (
    v_number,
    p_test_selection::public.mixing_study_test_selection,
    CURRENT_DATE,
    'draft',
    v_actor,
    v_name,
    v_staff
  ) RETURNING id INTO v_id;

  INSERT INTO public.medical_mixing_study_events (
    study_id, event_type, actor_id, actor_name, actor_staff_id
  ) VALUES (
    v_id, 'created', v_actor, v_name, v_staff
  );
  RETURN public.mixing_study_json(v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.perform_mixing_study_action(
  p_study_id UUID,
  p_action TEXT,
  p_payload JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_study public.medical_mixing_studies%ROWTYPE;
  v_name TEXT;
  v_staff TEXT;
  v_selection TEXT;
  v_date_text TEXT;
  v_study_date DATE;
  v_element JSONB;
  v_type TEXT;
  v_seen TEXT[] := ARRAY[]::TEXT[];
  v_label TEXT;
  v_patient NUMERIC;
  v_npp NUMERIC;
  v_target NUMERIC;
  v_immediate NUMERIC;
  v_incubated NUMERIC;
  v_immediate_index NUMERIC;
  v_immediate_text TEXT;
  v_incubated_index NUMERIC;
  v_incubated_text TEXT;
  v_conclusion TEXT;
  v_comment TEXT;
  v_required TEXT;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_action NOT IN ('save_draft', 'submit', 'request_changes', 'review') THEN
    RAISE EXCEPTION 'Workflow stage cannot be skipped';
  END IF;

  SELECT * INTO v_study
  FROM public.medical_mixing_studies
  WHERE id = p_study_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mixing study not found';
  END IF;
  IF v_study.status = 'reviewed' THEN
    RAISE EXCEPTION 'Reviewed mixing studies are locked';
  END IF;

  SELECT full_name, NULLIF(btrim(staff_id), '')
    INTO v_name, v_staff
  FROM public.profiles
  WHERE id = v_actor AND deleted_at IS NULL AND is_active = TRUE;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_action IN ('review', 'request_changes') THEN
    IF v_actor = v_study.performed_by THEN
      RAISE EXCEPTION 'The reviewer must not be the performer';
    END IF;
    IF NOT public.has_permission('medical_reports.review') THEN
      RAISE EXCEPTION 'You do not have permission to review mixing studies';
    END IF;
    IF v_study.status <> 'pending_review' THEN
      RAISE EXCEPTION 'Workflow stage cannot be skipped';
    END IF;
    v_comment := NULLIF(btrim(COALESCE(p_payload->>'reviewComment', '')), '');
    IF v_comment IS NOT NULL AND char_length(v_comment) > 2000 THEN
      RAISE EXCEPTION 'Review comment is too long';
    END IF;
    PERFORM set_config('mixing_study.workflow', '1', true);
    IF p_action = 'review' THEN
      UPDATE public.medical_mixing_studies
      SET status = 'reviewed',
          reviewed_by = v_actor,
          reviewed_by_name = v_name,
          reviewed_by_staff_id = v_staff,
          reviewed_at = NOW(),
          review_comment = v_comment
      WHERE id = p_study_id;
      INSERT INTO public.medical_mixing_study_events (
        study_id, event_type, actor_id, actor_name, actor_staff_id
      ) VALUES (p_study_id, 'reviewed', v_actor, v_name, v_staff);
    ELSE
      UPDATE public.medical_mixing_studies
      SET status = 'changes_requested',
          reviewed_by = NULL,
          reviewed_by_name = NULL,
          reviewed_by_staff_id = NULL,
          reviewed_at = NULL,
          review_comment = v_comment
      WHERE id = p_study_id;
      INSERT INTO public.medical_mixing_study_events (
        study_id, event_type, actor_id, actor_name, actor_staff_id
      ) VALUES (p_study_id, 'changes_requested', v_actor, v_name, v_staff);
    END IF;
    RETURN public.mixing_study_json(p_study_id);
  END IF;

  IF v_actor <> v_study.performed_by THEN
    RAISE EXCEPTION 'Only the performer can update this mixing study';
  END IF;
  IF NOT (
    public.has_permission('medical_reports.create')
    OR public.has_permission('medical_reports.edit')
  ) THEN
    RAISE EXCEPTION 'You do not have permission to edit this mixing study';
  END IF;
  IF v_study.status NOT IN ('draft', 'changes_requested') THEN
    RAISE EXCEPTION 'Workflow stage cannot be skipped';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload->'results') <> 'array' THEN
    RAISE EXCEPTION 'Invalid results';
  END IF;

  v_selection := COALESCE(NULLIF(btrim(p_payload->>'testSelection'), ''), v_study.test_selection::TEXT);
  IF v_selection NOT IN ('aptt', 'pt', 'both') THEN
    RAISE EXCEPTION 'Test selection must be APTT, PT, or both';
  END IF;
  v_date_text := NULLIF(btrim(p_payload->>'studyDate'), '');
  IF v_date_text IS NULL THEN
    v_study_date := v_study.study_date;
  ELSE
    IF v_date_text !~ '^\d{4}-\d{2}-\d{2}$' THEN
      RAISE EXCEPTION 'Study date is invalid';
    END IF;
    BEGIN
      v_study_date := v_date_text::DATE;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Study date is invalid';
    END;
  END IF;

  PERFORM set_config('mixing_study.workflow', '1', true);
  UPDATE public.medical_mixing_studies
  SET test_selection = v_selection::public.mixing_study_test_selection,
      study_date = v_study_date
  WHERE id = p_study_id;
  DELETE FROM public.medical_mixing_study_results WHERE study_id = p_study_id;

  FOR v_element IN
    SELECT jsonb_array_elements(p_payload->'results')
  LOOP
    v_type := v_element->>'testType';
    IF v_type IS NULL OR v_type NOT IN ('aptt', 'pt') THEN
      RAISE EXCEPTION 'Invalid test type';
    END IF;
    IF v_selection = 'aptt' AND v_type <> 'aptt' THEN
      CONTINUE;
    END IF;
    IF v_selection = 'pt' AND v_type <> 'pt' THEN
      CONTINUE;
    END IF;
    IF v_type = ANY(v_seen) THEN
      RAISE EXCEPTION 'Duplicate test type';
    END IF;
    v_seen := array_append(v_seen, v_type);
    v_label := CASE v_type WHEN 'aptt' THEN 'APTT' ELSE 'PT' END;
    v_patient := public.mixing_study_parse_decimal(v_element->>'patientClottingTime', v_label || ' patient clotting time');
    v_npp := public.mixing_study_parse_decimal(v_element->>'nppClottingTime', v_label || ' NPP clotting time');
    v_target := public.mixing_study_parse_decimal(v_element->>'targetValue', v_label || ' target value');
    v_immediate := public.mixing_study_parse_decimal(v_element->>'immediateMixClottingTime', v_label || ' immediate 1:1 mix');
    v_incubated := public.mixing_study_parse_decimal(v_element->>'incubatedMixClottingTime', v_label || ' after-incubation 1:1 mix');
    IF v_patient = 0 THEN
      RAISE EXCEPTION '%: Cannot Calculate', v_label;
    END IF;
    IF v_target IS NOT NULL AND v_target <= 0 THEN
      RAISE EXCEPTION '% target value must be a positive number', v_label;
    END IF;
    IF (v_npp IS NOT NULL AND v_npp <= 0)
      OR (v_immediate IS NOT NULL AND v_immediate <= 0)
      OR (v_incubated IS NOT NULL AND v_incubated <= 0) THEN
      RAISE EXCEPTION 'Clotting times must be positive';
    END IF;
    v_conclusion := NULLIF(btrim(COALESCE(v_element->>'conclusion', '')), '');
    IF v_conclusion IS NOT NULL AND char_length(v_conclusion) > 2000 THEN
      RAISE EXCEPTION '%: Conclusion is too long', v_label;
    END IF;

    SELECT result.rosner_index, result.interpretation
      INTO v_immediate_index, v_immediate_text
    FROM public.mixing_study_rosner(v_patient, v_npp, v_immediate) AS result;
    SELECT result.rosner_index, result.interpretation
      INTO v_incubated_index, v_incubated_text
    FROM public.mixing_study_rosner(v_patient, v_npp, v_incubated) AS result;

    IF p_action = 'submit' THEN
      IF v_immediate_text IS DISTINCT FROM 'Suggests presence of an inhibitor'
        AND v_immediate_text IS DISTINCT FROM 'Does not exceed the Form-Hema-023 inhibitor threshold.' THEN
        RAISE EXCEPTION '%: %', v_label, COALESCE(v_immediate_text, 'Incomplete');
      END IF;
      IF v_incubated_text IS DISTINCT FROM 'Suggests presence of an inhibitor'
        AND v_incubated_text IS DISTINCT FROM 'Does not exceed the Form-Hema-023 inhibitor threshold.' THEN
        RAISE EXCEPTION '%: %', v_label, COALESCE(v_incubated_text, 'Incomplete');
      END IF;
      IF v_target IS NULL THEN
        RAISE EXCEPTION '% target value must be a positive number', v_label;
      END IF;
      IF v_conclusion IS NULL THEN
        RAISE EXCEPTION '%: Conclusion is required', v_label;
      END IF;
    END IF;

    INSERT INTO public.medical_mixing_study_results (
      study_id, test_type, patient_clotting_time, npp_clotting_time, target_value,
      immediate_mix_clotting_time, immediate_rosner_index, immediate_interpretation,
      incubated_mix_clotting_time, incubated_rosner_index, incubated_interpretation,
      conclusion
    ) VALUES (
      p_study_id, v_type::public.mixing_study_test_type, v_patient, v_npp, v_target,
      v_immediate, v_immediate_index, v_immediate_text,
      v_incubated, v_incubated_index, v_incubated_text,
      v_conclusion
    );
  END LOOP;

  IF p_action = 'submit' THEN
    FOREACH v_required IN ARRAY (
      CASE v_selection
        WHEN 'both' THEN ARRAY['aptt', 'pt']
        ELSE ARRAY[v_selection]
      END
    ) LOOP
      IF NOT (v_required = ANY(v_seen)) THEN
        RAISE EXCEPTION '%: Incomplete', CASE v_required WHEN 'aptt' THEN 'APTT' ELSE 'PT' END;
      END IF;
    END LOOP;
    UPDATE public.medical_mixing_studies
    SET status = 'pending_review',
        submitted_at = NOW()
    WHERE id = p_study_id;
    INSERT INTO public.medical_mixing_study_events (
      study_id, event_type, actor_id, actor_name, actor_staff_id
    ) VALUES (p_study_id, 'submitted', v_actor, v_name, v_staff);
  ELSE
    INSERT INTO public.medical_mixing_study_events (
      study_id, event_type, actor_id, actor_name, actor_staff_id
    ) VALUES (p_study_id, 'draft_updated', v_actor, v_name, v_staff);
  END IF;

  RETURN public.mixing_study_json(p_study_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_mixing_study_sample_reference(
  p_study_id UUID,
  p_ciphertext TEXT,
  p_key_version TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_study public.medical_mixing_studies%ROWTYPE;
  v_name TEXT;
  v_staff TEXT;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  SELECT * INTO v_study
  FROM public.medical_mixing_studies
  WHERE id = p_study_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mixing study not found';
  END IF;
  IF v_study.status = 'reviewed' THEN
    RAISE EXCEPTION 'Reviewed mixing studies are locked';
  END IF;
  IF v_study.status NOT IN ('draft', 'changes_requested') THEN
    RAISE EXCEPTION 'Workflow stage cannot be skipped';
  END IF;
  IF v_actor <> v_study.performed_by THEN
    RAISE EXCEPTION 'Only the performer can update this mixing study';
  END IF;
  IF NOT (
    public.has_permission('medical_reports.create')
    OR public.has_permission('medical_reports.edit')
  ) THEN
    RAISE EXCEPTION 'You do not have permission to edit this mixing study';
  END IF;
  IF (p_ciphertext IS NULL) <> (p_key_version IS NULL) THEN
    RAISE EXCEPTION 'Invalid sample reference protection';
  END IF;
  IF p_ciphertext IS NOT NULL AND (
    p_key_version NOT IN ('v1:form-hema-023', 'synthetic-v1:form-hema-023')
    OR p_ciphertext !~ '^(synthetic:)?[A-Za-z0-9_-]{43,}$'
  ) THEN
    RAISE EXCEPTION 'Invalid sample reference protection';
  END IF;

  SELECT full_name, NULLIF(btrim(staff_id), '') INTO v_name, v_staff
  FROM public.profiles WHERE id = v_actor;
  PERFORM set_config('mixing_study.workflow', '1', true);
  UPDATE public.medical_mixing_studies
  SET sample_reference_ciphertext = p_ciphertext,
      sample_reference_key_version = p_key_version,
      sample_reference_present = p_ciphertext IS NOT NULL
  WHERE id = p_study_id;
  INSERT INTO public.medical_mixing_study_events (
    study_id, event_type, actor_id, actor_name, actor_staff_id
  ) VALUES (p_study_id, 'draft_updated', v_actor, v_name, v_staff);
  RETURN public.mixing_study_json(p_study_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_mixing_study_pdf_export(p_study_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_name TEXT;
  v_staff TEXT;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT public.has_permission('medical_reports.print') THEN
    RAISE EXCEPTION 'You do not have permission to print mixing studies';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.medical_mixing_studies
    WHERE id = p_study_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Mixing study not found';
  END IF;
  IF NOT public.has_permission('medical_reports.view') THEN
    RAISE EXCEPTION 'You do not have permission to view mixing studies';
  END IF;
  SELECT full_name, NULLIF(btrim(staff_id), '') INTO v_name, v_staff
  FROM public.profiles WHERE id = v_actor AND deleted_at IS NULL AND is_active = TRUE;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  PERFORM set_config('mixing_study.workflow', '1', true);
  INSERT INTO public.medical_mixing_study_events (
    study_id, event_type, actor_id, actor_name, actor_staff_id
  ) VALUES (p_study_id, 'pdf_exported', v_actor, v_name, v_staff);
END;
$$;

REVOKE ALL ON FUNCTION public.mixing_study_rosner(NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mixing_study_parse_decimal(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mixing_study_json(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_medical_mixing_studies_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_medical_mixing_study_results_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_medical_mixing_study_events_guard() FROM PUBLIC;

REVOKE ALL ON FUNCTION public.get_mixing_study(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_mixing_studies(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_mixing_study(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.perform_mixing_study_action(UUID, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_mixing_study_sample_reference(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_mixing_study_pdf_export(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_mixing_study(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_mixing_studies(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_mixing_study(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.perform_mixing_study_action(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_mixing_study_sample_reference(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_mixing_study_pdf_export(UUID) TO authenticated;

REVOKE ALL ON public.medical_mixing_studies FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.medical_mixing_study_results FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.medical_mixing_study_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.medical_mixing_study_number_seq FROM PUBLIC, anon, authenticated;

GRANT SELECT (
  id, study_number, test_selection, study_date, status, sample_reference_present,
  performed_by_name, performed_by_staff_id, submitted_at,
  reviewed_by_name, reviewed_by_staff_id, reviewed_at, review_comment,
  created_at, updated_at
) ON public.medical_mixing_studies TO authenticated;

GRANT SELECT ON public.medical_mixing_study_results TO authenticated;
GRANT SELECT ON public.medical_mixing_study_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_mixing_studies TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_mixing_study_results TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_mixing_study_events TO service_role;

ALTER TABLE public.medical_mixing_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_mixing_studies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.medical_mixing_study_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_mixing_study_results FORCE ROW LEVEL SECURITY;
ALTER TABLE public.medical_mixing_study_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_mixing_study_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS medical_mixing_studies_select ON public.medical_mixing_studies;
CREATE POLICY medical_mixing_studies_select ON public.medical_mixing_studies
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('medical_reports.view'));

DROP POLICY IF EXISTS medical_mixing_study_results_select ON public.medical_mixing_study_results;
CREATE POLICY medical_mixing_study_results_select ON public.medical_mixing_study_results
  FOR SELECT TO authenticated
  USING (
    public.has_permission('medical_reports.view')
    AND EXISTS (
      SELECT 1 FROM public.medical_mixing_studies s
      WHERE s.id = study_id AND s.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS medical_mixing_study_events_select ON public.medical_mixing_study_events;
CREATE POLICY medical_mixing_study_events_select ON public.medical_mixing_study_events
  FOR SELECT TO authenticated
  USING (
    public.has_permission('medical_reports.view')
    AND EXISTS (
      SELECT 1 FROM public.medical_mixing_studies s
      WHERE s.id = study_id AND s.deleted_at IS NULL
    )
  );

COMMIT;
