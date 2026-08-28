-- ============================================================================
-- Migration 045: Operational soft-delete audit fields, records.delete/restore,
-- RLS for deleted-record visibility and restore. Idempotent.
-- Does NOT auto-apply — run manually when ready.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (code, module, description) VALUES
  ('records.delete', 'records', 'Soft-delete operational records (system administration)'),
  ('records.restore', 'records', 'View and restore soft-deleted operational records')
ON CONFLICT (code) DO UPDATE SET
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN ('records.delete', 'records.restore')
WHERE r.name = 'system_admin'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Audit columns — operational tables
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'critical_values',
    'sample_rejections',
    'corrected_results',
    'pending_samples',
    'qc_records',
    'tat_records',
    'maintenance_records',
    'tasks',
    'inventory_items',
    'form_submissions'
  ]
  LOOP
    EXECUTE format('
      ALTER TABLE public.%I
        ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.profiles(id),
        ADD COLUMN IF NOT EXISTS deleted_by_name TEXT,
        ADD COLUMN IF NOT EXISTS deleted_by_staff_id TEXT,
        ADD COLUMN IF NOT EXISTS delete_reason TEXT,
        ADD COLUMN IF NOT EXISTS restored_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS restored_by UUID REFERENCES public.profiles(id),
        ADD COLUMN IF NOT EXISTS restored_by_name TEXT,
        ADD COLUMN IF NOT EXISTS restored_by_staff_id TEXT
    ', tbl);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_operational_soft_delete(p_table_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_permission('records.delete')
    OR (
      p_table_name = 'critical_values'
      AND public.has_permission('critical_values.manage')
    )
    OR (
      p_table_name = 'tasks'
      AND public.has_permission('tasks.manage')
    )
    OR (
      p_table_name = 'inventory_items'
      AND public.has_permission('inventory.manage')
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_deleted_operational_records()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_permission('records.restore');
$$;

CREATE OR REPLACE FUNCTION public.enforce_operational_soft_delete_restore()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF public.is_active_row(OLD.deleted_at) AND NOT public.is_active_row(NEW.deleted_at) THEN
    IF NOT public.can_operational_soft_delete(TG_TABLE_NAME) THEN
      RAISE EXCEPTION 'Soft delete not permitted for %', TG_TABLE_NAME
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NOT public.is_active_row(OLD.deleted_at) AND public.is_active_row(NEW.deleted_at) THEN
    IF NOT public.has_permission('records.restore') THEN
      RAISE EXCEPTION 'Restore not permitted for %', TG_TABLE_NAME
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.can_operational_soft_delete(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_deleted_operational_records() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_operational_soft_delete_restore() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.can_operational_soft_delete(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_deleted_operational_records() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_operational_soft_delete_restore() TO authenticated;

-- ---------------------------------------------------------------------------
-- Triggers — enforce soft-delete / restore authorization
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'critical_values',
    'sample_rejections',
    'corrected_results',
    'pending_samples',
    'qc_records',
    'tat_records',
    'maintenance_records',
    'tasks',
    'inventory_items',
    'form_submissions'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_soft_delete_restore ON public.%I', tbl, tbl);
    EXECUTE format('
      CREATE TRIGGER trg_%I_soft_delete_restore
        BEFORE UPDATE ON public.%I
        FOR EACH ROW
        EXECUTE FUNCTION public.enforce_operational_soft_delete_restore()
    ', tbl, tbl);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- RLS — allow records.restore to SELECT soft-deleted rows
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT *
    FROM (VALUES
      ('critical_values', 'critical_values.view'),
      ('sample_rejections', 'sample_rejections.view'),
      ('corrected_results', 'corrected_results.view'),
      ('pending_samples', 'pending_samples.view'),
      ('qc_records', 'qc.view'),
      ('tat_records', 'tat.view'),
      ('maintenance_records', 'maintenance.view'),
      ('tasks', 'tasks.view'),
      ('inventory_items', 'inventory.view'),
      ('form_submissions', 'forms.view')
    ) AS t(table_name, view_permission)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', rec.table_name || '_deleted_select', rec.table_name);
    EXECUTE format('
      CREATE POLICY %I ON public.%I
        FOR SELECT TO authenticated
        USING (
          deleted_at IS NOT NULL
          AND public.can_view_deleted_operational_records()
        )
    ', rec.table_name || '_deleted_select', rec.table_name);
  END LOOP;
END $$;

COMMIT;
