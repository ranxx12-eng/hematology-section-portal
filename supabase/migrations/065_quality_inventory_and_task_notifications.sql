-- ============================================================================
-- Migration 065: Quality inventory access, task assignment notifications,
-- optional QC lot traceability on qc_records.
-- Additive only — does not modify migrations 062–064.
-- ============================================================================

BEGIN;

-- Full Inventory module access for Quality Officer and legacy Quality Link role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN ('inventory.view', 'inventory.manage')
WHERE r.name IN ('quality_officer', 'quality_link')
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;

-- Trace selected inventory lot on Malaria QC records (nullable; no backfill required)
ALTER TABLE public.qc_records
  ADD COLUMN IF NOT EXISTS inventory_lot_usage_id UUID
    REFERENCES public.inventory_lot_usage(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_qc_records_inventory_lot_usage
  ON public.qc_records(inventory_lot_usage_id)
  WHERE inventory_lot_usage_id IS NOT NULL;

-- Notify newly assigned employees (called from app after task_assignees sync)
CREATE OR REPLACE FUNCTION public.notify_task_assignees(
  p_task_id UUID,
  p_task_title TEXT,
  p_employee_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  IF NOT (
    public.has_permission('tasks.manage')
    OR public.has_permission('tasks.approve')
  ) THEN
    RAISE EXCEPTION 'Not authorized to notify task assignees';
  END IF;

  IF p_employee_ids IS NULL OR cardinality(p_employee_ids) = 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.notifications (user_id, notification_type, title, message, link, is_read)
  SELECT
    p.id,
    'task_assigned',
    'New task assigned',
    'A new task has been assigned to you: ' || COALESCE(NULLIF(trim(p_task_title), ''), 'Task'),
    '/tasks?task=' || p_task_id::text,
    FALSE
  FROM public.profiles p
  WHERE p.employee_id = ANY(p_employee_ids)
    AND p.deleted_at IS NULL
    AND p.is_active = TRUE;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_task_assignees(UUID, TEXT, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_task_assignees(UUID, TEXT, UUID[]) TO authenticated;

COMMIT;
