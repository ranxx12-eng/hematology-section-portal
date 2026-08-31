-- ============================================================================
-- Migration 048: Environmental Monitoring module
-- Assets, monitoring windows, readings, corrections, excursions, audit events.
-- Idempotent. Does NOT auto-apply — run manually when ready.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'environmental_asset_type') THEN
    CREATE TYPE public.environmental_asset_type AS ENUM (
      'refrigerator',
      'cold_room',
      'storage_room',
      'room_temperature'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'environmental_reading_status') THEN
    CREATE TYPE public.environmental_reading_status AS ENUM ('in_range', 'out_of_range');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'environmental_reading_source') THEN
    CREATE TYPE public.environmental_reading_source AS ENUM ('qr', 'portal');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'environmental_excursion_status') THEN
    CREATE TYPE public.environmental_excursion_status AS ENUM (
      'open',
      'under_action',
      'awaiting_recheck',
      'resolved',
      'voided'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'environmental_review_decision') THEN
    CREATE TYPE public.environmental_review_decision AS ENUM (
      'accept',
      'not_accept',
      'need_follow_up'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (code, description) VALUES
  ('environmental.view', 'View environmental monitoring'),
  ('environmental.record', 'Record environmental readings'),
  ('environmental.correct', 'Correct environmental readings'),
  ('environmental.review', 'Review environmental excursions'),
  ('environmental.resolve', 'Resolve environmental excursions'),
  ('environmental.manage_assets', 'Manage environmental assets and windows'),
  ('environmental.audit', 'View environmental audit trail'),
  ('environmental.void', 'Void environmental readings/excursions')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description, deleted_at = NULL;

INSERT INTO public.role_permissions (role, permission_code)
SELECT r.role, p.code
FROM (VALUES
  ('system_admin', 'environmental.view'),
  ('system_admin', 'environmental.record'),
  ('system_admin', 'environmental.correct'),
  ('system_admin', 'environmental.review'),
  ('system_admin', 'environmental.resolve'),
  ('system_admin', 'environmental.manage_assets'),
  ('system_admin', 'environmental.audit'),
  ('system_admin', 'environmental.void'),
  ('quality_officer', 'environmental.view'),
  ('quality_officer', 'environmental.record'),
  ('quality_officer', 'environmental.correct'),
  ('quality_officer', 'environmental.review'),
  ('quality_officer', 'environmental.resolve'),
  ('quality_officer', 'environmental.manage_assets'),
  ('quality_officer', 'environmental.audit'),
  ('quality_link', 'environmental.view'),
  ('quality_link', 'environmental.record'),
  ('quality_link', 'environmental.correct'),
  ('quality_link', 'environmental.review'),
  ('quality_link', 'environmental.resolve'),
  ('quality_link', 'environmental.manage_assets'),
  ('quality_link', 'environmental.audit'),
  ('section_supervisor', 'environmental.view'),
  ('section_supervisor', 'environmental.record'),
  ('section_supervisor', 'environmental.review'),
  ('section_supervisor', 'environmental.resolve'),
  ('section_supervisor', 'environmental.audit'),
  ('team_leader', 'environmental.view'),
  ('team_leader', 'environmental.record'),
  ('team_leader', 'environmental.review'),
  ('team_leader', 'environmental.audit'),
  ('senior_lab_technologist', 'environmental.view'),
  ('senior_lab_technologist', 'environmental.record'),
  ('senior_lab_technologist', 'environmental.correct'),
  ('senior_lab_technologist', 'environmental.review'),
  ('senior_lab_technologist', 'environmental.audit'),
  ('lab_technologist', 'environmental.view'),
  ('lab_technologist', 'environmental.record'),
  ('lab_technologist', 'environmental.correct'),
  ('lab_director', 'environmental.view'),
  ('lab_director', 'environmental.audit'),
  ('lab_manager', 'environmental.view'),
  ('lab_manager', 'environmental.audit'),
  ('head_of_section', 'environmental.view'),
  ('head_of_section', 'environmental.audit'),
  ('read_only', 'environmental.view'),
  ('viewer', 'environmental.view')
) AS r(role, code)
JOIN public.permissions p ON p.code = r.code
ON CONFLICT (role, permission_code) DO UPDATE SET deleted_at = NULL;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.environmental_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  asset_type public.environmental_asset_type NOT NULL,
  location TEXT,
  serial_number TEXT,
  description TEXT,
  min_temperature NUMERIC(6,2) NOT NULL,
  max_temperature NUMERIC(6,2) NOT NULL,
  humidity_min NUMERIC(6,2),
  humidity_max NUMERIC(6,2),
  humidity_required BOOLEAN NOT NULL DEFAULT FALSE,
  monitoring_frequency TEXT NOT NULL DEFAULT 'daily',
  qr_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT environmental_assets_asset_code_unique UNIQUE (asset_code),
  CONSTRAINT environmental_assets_qr_token_unique UNIQUE (qr_token),
  CONSTRAINT environmental_assets_temperature_range_check
    CHECK (min_temperature <= max_temperature),
  CONSTRAINT environmental_assets_humidity_range_check
    CHECK (
      humidity_min IS NULL
      OR humidity_max IS NULL
      OR humidity_min <= humidity_max
    )
);

CREATE TABLE IF NOT EXISTS public.environmental_monitoring_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.environmental_assets(id) ON DELETE CASCADE,
  window_name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  days_of_week SMALLINT[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6],
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT environmental_monitoring_windows_days_check
    CHECK (cardinality(days_of_week) > 0)
);

CREATE TABLE IF NOT EXISTS public.environmental_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.environmental_assets(id) ON DELETE RESTRICT,
  monitoring_window_id UUID REFERENCES public.environmental_monitoring_windows(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  temperature NUMERIC(6,2) NOT NULL,
  humidity NUMERIC(6,2),
  calculated_status public.environmental_reading_status NOT NULL,
  range_min_at_reading NUMERIC(6,2) NOT NULL,
  range_max_at_reading NUMERIC(6,2) NOT NULL,
  humidity_min_at_reading NUMERIC(6,2),
  humidity_max_at_reading NUMERIC(6,2),
  performed_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  performed_by_name TEXT NOT NULL,
  performed_by_staff_id TEXT,
  source public.environmental_reading_source NOT NULL DEFAULT 'portal',
  comment TEXT,
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  voided_by_name TEXT,
  voided_by_staff_id TEXT,
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT environmental_readings_void_reason_check
    CHECK (voided_at IS NULL OR (void_reason IS NOT NULL AND btrim(void_reason) <> ''))
);

CREATE TABLE IF NOT EXISTS public.environmental_reading_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_id UUID NOT NULL REFERENCES public.environmental_readings(id) ON DELETE RESTRICT,
  previous_temperature NUMERIC(6,2) NOT NULL,
  new_temperature NUMERIC(6,2) NOT NULL,
  previous_humidity NUMERIC(6,2),
  new_humidity NUMERIC(6,2),
  correction_reason TEXT NOT NULL,
  corrected_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  corrected_by_name TEXT NOT NULL,
  corrected_by_staff_id TEXT,
  corrected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.environmental_excursions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_id UUID NOT NULL REFERENCES public.environmental_readings(id) ON DELETE RESTRICT,
  asset_id UUID NOT NULL REFERENCES public.environmental_assets(id) ON DELETE RESTRICT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detected_temperature NUMERIC(6,2) NOT NULL,
  detected_humidity NUMERIC(6,2),
  range_min_at_detection NUMERIC(6,2) NOT NULL,
  range_max_at_detection NUMERIC(6,2) NOT NULL,
  status public.environmental_excursion_status NOT NULL DEFAULT 'open',
  immediate_action TEXT,
  affected_material TEXT,
  maintenance_ticket_number TEXT,
  additional_comment TEXT,
  recheck_temperature NUMERIC(6,2),
  recheck_humidity NUMERIC(6,2),
  recheck_at TIMESTAMPTZ,
  rechecked_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rechecked_by_name TEXT,
  rechecked_by_staff_id TEXT,
  resolution_status TEXT,
  resolution_comment TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_by_name TEXT,
  resolved_by_staff_id TEXT,
  review_status TEXT NOT NULL DEFAULT 'Pending Review',
  review_decision public.environmental_review_decision,
  review_comment TEXT,
  reviewed_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_by_name TEXT,
  reviewed_by_staff_id TEXT,
  reviewed_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  voided_by_name TEXT,
  voided_by_staff_id TEXT,
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT environmental_excursions_reading_unique UNIQUE (reading_id)
);

CREATE TABLE IF NOT EXISTS public.environmental_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL DEFAULT 'environmental_monitoring',
  record_type TEXT NOT NULL,
  record_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  performed_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  performed_by_name TEXT,
  performed_by_staff_id TEXT,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_environmental_assets_active
  ON public.environmental_assets(active) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_environmental_windows_asset
  ON public.environmental_monitoring_windows(asset_id) WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_environmental_readings_asset_recorded
  ON public.environmental_readings(asset_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_environmental_readings_window
  ON public.environmental_readings(monitoring_window_id, recorded_at DESC)
  WHERE voided_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_environmental_excursions_asset_status
  ON public.environmental_excursions(asset_id, status)
  WHERE voided_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_environmental_audit_record
  ON public.environmental_audit_events(record_type, record_id, performed_at DESC);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.environmental_calculate_reading_status(
  p_temperature NUMERIC,
  p_humidity NUMERIC,
  p_min_temperature NUMERIC,
  p_max_temperature NUMERIC,
  p_humidity_min NUMERIC,
  p_humidity_max NUMERIC,
  p_humidity_required BOOLEAN
)
RETURNS public.environmental_reading_status
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_temperature < p_min_temperature OR p_temperature > p_max_temperature THEN
    RETURN 'out_of_range'::public.environmental_reading_status;
  END IF;

  IF COALESCE(p_humidity_required, FALSE) THEN
    IF p_humidity IS NULL THEN
      RETURN 'out_of_range'::public.environmental_reading_status;
    END IF;
    IF p_humidity_min IS NOT NULL AND p_humidity < p_humidity_min THEN
      RETURN 'out_of_range'::public.environmental_reading_status;
    END IF;
    IF p_humidity_max IS NOT NULL AND p_humidity > p_humidity_max THEN
      RETURN 'out_of_range'::public.environmental_reading_status;
    END IF;
  END IF;

  RETURN 'in_range'::public.environmental_reading_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.environmental_write_audit_event(
  p_record_type TEXT,
  p_record_id UUID,
  p_event_type TEXT,
  p_old_data JSONB,
  p_new_data JSONB,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
BEGIN
  SELECT id, full_name, staff_id
  INTO v_profile
  FROM public.profiles
  WHERE id = auth.uid();

  INSERT INTO public.environmental_audit_events (
    record_type,
    record_id,
    event_type,
    old_data,
    new_data,
    performed_by_user_id,
    performed_by_name,
    performed_by_staff_id,
    reason
  ) VALUES (
    p_record_type,
    p_record_id,
    p_event_type,
    p_old_data,
    p_new_data,
    v_profile.id,
    v_profile.full_name,
    v_profile.staff_id,
    p_reason
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_environmental_reading_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asset public.environmental_assets%ROWTYPE;
BEGIN
  IF NOT public.has_permission('environmental.record') AND NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Not authorized to record environmental readings' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_asset
  FROM public.environmental_assets
  WHERE id = NEW.asset_id
    AND deleted_at IS NULL
    AND active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Environmental asset not found or inactive' USING ERRCODE = '23503';
  END IF;

  IF NEW.performed_by_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Performer identity must match authenticated user' USING ERRCODE = '42501';
  END IF;

  NEW.range_min_at_reading := v_asset.min_temperature;
  NEW.range_max_at_reading := v_asset.max_temperature;
  NEW.humidity_min_at_reading := v_asset.humidity_min;
  NEW.humidity_max_at_reading := v_asset.humidity_max;

  NEW.calculated_status := public.environmental_calculate_reading_status(
    NEW.temperature,
    NEW.humidity,
    NEW.range_min_at_reading,
    NEW.range_max_at_reading,
    NEW.humidity_min_at_reading,
    NEW.humidity_max_at_reading,
    v_asset.humidity_required
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_environmental_excursion_for_reading()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.calculated_status = 'out_of_range'::public.environmental_reading_status
    AND NEW.voided_at IS NULL THEN
    INSERT INTO public.environmental_excursions (
      reading_id,
      asset_id,
      detected_at,
      detected_temperature,
      detected_humidity,
      range_min_at_detection,
      range_max_at_detection,
      status
    ) VALUES (
      NEW.id,
      NEW.asset_id,
      NEW.recorded_at,
      NEW.temperature,
      NEW.humidity,
      NEW.range_min_at_reading,
      NEW.range_max_at_reading,
      'open'
    )
    ON CONFLICT (reading_id) DO NOTHING;

    PERFORM public.environmental_write_audit_event(
      'excursion',
      (SELECT id FROM public.environmental_excursions WHERE reading_id = NEW.id),
      'EXCURSION_CREATED',
      NULL,
      to_jsonb(NEW),
      NULL
    );
  END IF;

  PERFORM public.environmental_write_audit_event(
    'reading',
    NEW.id,
    'READING_CREATED',
    NULL,
    to_jsonb(NEW),
    NULL
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_environmental_reading_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.temperature IS DISTINCT FROM NEW.temperature
      OR OLD.humidity IS DISTINCT FROM NEW.humidity
      OR OLD.calculated_status IS DISTINCT FROM NEW.calculated_status
      OR OLD.range_min_at_reading IS DISTINCT FROM NEW.range_min_at_reading
      OR OLD.range_max_at_reading IS DISTINCT FROM NEW.range_max_at_reading THEN
      IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Environmental readings are immutable. Use correction workflow.'
          USING ERRCODE = '42501';
      END IF;
    END IF;

    IF OLD.voided_at IS NULL AND NEW.voided_at IS NOT NULL THEN
      IF NOT (public.has_permission('environmental.void') OR public.is_system_admin()) THEN
        RAISE EXCEPTION 'Not authorized to void environmental readings' USING ERRCODE = '42501';
      END IF;
      IF NEW.void_reason IS NULL OR btrim(NEW.void_reason) = '' THEN
        RAISE EXCEPTION 'Void reason is required' USING ERRCODE = '42501';
      END IF;
      IF NEW.voided_by IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Void identity must match authenticated user' USING ERRCODE = '42501';
      END IF;

      PERFORM public.environmental_write_audit_event(
        'reading',
        NEW.id,
        'READING_VOIDED',
        to_jsonb(OLD),
        to_jsonb(NEW),
        NEW.void_reason
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_environmental_reading_insert ON public.environmental_readings;
CREATE TRIGGER trg_environmental_reading_insert
  BEFORE INSERT ON public.environmental_readings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_environmental_reading_insert();

DROP TRIGGER IF EXISTS trg_environmental_reading_after_insert ON public.environmental_readings;
CREATE TRIGGER trg_environmental_reading_after_insert
  AFTER INSERT ON public.environmental_readings
  FOR EACH ROW EXECUTE FUNCTION public.create_environmental_excursion_for_reading();

DROP TRIGGER IF EXISTS trg_environmental_reading_update ON public.environmental_readings;
CREATE TRIGGER trg_environmental_reading_update
  BEFORE UPDATE ON public.environmental_readings
  FOR EACH ROW EXECUTE FUNCTION public.prevent_environmental_reading_mutation();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.environmental_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environmental_monitoring_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environmental_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environmental_reading_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environmental_excursions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environmental_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS environmental_assets_select ON public.environmental_assets;
CREATE POLICY environmental_assets_select ON public.environmental_assets
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('environmental.view'));

DROP POLICY IF EXISTS environmental_assets_manage ON public.environmental_assets;
CREATE POLICY environmental_assets_manage ON public.environmental_assets
  FOR ALL TO authenticated
  USING (public.has_permission('environmental.manage_assets') OR public.is_system_admin())
  WITH CHECK (public.has_permission('environmental.manage_assets') OR public.is_system_admin());

DROP POLICY IF EXISTS environmental_windows_select ON public.environmental_monitoring_windows;
CREATE POLICY environmental_windows_select ON public.environmental_monitoring_windows
  FOR SELECT TO authenticated
  USING (public.has_permission('environmental.view'));

DROP POLICY IF EXISTS environmental_windows_manage ON public.environmental_monitoring_windows;
CREATE POLICY environmental_windows_manage ON public.environmental_monitoring_windows
  FOR ALL TO authenticated
  USING (public.has_permission('environmental.manage_assets') OR public.is_system_admin())
  WITH CHECK (public.has_permission('environmental.manage_assets') OR public.is_system_admin());

DROP POLICY IF EXISTS environmental_readings_select ON public.environmental_readings;
CREATE POLICY environmental_readings_select ON public.environmental_readings
  FOR SELECT TO authenticated
  USING (public.has_permission('environmental.view'));

DROP POLICY IF EXISTS environmental_readings_insert ON public.environmental_readings;
CREATE POLICY environmental_readings_insert ON public.environmental_readings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('environmental.record') OR public.is_system_admin());

DROP POLICY IF EXISTS environmental_readings_void ON public.environmental_readings;
CREATE POLICY environmental_readings_void ON public.environmental_readings
  FOR UPDATE TO authenticated
  USING (public.has_permission('environmental.void') OR public.is_system_admin())
  WITH CHECK (public.has_permission('environmental.void') OR public.is_system_admin());

DROP POLICY IF EXISTS environmental_corrections_select ON public.environmental_reading_corrections;
CREATE POLICY environmental_corrections_select ON public.environmental_reading_corrections
  FOR SELECT TO authenticated
  USING (public.has_permission('environmental.view'));

DROP POLICY IF EXISTS environmental_corrections_insert ON public.environmental_reading_corrections;
CREATE POLICY environmental_corrections_insert ON public.environmental_reading_corrections
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('environmental.correct') OR public.is_system_admin());

DROP POLICY IF EXISTS environmental_excursions_select ON public.environmental_excursions;
CREATE POLICY environmental_excursions_select ON public.environmental_excursions
  FOR SELECT TO authenticated
  USING (public.has_permission('environmental.view'));

DROP POLICY IF EXISTS environmental_excursions_update ON public.environmental_excursions;
CREATE POLICY environmental_excursions_update ON public.environmental_excursions
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('environmental.record')
    OR public.has_permission('environmental.resolve')
    OR public.has_permission('environmental.review')
    OR public.is_system_admin()
  )
  WITH CHECK (
    public.has_permission('environmental.record')
    OR public.has_permission('environmental.resolve')
    OR public.has_permission('environmental.review')
    OR public.is_system_admin()
  );

DROP POLICY IF EXISTS environmental_audit_select ON public.environmental_audit_events;
CREATE POLICY environmental_audit_select ON public.environmental_audit_events
  FOR SELECT TO authenticated
  USING (public.has_permission('environmental.audit') OR public.has_permission('environmental.view'));

DROP POLICY IF EXISTS environmental_audit_insert ON public.environmental_audit_events;
CREATE POLICY environmental_audit_insert ON public.environmental_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (performed_by_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Seed initial assets + default windows (admin-editable limits)
-- ---------------------------------------------------------------------------

INSERT INTO public.environmental_assets (
  asset_code, asset_name, asset_type, location, min_temperature, max_temperature,
  humidity_required, monitoring_frequency, active
) VALUES
  ('REF-01', 'Refrigerator 01', 'refrigerator', 'Hematology Section', 2, 8, FALSE, 'daily', TRUE),
  ('REF-02', 'Refrigerator 02', 'refrigerator', 'Hematology Section', 2, 8, FALSE, 'daily', TRUE),
  ('STORAGE-01', 'Storage', 'storage_room', 'Hematology Section', 15, 25, FALSE, 'daily', TRUE),
  ('COLD-ROOM-01', 'Cold Room', 'cold_room', 'Hematology Section', 2, 8, FALSE, 'daily', TRUE),
  ('HEMA-ROOM-01', 'Hematology Section Room Temperature', 'room_temperature', 'Hematology Section', 18, 25, FALSE, 'daily', TRUE)
ON CONFLICT (asset_code) DO UPDATE SET
  asset_name = EXCLUDED.asset_name,
  asset_type = EXCLUDED.asset_type,
  location = EXCLUDED.location,
  active = EXCLUDED.active,
  updated_at = NOW();

INSERT INTO public.environmental_monitoring_windows (asset_id, window_name, start_time, end_time, required, days_of_week, active)
SELECT a.id, w.window_name, w.start_time::TIME, w.end_time::TIME, TRUE, ARRAY[0,1,2,3,4,5,6], TRUE
FROM public.environmental_assets a
CROSS JOIN (VALUES
  ('Morning', '06:00', '10:00'),
  ('Evening', '18:00', '22:00')
) AS w(window_name, start_time, end_time)
WHERE a.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.environmental_monitoring_windows emw
    WHERE emw.asset_id = a.id AND emw.window_name = w.window_name
  );

COMMIT;
