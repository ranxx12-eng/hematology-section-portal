-- ============================================================================
-- Migration 032: Maintenance operational access (perform + performer FK fix)
-- Enables lab technologists to log routine maintenance without full manage.
-- Repoints performed_by to profiles (no employee records exist in production).
-- Idempotent. Never hard-deletes role_permissions.
-- ============================================================================

BEGIN;

INSERT INTO public.permissions (code, module, description) VALUES
  ('maintenance.perform', 'maintenance', 'Log routine daily/weekly/monthly maintenance records')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'maintenance.perform'
WHERE r.name = 'lab_technologist'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;

-- performed_by references profiles so authenticated users can log without employee rows
ALTER TABLE public.maintenance_records
  DROP CONSTRAINT IF EXISTS maintenance_records_performed_by_fkey;

ALTER TABLE public.maintenance_records
  ADD CONSTRAINT maintenance_records_performed_by_fkey
  FOREIGN KEY (performed_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

DROP POLICY IF EXISTS maintenance_records_select ON public.maintenance_records;
DROP POLICY IF EXISTS maintenance_records_manage ON public.maintenance_records;

CREATE POLICY maintenance_records_select ON public.maintenance_records
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('maintenance.view'));

CREATE POLICY maintenance_records_insert ON public.maintenance_records
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('maintenance.manage')
    OR public.has_permission('maintenance.perform')
  );

CREATE POLICY maintenance_records_update ON public.maintenance_records
  FOR UPDATE TO authenticated
  USING (public.has_permission('maintenance.manage') AND deleted_at IS NULL)
  WITH CHECK (public.has_permission('maintenance.manage'));

COMMIT;
