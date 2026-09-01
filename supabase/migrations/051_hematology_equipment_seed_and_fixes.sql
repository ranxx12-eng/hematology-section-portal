-- ============================================================================
-- Migration 051: Equipment fields, calibration performer type, RLS fix, official seed
-- Does NOT modify 048, 049, or 050. Does NOT auto-apply.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Schema extensions
-- ---------------------------------------------------------------------------

ALTER TABLE public.instruments
  ADD COLUMN IF NOT EXISTS technical_specification TEXT,
  ADD COLUMN IF NOT EXISTS equipment_category TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'calibration_performed_by_type') THEN
    CREATE TYPE public.calibration_performed_by_type AS ENUM ('internal_staff', 'external_engineer');
  END IF;
END $$;

ALTER TABLE public.equipment_maintenance_records
  ADD COLUMN IF NOT EXISTS performed_by_type public.calibration_performed_by_type NOT NULL DEFAULT 'external_engineer';

-- ---------------------------------------------------------------------------
-- RLS: allow equipment.view / equipment.manage alongside instruments.*
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS instruments_select ON public.instruments;
CREATE POLICY instruments_select ON public.instruments
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.has_permission('instruments.view')
      OR public.has_permission('equipment.view')
    )
  );

DROP POLICY IF EXISTS instruments_manage ON public.instruments;
CREATE POLICY instruments_manage ON public.instruments
  FOR ALL TO authenticated
  USING (
    public.has_permission('instruments.manage')
    OR public.has_permission('equipment.manage')
  )
  WITH CHECK (
    public.has_permission('instruments.manage')
    OR public.has_permission('equipment.manage')
  );

-- ---------------------------------------------------------------------------
-- Helper: normalize instrument name for deduplication
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.normalize_instrument_name(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(btrim(coalesce(p_name, '')), '[^a-zA-Z0-9]+', '', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.find_instrument_for_official_seed(
  p_serial_number TEXT,
  p_asset_code TEXT,
  p_name TEXT,
  p_name_aliases TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_id UUID;
  v_normalized TEXT := public.normalize_instrument_name(p_name);
  v_alias TEXT;
BEGIN
  IF p_serial_number IS NOT NULL AND btrim(p_serial_number) <> '' THEN
    SELECT i.id INTO v_id
    FROM public.instruments i
    WHERE i.deleted_at IS NULL
      AND lower(btrim(i.serial_number)) = lower(btrim(p_serial_number))
    LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  IF p_asset_code IS NOT NULL AND btrim(p_asset_code) <> '' THEN
    SELECT i.id INTO v_id
    FROM public.instruments i
    WHERE i.deleted_at IS NULL
      AND lower(regexp_replace(btrim(i.asset_code), '\s+', ' ', 'g'))
        = lower(regexp_replace(btrim(p_asset_code), '\s+', ' ', 'g'))
    LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  SELECT i.id INTO v_id
  FROM public.instruments i
  WHERE i.deleted_at IS NULL
    AND public.normalize_instrument_name(i.name) = v_normalized
  LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  FOREACH v_alias IN ARRAY p_name_aliases LOOP
    SELECT i.id INTO v_id
    FROM public.instruments i
    WHERE i.deleted_at IS NULL
      AND public.normalize_instrument_name(i.name) = public.normalize_instrument_name(v_alias)
    LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- Official Hematology equipment seed (upsert — no duplicate inserts)
-- Preserves existing IDs, location, and provider when already set.
-- Does NOT invent PPM/calibration history.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_id UUID;
BEGIN
  -- 1. Refrigerator (Sample)
  v_id := public.find_instrument_for_official_seed('88353', 'HMG 64958', 'Refrigerator (Sample)');
  IF v_id IS NULL THEN
    INSERT INTO public.instruments (
      name, item_type, serial_number, asset_code, ppm_frequency, section, active, status
    ) VALUES (
      'Refrigerator (Sample)', 'equipment', '88353', 'HMG 64958', 'annual', 'Hematology', TRUE, 'operational'
    );
  ELSE
    UPDATE public.instruments SET
      name = 'Refrigerator (Sample)',
      item_type = 'equipment',
      serial_number = '88353',
      asset_code = 'HMG 64958',
      ppm_frequency = 'annual',
      section = COALESCE(section, 'Hematology'),
      equipment_category = COALESCE(equipment_category, 'refrigerator'),
      active = TRUE,
      updated_at = NOW()
    WHERE id = v_id;
  END IF;

  -- 2. Refrigerator (QC and Reagent)
  v_id := public.find_instrument_for_official_seed('88253', 'HMG 64903', 'Refrigerator (QC and Reagent)');
  IF v_id IS NULL THEN
    INSERT INTO public.instruments (
      name, item_type, serial_number, asset_code, ppm_frequency, section, active, status
    ) VALUES (
      'Refrigerator (QC and Reagent)', 'equipment', '88253', 'HMG 64903', 'annual', 'Hematology', TRUE, 'operational'
    );
  ELSE
    UPDATE public.instruments SET
      name = 'Refrigerator (QC and Reagent)',
      item_type = 'equipment',
      serial_number = '88253',
      asset_code = 'HMG 64903',
      ppm_frequency = 'annual',
      section = COALESCE(section, 'Hematology'),
      equipment_category = COALESCE(equipment_category, 'refrigerator'),
      active = TRUE,
      updated_at = NOW()
    WHERE id = v_id;
  END IF;

  -- 3. Centrifuge
  v_id := public.find_instrument_for_official_seed('721123071802', 'HMG 61959', 'Centrifuge');
  IF v_id IS NULL THEN
    INSERT INTO public.instruments (
      name, item_type, serial_number, asset_code, ppm_frequency, section, active, status
    ) VALUES (
      'Centrifuge', 'equipment', '721123071802', 'HMG 61959', 'annual', 'Hematology', TRUE, 'operational'
    );
  ELSE
    UPDATE public.instruments SET
      name = 'Centrifuge', item_type = 'equipment', serial_number = '721123071802',
      asset_code = 'HMG 61959', ppm_frequency = 'annual',
      section = COALESCE(section, 'Hematology'),
      equipment_category = COALESCE(equipment_category, 'centrifuge'),
      active = TRUE, updated_at = NOW()
    WHERE id = v_id;
  END IF;

  -- 4. Microscope
  v_id := public.find_instrument_for_official_seed('091175', 'HMG 61969', 'Microscope');
  IF v_id IS NULL THEN
    INSERT INTO public.instruments (
      name, item_type, serial_number, asset_code, ppm_frequency, section, active, status
    ) VALUES (
      'Microscope', 'equipment', '091175', 'HMG 61969', 'annual', 'Hematology', TRUE, 'operational'
    );
  ELSE
    UPDATE public.instruments SET
      name = 'Microscope', item_type = 'equipment', serial_number = '091175',
      asset_code = 'HMG 61969', ppm_frequency = 'annual',
      section = COALESCE(section, 'Hematology'),
      equipment_category = COALESCE(equipment_category, 'microscope'),
      active = TRUE, updated_at = NOW()
    WHERE id = v_id;
  END IF;

  -- 5. Cytospin
  v_id := public.find_instrument_for_official_seed('3222409', 'HMG 94744', 'Cytospin');
  IF v_id IS NULL THEN
    INSERT INTO public.instruments (
      name, item_type, serial_number, asset_code, ppm_frequency, section, active, status
    ) VALUES (
      'Cytospin', 'equipment', '3222409', 'HMG 94744', 'annual', 'Hematology', TRUE, 'operational'
    );
  ELSE
    UPDATE public.instruments SET
      name = 'Cytospin', item_type = 'equipment', serial_number = '3222409',
      asset_code = 'HMG 94744', ppm_frequency = 'annual',
      section = COALESCE(section, 'Hematology'),
      equipment_category = COALESCE(equipment_category, 'other'),
      active = TRUE, updated_at = NOW()
    WHERE id = v_id;
  END IF;

  -- 6. Alifax (may match legacy "Alifax Test1")
  v_id := public.find_instrument_for_official_seed('12749', 'HMG71777', 'Alifax', ARRAY['Alifax Test1']);
  IF v_id IS NULL THEN
    INSERT INTO public.instruments (
      name, item_type, serial_number, asset_code, ppm_frequency, section, active, status
    ) VALUES (
      'Alifax', 'instrument', '12749', 'HMG71777', 'semi_annual', 'Hematology', TRUE, 'operational'
    );
  ELSE
    UPDATE public.instruments SET
      name = 'Alifax', item_type = 'instrument', serial_number = '12749',
      asset_code = 'HMG71777', ppm_frequency = 'semi_annual',
      section = COALESCE(section, 'Hematology'),
      active = TRUE, updated_at = NOW()
    WHERE id = v_id;
  END IF;

  -- 7. Mindray
  v_id := public.find_instrument_for_official_seed('11726', 'HMG-D-92283', 'Mindray');
  IF v_id IS NULL THEN
    INSERT INTO public.instruments (
      name, item_type, serial_number, asset_code, ppm_frequency, section, active, status
    ) VALUES (
      'Mindray', 'instrument', '11726', 'HMG-D-92283', 'semi_annual', 'Hematology', TRUE, 'operational'
    );
  ELSE
    UPDATE public.instruments SET
      name = 'Mindray', item_type = 'instrument', serial_number = '11726',
      asset_code = 'HMG-D-92283', ppm_frequency = 'semi_annual',
      section = COALESCE(section, 'Hematology'),
      active = TRUE, updated_at = NOW()
    WHERE id = v_id;
  END IF;

  -- 8. Stago STA-R MAX3 (may match legacy serial STAR-MAX3-001)
  v_id := public.find_instrument_for_official_seed('N5562', 'HMG87227', 'Stago STA-R MAX3', ARRAY['Stago STA R MAX3']);
  IF v_id IS NULL THEN
    INSERT INTO public.instruments (
      name, item_type, serial_number, asset_code, ppm_frequency, section, active, status
    ) VALUES (
      'Stago STA-R MAX3', 'instrument', 'N5562', 'HMG87227', 'semi_annual', 'Hematology', TRUE, 'operational'
    );
  ELSE
    UPDATE public.instruments SET
      name = 'Stago STA-R MAX3', item_type = 'instrument', serial_number = 'N5562',
      asset_code = 'HMG87227', ppm_frequency = 'semi_annual',
      section = COALESCE(section, 'Hematology'),
      active = TRUE, updated_at = NOW()
    WHERE id = v_id;
  END IF;

  -- 9. Alinity HQ1147 (may match legacy "Alinity HQ 1147")
  v_id := public.find_instrument_for_official_seed('HQ01147', 'HMG80607', 'Alinity HQ1147', ARRAY['Alinity HQ 1147']);
  IF v_id IS NULL THEN
    INSERT INTO public.instruments (
      name, item_type, serial_number, asset_code, ppm_frequency, section, active, status
    ) VALUES (
      'Alinity HQ1147', 'instrument', 'HQ01147', 'HMG80607', 'semi_annual', 'Hematology', TRUE, 'operational'
    );
  ELSE
    UPDATE public.instruments SET
      name = 'Alinity HQ1147', item_type = 'instrument', serial_number = 'HQ01147',
      asset_code = 'HMG80607', ppm_frequency = 'semi_annual',
      section = COALESCE(section, 'Hematology'),
      active = TRUE, updated_at = NOW()
    WHERE id = v_id;
  END IF;

  -- 10. Alinity HQ1149 (may match legacy "Alinity HQ 1149")
  v_id := public.find_instrument_for_official_seed('HQ01149', 'HMG80608', 'Alinity HQ1149', ARRAY['Alinity HQ 1149']);
  IF v_id IS NULL THEN
    INSERT INTO public.instruments (
      name, item_type, serial_number, asset_code, ppm_frequency, section, active, status
    ) VALUES (
      'Alinity HQ1149', 'instrument', 'HQ01149', 'HMG80608', 'semi_annual', 'Hematology', TRUE, 'operational'
    );
  ELSE
    UPDATE public.instruments SET
      name = 'Alinity HQ1149', item_type = 'instrument', serial_number = 'HQ01149',
      asset_code = 'HMG80608', ppm_frequency = 'semi_annual',
      section = COALESCE(section, 'Hematology'),
      active = TRUE, updated_at = NOW()
    WHERE id = v_id;
  END IF;

  -- 11. Alinity HS — no asset code
  v_id := public.find_instrument_for_official_seed('HS322', NULL, 'Alinity HS');
  IF v_id IS NULL THEN
    INSERT INTO public.instruments (
      name, item_type, serial_number, asset_code, ppm_frequency, section, active, status
    ) VALUES (
      'Alinity HS', 'instrument', 'HS322', NULL, 'semi_annual', 'Hematology', TRUE, 'operational'
    );
  ELSE
    UPDATE public.instruments SET
      name = 'Alinity HS', item_type = 'instrument', serial_number = 'HS322',
      asset_code = NULL, ppm_frequency = 'semi_annual',
      section = COALESCE(section, 'Hematology'),
      active = TRUE, updated_at = NOW()
    WHERE id = v_id;
  END IF;

  -- Pipette 1
  v_id := public.find_instrument_for_official_seed('K16029M', NULL, 'Pipette 10 µL');
  IF v_id IS NULL THEN
    INSERT INTO public.instruments (
      name, item_type, serial_number, section, equipment_category, technical_specification, active, status
    ) VALUES (
      'Pipette 10 µL', 'equipment', 'K16029M', 'Hematology', 'pipette', '10 µL', TRUE, 'operational'
    );
  ELSE
    UPDATE public.instruments SET
      name = 'Pipette 10 µL', item_type = 'equipment', serial_number = 'K16029M',
      section = COALESCE(section, 'Hematology'),
      equipment_category = 'pipette', technical_specification = '10 µL',
      active = TRUE, updated_at = NOW()
    WHERE id = v_id;
  END IF;

  -- Pipette 2
  v_id := public.find_instrument_for_official_seed('J59620M', NULL, 'Pipette 100 µL');
  IF v_id IS NULL THEN
    INSERT INTO public.instruments (
      name, item_type, serial_number, section, equipment_category, technical_specification, active, status
    ) VALUES (
      'Pipette 100 µL', 'equipment', 'J59620M', 'Hematology', 'pipette', '100 µL', TRUE, 'operational'
    );
  ELSE
    UPDATE public.instruments SET
      name = 'Pipette 100 µL', item_type = 'equipment', serial_number = 'J59620M',
      section = COALESCE(section, 'Hematology'),
      equipment_category = 'pipette', technical_specification = '100 µL',
      active = TRUE, updated_at = NOW()
    WHERE id = v_id;
  END IF;

  -- Pipette 3
  v_id := public.find_instrument_for_official_seed('J45605M', NULL, 'Pipette 1000 µL');
  IF v_id IS NULL THEN
    INSERT INTO public.instruments (
      name, item_type, serial_number, section, equipment_category, technical_specification, active, status
    ) VALUES (
      'Pipette 1000 µL', 'equipment', 'J45605M', 'Hematology', 'pipette', '1000 µL', TRUE, 'operational'
    );
  ELSE
    UPDATE public.instruments SET
      name = 'Pipette 1000 µL', item_type = 'equipment', serial_number = 'J45605M',
      section = COALESCE(section, 'Hematology'),
      equipment_category = 'pipette', technical_specification = '1000 µL',
      active = TRUE, updated_at = NOW()
    WHERE id = v_id;
  END IF;

  -- Normalize legacy frequency spellings
  UPDATE public.instruments
  SET ppm_frequency = 'annual', updated_at = NOW()
  WHERE deleted_at IS NULL
    AND lower(btrim(ppm_frequency)) IN ('annually', 'annualy', 'yearly', '12_months', '12 months');

  UPDATE public.instruments
  SET ppm_frequency = 'semi_annual', updated_at = NOW()
  WHERE deleted_at IS NULL
    AND lower(btrim(ppm_frequency)) IN ('semi-annual', 'semiannual', 'semi annual', '6_months', '6 months');

  UPDATE public.instruments
  SET calibration_frequency = 'annual', updated_at = NOW()
  WHERE deleted_at IS NULL
    AND lower(btrim(calibration_frequency)) IN ('annually', 'annualy', 'yearly');

  UPDATE public.instruments
  SET calibration_frequency = 'semi_annual', updated_at = NOW()
  WHERE deleted_at IS NULL
    AND lower(btrim(calibration_frequency)) IN ('semi-annual', 'semiannual', 'semi annual');
END $$;

COMMIT;
