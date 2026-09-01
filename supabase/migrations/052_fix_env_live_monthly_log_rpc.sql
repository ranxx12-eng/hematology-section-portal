-- ============================================================================
-- Migration 052: Fix get_env_live_monthly_log invalid deleted_at references
-- Migration 050 referenced deleted_at on tables that do not have that column
-- per migration 048 schema. Does NOT auto-apply.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_env_live_monthly_log(
  p_asset_code TEXT,
  p_year INTEGER,
  p_month INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asset RECORD;
  v_days_in_month INTEGER;
  v_range_start TIMESTAMPTZ;
  v_range_end TIMESTAMPTZ;
  v_asset_json JSONB;
  v_windows_json JSONB;
  v_readings_json JSONB;
  v_corrections_json JSONB;
  v_excursions_json JSONB;
BEGIN
  IF p_year IS NULL OR p_month IS NULL OR p_month < 1 OR p_month > 12 THEN
    RETURN NULL;
  END IF;

  SELECT
    a.id,
    a.asset_code,
    a.asset_name,
    a.asset_type::TEXT,
    a.location,
    a.serial_number,
    a.min_temperature,
    a.max_temperature,
    a.humidity_min,
    a.humidity_max,
    a.humidity_required
  INTO v_asset
  FROM public.environmental_assets a
  WHERE upper(btrim(a.asset_code)) = upper(btrim(p_asset_code))
    AND a.deleted_at IS NULL
    AND a.active = TRUE
  LIMIT 1;

  IF v_asset.id IS NULL THEN
    RETURN NULL;
  END IF;

  v_days_in_month := EXTRACT(DAY FROM (make_date(p_year, p_month, 1) + INTERVAL '1 month - 1 day'))::INTEGER;
  -- Extended range captures Night Shift readings recorded just after midnight on the next calendar day.
  v_range_start := make_timestamptz(p_year, p_month, 1, 0, 0, 0) - INTERVAL '8 hours';
  v_range_end := make_timestamptz(p_year, p_month, v_days_in_month, 23, 59, 59.999) + INTERVAL '8 hours';

  v_asset_json := jsonb_build_object(
    'assetCode', v_asset.asset_code,
    'assetName', v_asset.asset_name,
    'assetType', v_asset.asset_type,
    'location', v_asset.location,
    'serialNumber', v_asset.serial_number,
    'minTemperature', v_asset.min_temperature,
    'maxTemperature', v_asset.max_temperature,
    'humidityMin', v_asset.humidity_min,
    'humidityMax', v_asset.humidity_max,
    'humidityRequired', v_asset.humidity_required
  );

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'windowName', w.window_name,
      'startTime', to_char(w.start_time, 'HH24:MI'),
      'endTime', to_char(w.end_time, 'HH24:MI'),
      'required', w.required,
      'daysOfWeek', w.days_of_week,
      'active', w.active
    ) ORDER BY w.start_time
  ), '[]'::JSONB)
  INTO v_windows_json
  FROM public.environmental_monitoring_windows w
  WHERE w.asset_id = v_asset.id
    AND w.active = TRUE;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'recordedAt', r.recorded_at,
      'temperature', r.temperature,
      'humidity', r.humidity,
      'calculatedStatus', r.calculated_status::TEXT,
      'performedByName', r.performed_by_name,
      'performedByStaffId', r.performed_by_staff_id,
      'outOfRangeParameters', r.out_of_range_parameters::TEXT,
      'rangeMinAtReading', r.range_min_at_reading,
      'rangeMaxAtReading', r.range_max_at_reading,
      'humidityMinAtReading', r.humidity_min_at_reading,
      'humidityMaxAtReading', r.humidity_max_at_reading,
      'comment', r.comment
    ) ORDER BY r.recorded_at DESC
  ), '[]'::JSONB)
  INTO v_readings_json
  FROM public.environmental_readings r
  WHERE r.asset_id = v_asset.id
    AND r.voided_at IS NULL
    AND r.recorded_at >= v_range_start
    AND r.recorded_at <= v_range_end;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'recordedAt', r.recorded_at,
      'previousTemperature', c.previous_temperature,
      'newTemperature', c.new_temperature,
      'previousHumidity', c.previous_humidity,
      'newHumidity', c.new_humidity
    )
  ), '[]'::JSONB)
  INTO v_corrections_json
  FROM public.environmental_reading_corrections c
  INNER JOIN public.environmental_readings r ON r.id = c.reading_id
  WHERE r.asset_id = v_asset.id
    AND r.voided_at IS NULL
    AND r.recorded_at >= v_range_start
    AND r.recorded_at <= v_range_end;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'detectedAt', e.detected_at,
      'recordedAt', r.recorded_at,
      'detectedTemperature', e.detected_temperature,
      'detectedHumidity', e.detected_humidity,
      'outOfRangeParameters', e.out_of_range_parameters::TEXT,
      'status', e.status::TEXT,
      'immediateAction', e.immediate_action,
      'recheckTemperature', e.recheck_temperature,
      'recheckHumidity', e.recheck_humidity,
      'recheckAt', e.recheck_at,
      'resolutionStatus', e.resolution_status,
      'rangeMinAtDetection', e.range_min_at_detection,
      'rangeMaxAtDetection', e.range_max_at_detection,
      'humidityMinAtDetection', e.humidity_min_at_detection,
      'humidityMaxAtDetection', e.humidity_max_at_detection
    ) ORDER BY e.detected_at DESC
  ), '[]'::JSONB)
  INTO v_excursions_json
  FROM public.environmental_excursions e
  INNER JOIN public.environmental_readings r ON r.id = e.reading_id
  WHERE e.asset_id = v_asset.id
    AND e.voided_at IS NULL
    AND e.detected_at >= v_range_start
    AND e.detected_at <= v_range_end;

  RETURN jsonb_build_object(
    'asset', v_asset_json,
    'windows', v_windows_json,
    'readings', v_readings_json,
    'corrections', v_corrections_json,
    'excursions', v_excursions_json,
    'year', p_year,
    'month', p_month
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_env_live_monthly_log(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_env_live_monthly_log(TEXT, INTEGER, INTEGER) TO anon, authenticated;

COMMIT;
