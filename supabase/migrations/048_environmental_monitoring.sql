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

INSERT INTO public.permissions (code, module, description) VALUES
  ('environmental.view', 'environmental_monitoring', 'View environmental monitoring'),
  ('environmental.record', 'environmental_monitoring', 'Record environmental readings'),
  ('environmental.correct', 'environmental_monitoring', 'Correct environmental readings'),
  ('environmental.review', 'environmental_monitoring', 'Review environmental excursions'),
  ('environmental.resolve', 'environmental_monitoring', 'Resolve environmental excursions'),
  ('environmental.manage_assets', 'environmental_monitoring', 'Manage environmental assets and windows'),
  ('environmental.audit', 'environmental_monitoring', 'View environmental audit trail'),
  ('environmental.void', 'environmental_monitoring', 'Void environmental readings/excursions')
ON CONFLICT (code) DO UPDATE SET
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'environmental.view',
  'environmental.record',
  'environmental.correct',
  'environmental.review',
  'environmental.resolve',
  'environmental.manage_assets',
  'environmental.audit',
  'environmental.void'
)
WHERE r.name = 'system_admin'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'environmental.view',
  'environmental.record',
  'environmental.correct',
  'environmental.review',
  'environmental.resolve',
  'environmental.manage_assets',
  'environmental.audit'
)
WHERE r.name = 'quality_officer'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'environmental.view',
  'environmental.record',
  'environmental.review',
  'environmental.resolve',
  'environmental.audit'
)
WHERE r.name = 'section_supervisor'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'environmental.view',
  'environmental.record',
  'environmental.correct',
  'environmental.review',
  'environmental.resolve',
  'environmental.audit'
)
WHERE r.name = 'senior_lab_technologist'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'environmental.view',
  'environmental.record',
  'environmental.correct'
)
WHERE r.name = 'lab_technologist'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN ('environmental.view', 'environmental.audit')
WHERE r.name IN ('lab_manager', 'lab_director', 'head_of_section')
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'environmental.view'
WHERE r.name = 'read_only'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;

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
  qr_token TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
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
  out_of_range_parameters TEXT,
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

CREATE TABLE IF NOT EXISTS public.environmental_reading_admin_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_id UUID NOT NULL REFERENCES public.environmental_readings(id) ON DELETE RESTRICT,
  old_data JSONB NOT NULL,
  new_data JSONB NOT NULL,
  admin_change_reason TEXT NOT NULL,
  changed_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  changed_by_name TEXT NOT NULL,
  changed_by_staff_id TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT environmental_reading_admin_updates_reason_check
    CHECK (btrim(admin_change_reason) <> '')
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
  humidity_min_at_detection NUMERIC(6,2),
  humidity_max_at_detection NUMERIC(6,2),
  humidity_required_at_detection BOOLEAN NOT NULL DEFAULT FALSE,
  out_of_range_parameters TEXT,
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

CREATE INDEX IF NOT EXISTS idx_environmental_admin_updates_reading
  ON public.environmental_reading_admin_updates(reading_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_environmental_audit_record
  ON public.environmental_audit_events(record_type, record_id, performed_at DESC);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.environmental_calculate_out_of_range_parameters(
  p_temperature NUMERIC,
  p_humidity NUMERIC,
  p_min_temperature NUMERIC,
  p_max_temperature NUMERIC,
  p_humidity_min NUMERIC,
  p_humidity_max NUMERIC,
  p_humidity_required BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_temperature_out BOOLEAN := FALSE;
  v_humidity_out BOOLEAN := FALSE;
BEGIN
  IF p_temperature < p_min_temperature OR p_temperature > p_max_temperature THEN
    v_temperature_out := TRUE;
  END IF;

  IF COALESCE(p_humidity_required, FALSE) THEN
    IF p_humidity IS NULL THEN
      v_humidity_out := TRUE;
    ELSE
      IF p_humidity_min IS NOT NULL AND p_humidity < p_humidity_min THEN
        v_humidity_out := TRUE;
      END IF;
      IF p_humidity_max IS NOT NULL AND p_humidity > p_humidity_max THEN
        v_humidity_out := TRUE;
      END IF;
    END IF;
  END IF;

  IF v_temperature_out AND v_humidity_out THEN
    RETURN 'temperature_humidity';
  ELSIF v_temperature_out THEN
    RETURN 'temperature';
  ELSIF v_humidity_out THEN
    RETURN 'humidity';
  END IF;

  RETURN NULL;
END;
$$;

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

  NEW.out_of_range_parameters := public.environmental_calculate_out_of_range_parameters(
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
      humidity_min_at_detection,
      humidity_max_at_detection,
      humidity_required_at_detection,
      out_of_range_parameters,
      status
    ) VALUES (
      NEW.id,
      NEW.asset_id,
      NEW.recorded_at,
      NEW.temperature,
      NEW.humidity,
      NEW.range_min_at_reading,
      NEW.range_max_at_reading,
      NEW.humidity_min_at_reading,
      NEW.humidity_max_at_reading,
      (SELECT humidity_required FROM public.environmental_assets WHERE id = NEW.asset_id),
      NEW.out_of_range_parameters,
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
DECLARE
  v_admin_override BOOLEAN := COALESCE(current_setting('app.environmental_admin_override', true), '') = 'true';
  v_protected_changed BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF v_admin_override THEN
      RETURN NEW;
    END IF;

    v_protected_changed := (
      OLD.asset_id IS DISTINCT FROM NEW.asset_id
      OR OLD.monitoring_window_id IS DISTINCT FROM NEW.monitoring_window_id
      OR OLD.recorded_at IS DISTINCT FROM NEW.recorded_at
      OR OLD.temperature IS DISTINCT FROM NEW.temperature
      OR OLD.humidity IS DISTINCT FROM NEW.humidity
      OR OLD.calculated_status IS DISTINCT FROM NEW.calculated_status
      OR OLD.out_of_range_parameters IS DISTINCT FROM NEW.out_of_range_parameters
      OR OLD.range_min_at_reading IS DISTINCT FROM NEW.range_min_at_reading
      OR OLD.range_max_at_reading IS DISTINCT FROM NEW.range_max_at_reading
      OR OLD.humidity_min_at_reading IS DISTINCT FROM NEW.humidity_min_at_reading
      OR OLD.humidity_max_at_reading IS DISTINCT FROM NEW.humidity_max_at_reading
      OR OLD.performed_by_user_id IS DISTINCT FROM NEW.performed_by_user_id
      OR OLD.performed_by_name IS DISTINCT FROM NEW.performed_by_name
      OR OLD.performed_by_staff_id IS DISTINCT FROM NEW.performed_by_staff_id
      OR OLD.source IS DISTINCT FROM NEW.source
      OR OLD.comment IS DISTINCT FROM NEW.comment
    );

    IF v_protected_changed THEN
      RAISE EXCEPTION 'Environmental readings are immutable. Use correction or admin edit workflow.'
        USING ERRCODE = '42501';
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
      RETURN NEW;
    END IF;

    IF OLD.voided_at IS NOT NULL THEN
      IF to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW) THEN
        RAISE EXCEPTION 'Voided environmental readings cannot be modified' USING ERRCODE = '42501';
      END IF;
    END IF;

    IF to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW) THEN
      RAISE EXCEPTION 'Environmental readings cannot be modified outside void workflow'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_environmental_reading_correction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.environmental_write_audit_event(
    'reading',
    NEW.reading_id,
    'READING_CORRECTED',
    jsonb_build_object(
      'reading_id', NEW.reading_id,
      'temperature', NEW.previous_temperature,
      'humidity', NEW.previous_humidity
    ),
    jsonb_build_object(
      'reading_id', NEW.reading_id,
      'correction_id', NEW.id,
      'temperature', NEW.new_temperature,
      'humidity', NEW.new_humidity,
      'corrected_by_user_id', NEW.corrected_by_user_id,
      'corrected_by_name', NEW.corrected_by_name,
      'corrected_by_staff_id', NEW.corrected_by_staff_id,
      'corrected_at', NEW.corrected_at
    ),
    NEW.correction_reason
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.environmental_admin_update_reading(
  p_reading_id UUID,
  p_temperature NUMERIC,
  p_humidity NUMERIC DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_range_min_at_reading NUMERIC DEFAULT NULL,
  p_range_max_at_reading NUMERIC DEFAULT NULL,
  p_humidity_min_at_reading NUMERIC DEFAULT NULL,
  p_humidity_max_at_reading NUMERIC DEFAULT NULL
)
RETURNS public.environmental_readings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old public.environmental_readings%ROWTYPE;
  v_new public.environmental_readings%ROWTYPE;
  v_asset public.environmental_assets%ROWTYPE;
  v_profile RECORD;
  v_range_min NUMERIC;
  v_range_max NUMERIC;
  v_humidity_min NUMERIC;
  v_humidity_max NUMERIC;
  v_humidity_required BOOLEAN;
  v_new_status public.environmental_reading_status;
  v_new_oorp TEXT;
  v_excursion_id UUID;
  v_old_json JSONB;
  v_new_json JSONB;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Administrative reading edit requires system_admin role'
      USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Reason for administrative change is required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_old
  FROM public.environmental_readings
  WHERE id = p_reading_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Environmental reading not found' USING ERRCODE = '23503';
  END IF;

  IF v_old.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot administratively edit a voided reading' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_asset
  FROM public.environmental_assets
  WHERE id = v_old.asset_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Environmental asset not found' USING ERRCODE = '23503';
  END IF;

  v_humidity_required := v_asset.humidity_required;
  v_range_min := COALESCE(p_range_min_at_reading, v_old.range_min_at_reading);
  v_range_max := COALESCE(p_range_max_at_reading, v_old.range_max_at_reading);
  v_humidity_min := COALESCE(p_humidity_min_at_reading, v_old.humidity_min_at_reading);
  v_humidity_max := COALESCE(p_humidity_max_at_reading, v_old.humidity_max_at_reading);

  v_new_status := public.environmental_calculate_reading_status(
    p_temperature,
    p_humidity,
    v_range_min,
    v_range_max,
    v_humidity_min,
    v_humidity_max,
    v_humidity_required
  );

  v_new_oorp := public.environmental_calculate_out_of_range_parameters(
    p_temperature,
    p_humidity,
    v_range_min,
    v_range_max,
    v_humidity_min,
    v_humidity_max,
    v_humidity_required
  );

  SELECT id, full_name, staff_id
  INTO v_profile
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Authenticated profile not found' USING ERRCODE = '42501';
  END IF;

  v_old_json := to_jsonb(v_old);
  v_new_json := v_old_json || jsonb_build_object(
    'temperature', p_temperature,
    'humidity', p_humidity,
    'calculated_status', v_new_status,
    'out_of_range_parameters', v_new_oorp,
    'range_min_at_reading', v_range_min,
    'range_max_at_reading', v_range_max,
    'humidity_min_at_reading', v_humidity_min,
    'humidity_max_at_reading', v_humidity_max
  );

  INSERT INTO public.environmental_reading_admin_updates (
    reading_id,
    old_data,
    new_data,
    admin_change_reason,
    changed_by_user_id,
    changed_by_name,
    changed_by_staff_id
  ) VALUES (
    p_reading_id,
    v_old_json,
    v_new_json,
    btrim(p_reason),
    v_profile.id,
    v_profile.full_name,
    v_profile.staff_id
  );

  PERFORM set_config('app.environmental_admin_override', 'true', true);

  UPDATE public.environmental_readings
  SET
    temperature = p_temperature,
    humidity = p_humidity,
    calculated_status = v_new_status,
    out_of_range_parameters = v_new_oorp,
    range_min_at_reading = v_range_min,
    range_max_at_reading = v_range_max,
    humidity_min_at_reading = v_humidity_min,
    humidity_max_at_reading = v_humidity_max
  WHERE id = p_reading_id
  RETURNING * INTO v_new;

  PERFORM public.environmental_write_audit_event(
    'reading',
    p_reading_id,
    'READING_ADMIN_UPDATED',
    v_old_json,
    to_jsonb(v_new),
    btrim(p_reason)
  );

  SELECT id INTO v_excursion_id
  FROM public.environmental_excursions
  WHERE reading_id = p_reading_id;

  IF v_new_status = 'out_of_range'::public.environmental_reading_status
    AND v_old.calculated_status = 'in_range'::public.environmental_reading_status THEN
    INSERT INTO public.environmental_excursions (
      reading_id,
      asset_id,
      detected_at,
      detected_temperature,
      detected_humidity,
      range_min_at_detection,
      range_max_at_detection,
      humidity_min_at_detection,
      humidity_max_at_detection,
      humidity_required_at_detection,
      out_of_range_parameters,
      status
    ) VALUES (
      v_new.id,
      v_new.asset_id,
      v_new.recorded_at,
      v_new.temperature,
      v_new.humidity,
      v_new.range_min_at_reading,
      v_new.range_max_at_reading,
      v_new.humidity_min_at_reading,
      v_new.humidity_max_at_reading,
      v_humidity_required,
      v_new.out_of_range_parameters,
      'open'
    )
    ON CONFLICT (reading_id) DO NOTHING
    RETURNING id INTO v_excursion_id;

    IF v_excursion_id IS NOT NULL THEN
      PERFORM public.environmental_write_audit_event(
        'excursion',
        v_excursion_id,
        'EXCURSION_CREATED',
        NULL,
        to_jsonb(v_new),
        btrim(p_reason)
      );
    END IF;
  ELSIF v_new_status = 'in_range'::public.environmental_reading_status
    AND v_old.calculated_status = 'out_of_range'::public.environmental_reading_status
    AND v_excursion_id IS NOT NULL THEN
    UPDATE public.environmental_excursions
    SET
      additional_comment = COALESCE(additional_comment, '')
        || CASE WHEN additional_comment IS NULL OR btrim(additional_comment) = '' THEN '' ELSE E'\n' END
        || '[Administrative reading correction: ' || btrim(p_reason) || ']',
      resolution_comment = COALESCE(resolution_comment, '')
        || CASE WHEN resolution_comment IS NULL OR btrim(resolution_comment) = '' THEN '' ELSE E'\n' END
        || 'Originating reading administratively corrected to in-range on '
        || to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
      status = CASE WHEN status <> 'voided'::public.environmental_excursion_status THEN 'resolved'::public.environmental_excursion_status ELSE status END,
      updated_at = NOW()
    WHERE id = v_excursion_id
      AND voided_at IS NULL;
  END IF;

  RETURN v_new;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_environmental_excursion_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.reading_id IS DISTINCT FROM NEW.reading_id
      OR OLD.asset_id IS DISTINCT FROM NEW.asset_id
      OR OLD.detected_at IS DISTINCT FROM NEW.detected_at
      OR OLD.detected_temperature IS DISTINCT FROM NEW.detected_temperature
      OR OLD.detected_humidity IS DISTINCT FROM NEW.detected_humidity
      OR OLD.range_min_at_detection IS DISTINCT FROM NEW.range_min_at_detection
      OR OLD.range_max_at_detection IS DISTINCT FROM NEW.range_max_at_detection
      OR OLD.humidity_min_at_detection IS DISTINCT FROM NEW.humidity_min_at_detection
      OR OLD.humidity_max_at_detection IS DISTINCT FROM NEW.humidity_max_at_detection
      OR OLD.humidity_required_at_detection IS DISTINCT FROM NEW.humidity_required_at_detection
      OR OLD.out_of_range_parameters IS DISTINCT FROM NEW.out_of_range_parameters
      OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
      RAISE EXCEPTION 'Excursion detection metadata is immutable' USING ERRCODE = '42501';
    END IF;

    IF OLD.voided_at IS NULL AND NEW.voided_at IS NOT NULL THEN
      IF NOT (public.has_permission('environmental.void') OR public.is_system_admin()) THEN
        RAISE EXCEPTION 'Not authorized to void environmental excursions' USING ERRCODE = '42501';
      END IF;
      IF NEW.void_reason IS NULL OR btrim(NEW.void_reason) = '' THEN
        RAISE EXCEPTION 'Excursion void reason is required' USING ERRCODE = '42501';
      END IF;
      IF NEW.voided_by IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Excursion void identity must match authenticated user' USING ERRCODE = '42501';
      END IF;
      NEW.status := 'voided'::public.environmental_excursion_status;
      RETURN NEW;
    END IF;

    IF OLD.voided_at IS NOT NULL THEN
      RAISE EXCEPTION 'Voided environmental excursions cannot be modified' USING ERRCODE = '42501';
    END IF;

    IF public.is_system_admin() THEN
      RETURN NEW;
    END IF;

    IF (
      OLD.immediate_action IS DISTINCT FROM NEW.immediate_action
      OR OLD.affected_material IS DISTINCT FROM NEW.affected_material
      OR OLD.maintenance_ticket_number IS DISTINCT FROM NEW.maintenance_ticket_number
      OR OLD.additional_comment IS DISTINCT FROM NEW.additional_comment
      OR OLD.recheck_temperature IS DISTINCT FROM NEW.recheck_temperature
      OR OLD.recheck_humidity IS DISTINCT FROM NEW.recheck_humidity
      OR OLD.recheck_at IS DISTINCT FROM NEW.recheck_at
      OR OLD.rechecked_by_user_id IS DISTINCT FROM NEW.rechecked_by_user_id
      OR OLD.rechecked_by_name IS DISTINCT FROM NEW.rechecked_by_name
      OR OLD.rechecked_by_staff_id IS DISTINCT FROM NEW.rechecked_by_staff_id
    ) AND NOT public.has_permission('environmental.record') THEN
      RAISE EXCEPTION 'Not authorized to update excursion action or recheck fields' USING ERRCODE = '42501';
    END IF;

    IF (
      OLD.resolution_status IS DISTINCT FROM NEW.resolution_status
      OR OLD.resolution_comment IS DISTINCT FROM NEW.resolution_comment
      OR OLD.resolved_at IS DISTINCT FROM NEW.resolved_at
      OR OLD.resolved_by_user_id IS DISTINCT FROM NEW.resolved_by_user_id
      OR OLD.resolved_by_name IS DISTINCT FROM NEW.resolved_by_name
      OR OLD.resolved_by_staff_id IS DISTINCT FROM NEW.resolved_by_staff_id
    ) AND NOT public.has_permission('environmental.resolve') THEN
      RAISE EXCEPTION 'Not authorized to resolve environmental excursions' USING ERRCODE = '42501';
    END IF;

    IF (
      OLD.review_status IS DISTINCT FROM NEW.review_status
      OR OLD.review_decision IS DISTINCT FROM NEW.review_decision
      OR OLD.review_comment IS DISTINCT FROM NEW.review_comment
      OR OLD.reviewed_by_user_id IS DISTINCT FROM NEW.reviewed_by_user_id
      OR OLD.reviewed_by_name IS DISTINCT FROM NEW.reviewed_by_name
      OR OLD.reviewed_by_staff_id IS DISTINCT FROM NEW.reviewed_by_staff_id
      OR OLD.reviewed_at IS DISTINCT FROM NEW.reviewed_at
    ) AND NOT public.has_permission('environmental.review') THEN
      RAISE EXCEPTION 'Not authorized to review environmental excursions' USING ERRCODE = '42501';
    END IF;

    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'voided'::public.environmental_excursion_status THEN
        NULL;
      ELSIF NOT public.has_permission('environmental.record')
        AND NOT public.has_permission('environmental.resolve')
        AND NOT public.has_permission('environmental.review') THEN
        RAISE EXCEPTION 'Not authorized to change excursion status' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_environmental_excursion_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.voided_at IS NULL AND NEW.voided_at IS NOT NULL THEN
    PERFORM public.environmental_write_audit_event(
      'excursion',
      NEW.id,
      'EXCURSION_VOIDED',
      to_jsonb(OLD),
      to_jsonb(NEW),
      NEW.void_reason
    );
    RETURN NEW;
  END IF;

  IF OLD.immediate_action IS DISTINCT FROM NEW.immediate_action
    OR OLD.affected_material IS DISTINCT FROM NEW.affected_material
    OR OLD.maintenance_ticket_number IS DISTINCT FROM NEW.maintenance_ticket_number
    OR OLD.additional_comment IS DISTINCT FROM NEW.additional_comment
    OR (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'under_action'::public.environmental_excursion_status) THEN
    PERFORM public.environmental_write_audit_event(
      'excursion',
      NEW.id,
      'EXCURSION_ACTION_ADDED',
      to_jsonb(OLD),
      to_jsonb(NEW),
      NULL
    );
  END IF;

  IF OLD.recheck_temperature IS DISTINCT FROM NEW.recheck_temperature
    OR OLD.recheck_humidity IS DISTINCT FROM NEW.recheck_humidity
    OR OLD.recheck_at IS DISTINCT FROM NEW.recheck_at
    OR OLD.rechecked_by_user_id IS DISTINCT FROM NEW.rechecked_by_user_id THEN
    PERFORM public.environmental_write_audit_event(
      'excursion',
      NEW.id,
      'EXCURSION_RECHECKED',
      to_jsonb(OLD),
      to_jsonb(NEW),
      NULL
    );
  END IF;

  IF OLD.resolution_status IS DISTINCT FROM NEW.resolution_status
    OR OLD.resolution_comment IS DISTINCT FROM NEW.resolution_comment
    OR OLD.resolved_at IS DISTINCT FROM NEW.resolved_at
    OR (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'resolved'::public.environmental_excursion_status) THEN
    PERFORM public.environmental_write_audit_event(
      'excursion',
      NEW.id,
      'EXCURSION_RESOLVED',
      to_jsonb(OLD),
      to_jsonb(NEW),
      NULL
    );
  END IF;

  IF OLD.review_status IS DISTINCT FROM NEW.review_status
    OR OLD.review_decision IS DISTINCT FROM NEW.review_decision
    OR OLD.review_comment IS DISTINCT FROM NEW.review_comment
    OR OLD.reviewed_at IS DISTINCT FROM NEW.reviewed_at THEN
    PERFORM public.environmental_write_audit_event(
      'excursion',
      NEW.id,
      'EXCURSION_REVIEWED',
      to_jsonb(OLD),
      to_jsonb(NEW),
      NEW.review_comment
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_environmental_asset_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.environmental_write_audit_event(
      'asset',
      NEW.id,
      'ASSET_CREATED',
      NULL,
      to_jsonb(NEW),
      NULL
    );
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.environmental_write_audit_event(
      'asset',
      NEW.id,
      'ASSET_UPDATED',
      to_jsonb(OLD),
      to_jsonb(NEW),
      NULL
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
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

DROP TRIGGER IF EXISTS trg_environmental_correction_audit ON public.environmental_reading_corrections;
CREATE TRIGGER trg_environmental_correction_audit
  AFTER INSERT ON public.environmental_reading_corrections
  FOR EACH ROW EXECUTE FUNCTION public.audit_environmental_reading_correction();

DROP TRIGGER IF EXISTS trg_environmental_excursion_update ON public.environmental_excursions;
CREATE TRIGGER trg_environmental_excursion_update
  BEFORE UPDATE ON public.environmental_excursions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_environmental_excursion_mutation();

DROP TRIGGER IF EXISTS trg_environmental_excursion_audit ON public.environmental_excursions;
CREATE TRIGGER trg_environmental_excursion_audit
  AFTER UPDATE ON public.environmental_excursions
  FOR EACH ROW EXECUTE FUNCTION public.audit_environmental_excursion_update();

DROP TRIGGER IF EXISTS trg_environmental_asset_audit ON public.environmental_assets;
CREATE TRIGGER trg_environmental_asset_audit
  AFTER INSERT OR UPDATE ON public.environmental_assets
  FOR EACH ROW EXECUTE FUNCTION public.audit_environmental_asset_change();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.environmental_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environmental_monitoring_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environmental_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environmental_reading_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environmental_reading_admin_updates ENABLE ROW LEVEL SECURITY;
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

DROP POLICY IF EXISTS environmental_admin_updates_select ON public.environmental_reading_admin_updates;
CREATE POLICY environmental_admin_updates_select ON public.environmental_reading_admin_updates
  FOR SELECT TO authenticated
  USING (public.has_permission('environmental.view'));

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
    OR public.has_permission('environmental.void')
    OR public.is_system_admin()
  )
  WITH CHECK (
    public.has_permission('environmental.record')
    OR public.has_permission('environmental.resolve')
    OR public.has_permission('environmental.review')
    OR public.has_permission('environmental.void')
    OR public.is_system_admin()
  );

DROP POLICY IF EXISTS environmental_audit_select ON public.environmental_audit_events;
CREATE POLICY environmental_audit_select ON public.environmental_audit_events
  FOR SELECT TO authenticated
  USING (public.has_permission('environmental.audit') OR public.has_permission('environmental.view'));

DROP POLICY IF EXISTS environmental_audit_insert ON public.environmental_audit_events;

REVOKE ALL ON FUNCTION public.environmental_write_audit_event(TEXT, UUID, TEXT, JSONB, JSONB, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.environmental_admin_update_reading(
  UUID, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC
) TO authenticated;

-- ---------------------------------------------------------------------------
-- Seed initial assets + default windows (admin-editable limits)
-- ---------------------------------------------------------------------------

INSERT INTO public.environmental_assets (
  asset_code, asset_name, asset_type, location, serial_number,
  min_temperature, max_temperature, humidity_min, humidity_max,
  humidity_required, monitoring_frequency, active
) VALUES
  ('REF-01', 'Refrigerator 01', 'refrigerator', 'Hematology Section', 'REF-01', 2, 8, NULL, NULL, FALSE, 'daily', TRUE),
  ('REF-02', 'Refrigerator 02', 'refrigerator', 'Hematology Section', 'REF-02', 2, 8, NULL, NULL, FALSE, 'daily', TRUE),
  ('STORAGE-01', 'Storage', 'storage_room', 'Laboratory', 'STORAGE-01', 20, 24, 30, 60, TRUE, 'daily', TRUE),
  ('COLD-ROOM-01', 'Cold Room', 'cold_room', 'Laboratory', 'COLD-ROOM-01', 2, 8, NULL, NULL, FALSE, 'daily', TRUE),
  ('HEMA-ROOM-01', 'Hematology Section Room Temperature', 'room_temperature', 'Laboratory', 'HEMA-ROOM-01', 20, 24, 30, 60, TRUE, 'daily', TRUE)
ON CONFLICT (asset_code) DO UPDATE SET
  asset_name = EXCLUDED.asset_name,
  asset_type = EXCLUDED.asset_type,
  location = EXCLUDED.location,
  serial_number = EXCLUDED.serial_number,
  min_temperature = EXCLUDED.min_temperature,
  max_temperature = EXCLUDED.max_temperature,
  humidity_min = EXCLUDED.humidity_min,
  humidity_max = EXCLUDED.humidity_max,
  humidity_required = EXCLUDED.humidity_required,
  active = EXCLUDED.active,
  updated_at = NOW();

INSERT INTO public.environmental_monitoring_windows (asset_id, window_name, start_time, end_time, required, days_of_week, active)
SELECT a.id, w.window_name, w.start_time::TIME, w.end_time::TIME, TRUE, ARRAY[0,1,2,3,4,5,6], TRUE
FROM public.environmental_assets a
CROSS JOIN (VALUES
  ('AM Shift', '07:00', '15:00'),
  ('PM Shift', '15:00', '23:00'),
  ('Night Shift', '23:00', '07:00')
) AS w(window_name, start_time, end_time)
WHERE a.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.environmental_monitoring_windows emw
    WHERE emw.asset_id = a.id AND emw.window_name = w.window_name
  );

COMMIT;
