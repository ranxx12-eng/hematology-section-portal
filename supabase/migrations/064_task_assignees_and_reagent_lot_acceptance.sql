-- ============================================================================
-- Migration 064: Task multi-assignees + reagent lot-to-lot acceptance field
-- Does NOT auto-apply.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.task_assignees (
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (task_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assignees_employee
  ON public.task_assignees(employee_id);

ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_assignees_select ON public.task_assignees;
CREATE POLICY task_assignees_select ON public.task_assignees
  FOR SELECT TO authenticated
  USING (public.has_permission('tasks.view'));

DROP POLICY IF EXISTS task_assignees_manage ON public.task_assignees;
CREATE POLICY task_assignees_manage ON public.task_assignees
  FOR ALL TO authenticated
  USING (public.has_permission('tasks.manage'))
  WITH CHECK (public.has_permission('tasks.manage'));

-- Extend tasks visibility/update for any assignee on the junction table
DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.has_permission('tasks.manage')
      OR assigned_to = public.current_employee_id()
      OR assigned_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.task_assignees ta
        WHERE ta.task_id = tasks.id
          AND ta.employee_id = public.current_employee_id()
      )
    )
  );

DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('tasks.manage')
    OR assigned_to = public.current_employee_id()
    OR EXISTS (
      SELECT 1 FROM public.task_assignees ta
      WHERE ta.task_id = tasks.id
          AND ta.employee_id = public.current_employee_id()
    )
  )
  WITH CHECK (
    public.has_permission('tasks.manage')
    OR assigned_to = public.current_employee_id()
    OR EXISTS (
      SELECT 1 FROM public.task_assignees ta
      WHERE ta.task_id = tasks.id
          AND ta.employee_id = public.current_employee_id()
    )
  );

-- Backfill assignees from legacy assigned_to column
INSERT INTO public.task_assignees (task_id, employee_id)
SELECT id, assigned_to
FROM public.tasks
WHERE deleted_at IS NULL
  AND assigned_to IS NOT NULL
ON CONFLICT (task_id, employee_id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'inventory_reagent_lot_comparisons'
  ) THEN
    ALTER TABLE public.inventory_reagent_lot_comparisons
      ADD COLUMN IF NOT EXISTS acceptance_max_difference_percent NUMERIC(10, 4);
  END IF;
END $$;

COMMIT;
