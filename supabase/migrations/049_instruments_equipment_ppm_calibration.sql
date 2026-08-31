-- ============================================================================
-- Migration 049: Instruments & Equipment extension + PPM/Calibration records
-- Extends instruments table. Does NOT auto-apply.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'instrument_item_type') THEN
    CREATE TYPE public.instrument_item_type AS ENUM ('instrument', 'equipment');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'equipment_maintenance_record_type') THEN
    CREATE TYPE public.equipment_maintenance_record_type AS ENUM ('ppm', 'calibration');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'equipment_maintenance_result') THEN
    CREATE TYPE public.equipment_maintenance_result AS ENUM ('pass', 'fail', 'conditional');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (code, module, description) VALUES
  ('equipment.view', 'equipment', 'View instruments and equipment'),
  ('equipment.manage', 'equipment', 'Manage instruments and equipment'),
  ('ppm_calibration.view', 'ppm_calibration', 'View PPM and calibration records'),
  ('ppm_calibration.create', 'ppm_calibration', 'Create PPM and calibration records'),
  ('ppm_calibration.edit', 'ppm_calibration', 'Edit PPM and calibration records'),
  ('ppm_calibration.review', 'ppm_calibration', 'Review PPM and calibration records'),
  ('ppm_calibration.delete', 'ppm_calibration', 'Soft-delete PPM and calibration records'),
  ('ppm_calibration.restore', 'ppm_calibration', 'Restore soft-deleted PPM and calibration records')
ON CONFLICT (code) DO UPDATE SET
  module = EXCLUDED.module,
  description = EXCLUDED.description;

-- system_admin: all
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'equipment.view', 'equipment.manage',
  'ppm_calibration.view', 'ppm_calibration.create', 'ppm_calibration.edit',
  'ppm_calibration.review', 'ppm_calibration.delete', 'ppm_calibration.restore'
)
WHERE r.name = 'system_admin'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

-- quality_officer
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'equipment.view', 'equipment.manage',
  'ppm_calibration.view', 'ppm_calibration.create', 'ppm_calibration.edit', 'ppm_calibration.review'
)
WHERE r.name = 'quality_officer'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

-- section_supervisor
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'equipment.view', 'ppm_calibration.view', 'ppm_calibration.review'
)
WHERE r.name = 'section_supervisor'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

-- lab_manager
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'equipment.view', 'ppm_calibration.view', 'ppm_calibration.review'
)
WHERE r.name = 'lab_manager'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

-- senior_lab_technologist, lab_technologist
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN ('equipment.view', 'ppm_calibration.view')
WHERE r.name IN ('senior_lab_technologist', 'lab_technologist')
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

-- lab_director, head_of_section: view
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN ('equipment.view', 'ppm_calibration.view')
WHERE r.name IN ('lab_director', 'head_of_section')
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL WHERE public.role_permissions.deleted_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Extend instruments (single master table for instruments + equipment)
-- ---------------------------------------------------------------------------

ALTER TABLE public.instruments
  ADD COLUMN IF NOT EXISTS item_type public.instrument_item_type NOT NULL DEFAULT 'instrument',
  ADD COLUMN IF NOT EXISTS asset_code TEXT,
  ADD COLUMN IF NOT EXISTS section TEXT,
  ADD COLUMN IF NOT EXISTS ppm_frequency TEXT,
  ADD COLUMN IF NOT EXISTS calibration_frequency TEXT,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.instruments ALTER COLUMN manufacturer DROP NOT NULL;
ALTER TABLE public.instruments ALTER COLUMN model DROP NOT NULL;
ALTER TABLE public.instruments ALTER COLUMN serial_number DROP NOT NULL;
ALTER TABLE public.instruments ALTER COLUMN location DROP NOT NULL;
ALTER TABLE public.instruments ALTER COLUMN installation_date DROP NOT NULL;

ALTER TABLE public.instruments DROP CONSTRAINT IF EXISTS instruments_serial_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_instruments_serial_number_active
  ON public.instruments(serial_number)
  WHERE deleted_at IS NULL
    AND serial_number IS NOT NULL
    AND btrim(serial_number) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_instruments_asset_code_active
  ON public.instruments(asset_code)
  WHERE deleted_at IS NULL
    AND asset_code IS NOT NULL
    AND btrim(asset_code) <> '';

CREATE INDEX IF NOT EXISTS idx_instruments_item_type_active
  ON public.instruments(item_type)
  WHERE deleted_at IS NULL AND active = TRUE;

-- ---------------------------------------------------------------------------
-- PPM / Calibration records
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.equipment_maintenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_equipment_id UUID NOT NULL REFERENCES public.instruments(id) ON DELETE RESTRICT,
  record_type public.equipment_maintenance_record_type NOT NULL,
  performed_date DATE NOT NULL,
  next_due_date DATE,
  performed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  performed_by_name TEXT NOT NULL,
  performed_by_staff_id TEXT,
  service_provider TEXT,
  engineer_name TEXT,
  certificate_number TEXT,
  work_order_number TEXT,
  ticket_number TEXT,
  result public.equipment_maintenance_result NOT NULL DEFAULT 'pass',
  comment TEXT,
  attachment_path TEXT,
  attachment_name TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_by_name TEXT,
  reviewed_by_staff_id TEXT,
  reviewed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_by_name TEXT,
  deleted_by_staff_id TEXT,
  delete_reason TEXT,
  restored_at TIMESTAMPTZ,
  restored_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  restored_by_name TEXT,
  restored_by_staff_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_instrument_type
  ON public.equipment_maintenance_records(instrument_equipment_id, record_type, performed_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_next_due
  ON public.equipment_maintenance_records(next_due_date)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_equipment_maintenance_records_updated_at ON public.equipment_maintenance_records;
CREATE TRIGGER trg_equipment_maintenance_records_updated_at
  BEFORE UPDATE ON public.equipment_maintenance_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sync instrument summary dates from latest records
CREATE OR REPLACE FUNCTION public.sync_instrument_maintenance_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instrument_id UUID;
BEGIN
  v_instrument_id := COALESCE(NEW.instrument_equipment_id, OLD.instrument_equipment_id);

  IF NEW.record_type = 'ppm'::public.equipment_maintenance_record_type AND NEW.deleted_at IS NULL THEN
    UPDATE public.instruments
    SET
      last_maintenance = NEW.performed_date,
      next_maintenance = NEW.next_due_date,
      updated_at = NOW()
    WHERE id = v_instrument_id;
  ELSIF NEW.record_type = 'calibration'::public.equipment_maintenance_record_type AND NEW.deleted_at IS NULL THEN
    UPDATE public.instruments
    SET
      calibration_due_date = NEW.next_due_date,
      updated_at = NOW()
    WHERE id = v_instrument_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_equipment_maintenance_sync_instrument ON public.equipment_maintenance_records;
CREATE TRIGGER trg_equipment_maintenance_sync_instrument
  AFTER INSERT OR UPDATE ON public.equipment_maintenance_records
  FOR EACH ROW EXECUTE FUNCTION public.sync_instrument_maintenance_summary();

-- ---------------------------------------------------------------------------
-- Storage bucket (private)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ppm-calibration-files',
  'ppm-calibration-files',
  FALSE,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS storage_ppm_calibration_select ON storage.objects;
CREATE POLICY storage_ppm_calibration_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'ppm-calibration-files'
    AND public.has_permission('ppm_calibration.view')
    AND public.is_valid_storage_path(name)
  );

DROP POLICY IF EXISTS storage_ppm_calibration_insert ON storage.objects;
CREATE POLICY storage_ppm_calibration_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ppm-calibration-files'
    AND (public.has_permission('ppm_calibration.create') OR public.has_permission('ppm_calibration.edit'))
    AND public.storage_path_matches_module('ppm-calibration-files', name, 'ppm-calibration')
  );

DROP POLICY IF EXISTS storage_ppm_calibration_update ON storage.objects;
CREATE POLICY storage_ppm_calibration_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'ppm-calibration-files'
    AND (public.has_permission('ppm_calibration.create') OR public.has_permission('ppm_calibration.edit'))
  )
  WITH CHECK (
    bucket_id = 'ppm-calibration-files'
    AND (public.has_permission('ppm_calibration.create') OR public.has_permission('ppm_calibration.edit'))
    AND public.is_valid_storage_path(name)
  );

DROP POLICY IF EXISTS storage_ppm_calibration_delete ON storage.objects;
CREATE POLICY storage_ppm_calibration_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'ppm-calibration-files'
    AND public.has_permission('ppm_calibration.delete')
  );

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.equipment_maintenance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS equipment_maintenance_select ON public.equipment_maintenance_records;
CREATE POLICY equipment_maintenance_select ON public.equipment_maintenance_records
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.has_permission('ppm_calibration.view')
  );

DROP POLICY IF EXISTS equipment_maintenance_select_deleted ON public.equipment_maintenance_records;
CREATE POLICY equipment_maintenance_select_deleted ON public.equipment_maintenance_records
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NOT NULL
    AND (public.has_permission('ppm_calibration.restore') OR public.is_system_admin())
  );

DROP POLICY IF EXISTS equipment_maintenance_insert ON public.equipment_maintenance_records;
CREATE POLICY equipment_maintenance_insert ON public.equipment_maintenance_records
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('ppm_calibration.create') OR public.is_system_admin());

DROP POLICY IF EXISTS equipment_maintenance_update ON public.equipment_maintenance_records;
CREATE POLICY equipment_maintenance_update ON public.equipment_maintenance_records
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.has_permission('ppm_calibration.edit')
      OR public.has_permission('ppm_calibration.review')
      OR public.is_system_admin()
    )
  )
  WITH CHECK (
    public.has_permission('ppm_calibration.edit')
    OR public.has_permission('ppm_calibration.review')
    OR public.is_system_admin()
  );

COMMIT;
