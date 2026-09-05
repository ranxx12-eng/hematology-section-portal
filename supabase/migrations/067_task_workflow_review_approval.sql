-- ============================================================================
-- Migration 067: Task workflow, review/approval, assignee picker RLS, audit history
-- Depends on 066 (pending_approval enum value).
-- Additive only — does not modify migrations 001–066.
-- ============================================================================

BEGIN;

-- Permission for review-center access (Senior, Quality, admins)
INSERT INTO public.permissions (code, module, description)
VALUES ('tasks.review', 'tasks', 'Review submitted tasks')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'tasks.view',
  'tasks.manage',
  'tasks.review'
)
WHERE r.name IN ('quality_officer', 'quality_link', 'senior_lab_technologist')
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN ('tasks.review', 'tasks.approve')
WHERE r.name = 'system_admin'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;

-- Task approval is limited to Section Supervisor (+ system_admin above).
-- Revoke tasks.approve from roles that must not use Approval Center.
UPDATE public.role_permissions rp
SET deleted_at = NOW()
FROM public.roles r, public.permissions perm
WHERE rp.role_id = r.id
  AND rp.permission_id = perm.id
  AND perm.code = 'tasks.approve'
  AND r.name IN ('head_of_section', 'team_leader')
  AND rp.deleted_at IS NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'tasks.approve'
WHERE r.name = 'section_supervisor'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;

-- Role-scoped workflow authorization helpers
CREATE OR REPLACE FUNCTION public.can_review_tasks()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_system_admin()
    OR (
      public.has_permission('tasks.review')
      AND public.has_role(ARRAY[
        'senior_lab_technologist'::public.app_role,
        'quality_officer'::public.app_role,
        'quality_link'::public.app_role
      ])
    );
$$;

CREATE OR REPLACE FUNCTION public.can_approve_tasks()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_system_admin()
    OR (
      public.has_permission('tasks.approve')
      AND public.has_role(ARRAY['section_supervisor'::public.app_role])
    );
$$;

REVOKE ALL ON FUNCTION public.can_review_tasks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_review_tasks() TO authenticated;
REVOKE ALL ON FUNCTION public.can_approve_tasks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_approve_tasks() TO authenticated;

-- Notify only Review Center roles
CREATE OR REPLACE FUNCTION public.notify_task_reviewers(
  p_notification_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_link TEXT,
  p_exclude_user_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  INSERT INTO public.notifications (user_id, notification_type, title, message, link, is_read)
  SELECT DISTINCT p.id, p_notification_type, p_title, p_message, p_link, FALSE
  FROM public.profiles p
  JOIN public.roles r ON r.id = p.primary_role_id
  WHERE p.deleted_at IS NULL
    AND p.is_active = TRUE
    AND (p_exclude_user_id IS NULL OR p.id <> p_exclude_user_id)
    AND r.name IN (
      'senior_lab_technologist',
      'quality_officer',
      'quality_link',
      'system_admin'
    );

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

-- Notify only Approval Center roles (Section Supervisor + System Admin)
CREATE OR REPLACE FUNCTION public.notify_task_approvers(
  p_notification_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_link TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  INSERT INTO public.notifications (user_id, notification_type, title, message, link, is_read)
  SELECT DISTINCT p.id, p_notification_type, p_title, p_message, p_link, FALSE
  FROM public.profiles p
  JOIN public.roles r ON r.id = p.primary_role_id
  WHERE p.deleted_at IS NULL
    AND p.is_active = TRUE
    AND r.name IN ('section_supervisor', 'system_admin');

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_task_reviewers(TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_task_reviewers(TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.notify_task_approvers(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_task_approvers(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Allow task managers/reviewers/approvers to read active employees for assignment pickers
DROP POLICY IF EXISTS employees_select ON public.employees;
CREATE POLICY employees_select ON public.employees
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.has_permission('employees.view')
      OR public.has_permission('tasks.manage')
      OR public.has_permission('tasks.review')
      OR public.has_permission('tasks.approve')
      OR id = public.current_employee_id()
    )
  );

-- Immutable workflow audit trail
CREATE TABLE IF NOT EXISTS public.task_workflow_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  previous_status public.task_status,
  new_status public.task_status NOT NULL,
  action TEXT NOT NULL,
  performed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  performer_role TEXT,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_workflow_history_task
  ON public.task_workflow_history(task_id, created_at DESC);

ALTER TABLE public.task_workflow_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_workflow_history_select ON public.task_workflow_history;
CREATE POLICY task_workflow_history_select ON public.task_workflow_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_workflow_history.task_id
        AND t.deleted_at IS NULL
    )
  );

-- Reviewers and approvers must see tasks in their queue
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
      OR (status = 'pending_review' AND public.can_review_tasks())
      OR (status = 'pending_approval' AND public.can_approve_tasks())
    )
  );

-- Prevent direct client status bypass (workflow RPC sets bypass flag)
CREATE OR REPLACE FUNCTION public.enforce_task_status_workflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF current_setting('app.task_workflow_bypass', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Task status changes must use workflow actions';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_task_status_workflow ON public.tasks;
CREATE TRIGGER trg_enforce_task_status_workflow
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_task_status_workflow();

-- Helper: is current user an assignee on task
CREATE OR REPLACE FUNCTION public.is_task_assignee(p_task_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.task_assignees ta
    WHERE ta.task_id = p_task_id
      AND ta.employee_id = public.current_employee_id()
  )
  OR EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = p_task_id
      AND t.assigned_to = public.current_employee_id()
  );
$$;

REVOKE ALL ON FUNCTION public.is_task_assignee(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_task_assignee(UUID) TO authenticated;

-- Record workflow history row (internal)
CREATE OR REPLACE FUNCTION public._append_task_workflow_history(
  p_task_id UUID,
  p_previous_status public.task_status,
  p_new_status public.task_status,
  p_action TEXT,
  p_comment TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT r.name::text INTO v_role
  FROM public.profiles p
  JOIN public.roles r ON r.id = p.primary_role_id
  WHERE p.id = auth.uid();

  INSERT INTO public.task_workflow_history (
    task_id, previous_status, new_status, action, performed_by, performer_role, comment
  ) VALUES (
    p_task_id, p_previous_status, p_new_status, p_action, auth.uid(), v_role, p_comment
  );
END;
$$;

-- Notify specific employee profile(s)
CREATE OR REPLACE FUNCTION public.notify_employees(
  p_employee_ids UUID[],
  p_notification_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_link TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  IF p_employee_ids IS NULL OR cardinality(p_employee_ids) = 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.notifications (user_id, notification_type, title, message, link, is_read)
  SELECT p.id, p_notification_type, p_title, p_message, p_link, FALSE
  FROM public.profiles p
  WHERE p.employee_id = ANY(p_employee_ids)
    AND p.deleted_at IS NULL
    AND p.is_active = TRUE;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

-- Main workflow transition RPC
CREATE OR REPLACE FUNCTION public.perform_task_workflow_action(
  p_task_id UUID,
  p_action TEXT,
  p_comment TEXT DEFAULT NULL
)
RETURNS public.tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task public.tasks;
  v_previous_status public.task_status;
  v_new_status public.task_status;
  v_new_approval public.approval_status;
  v_link TEXT;
  v_assignee_ids UUID[];
  v_is_assignee BOOLEAN;
  v_is_self_review BOOLEAN;
BEGIN
  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  v_previous_status := v_task.status;
  v_link := '/tasks?task=' || p_task_id::text;
  v_is_assignee := public.is_task_assignee(p_task_id);

  SELECT COALESCE(array_agg(ta.employee_id), ARRAY[]::UUID[]) INTO v_assignee_ids
  FROM public.task_assignees ta WHERE ta.task_id = p_task_id;

  IF cardinality(v_assignee_ids) = 0 AND v_task.assigned_to IS NOT NULL THEN
    v_assignee_ids := ARRAY[v_task.assigned_to];
  END IF;

  v_is_self_review := public.current_employee_id() = ANY(v_assignee_ids);

  v_new_status := v_task.status;
  v_new_approval := v_task.approval_status;

  CASE p_action
    WHEN 'start' THEN
      IF NOT v_is_assignee AND NOT public.has_permission('tasks.manage') THEN
        RAISE EXCEPTION 'Not authorized';
      END IF;
      IF v_task.status NOT IN ('not_started') THEN
        RAISE EXCEPTION 'Invalid transition from %', v_task.status;
      END IF;
      v_new_status := 'in_progress';

    WHEN 'submit_review' THEN
      IF NOT v_is_assignee AND NOT public.has_permission('tasks.manage') THEN
        RAISE EXCEPTION 'Not authorized';
      END IF;
      IF v_task.status NOT IN ('in_progress') THEN
        RAISE EXCEPTION 'Invalid transition from %', v_task.status;
      END IF;
      v_new_status := 'pending_review';

    WHEN 'forward_approval' THEN
      IF NOT public.can_review_tasks() THEN
        RAISE EXCEPTION 'Not authorized to review';
      END IF;
      IF v_is_self_review THEN
        RAISE EXCEPTION 'You cannot review your own task submission';
      END IF;
      IF v_task.status <> 'pending_review' THEN
        RAISE EXCEPTION 'Invalid transition from %', v_task.status;
      END IF;
      IF p_comment IS NULL OR length(trim(p_comment)) = 0 THEN
        p_comment := NULL;
      END IF;
      v_new_status := 'pending_approval';
      v_new_approval := 'pending';

    WHEN 'request_changes_review' THEN
      IF NOT public.can_review_tasks() THEN
        RAISE EXCEPTION 'Not authorized to review';
      END IF;
      IF v_is_self_review THEN
        RAISE EXCEPTION 'You cannot review your own task submission';
      END IF;
      IF v_task.status <> 'pending_review' THEN
        RAISE EXCEPTION 'Invalid transition from %', v_task.status;
      END IF;
      IF p_comment IS NULL OR length(trim(p_comment)) = 0 THEN
        RAISE EXCEPTION 'Comment is required when requesting changes';
      END IF;
      v_new_status := 'in_progress';
      v_new_approval := 'pending';

    WHEN 'approve' THEN
      IF NOT public.can_approve_tasks() THEN
        RAISE EXCEPTION 'Not authorized to approve';
      END IF;
      IF v_task.status <> 'pending_approval' THEN
        RAISE EXCEPTION 'Invalid transition from %', v_task.status;
      END IF;
      v_new_status := 'completed';
      v_new_approval := 'approved';

    WHEN 'request_changes_approval' THEN
      IF NOT public.can_approve_tasks() THEN
        RAISE EXCEPTION 'Not authorized to approve';
      END IF;
      IF v_task.status <> 'pending_approval' THEN
        RAISE EXCEPTION 'Invalid transition from %', v_task.status;
      END IF;
      IF p_comment IS NULL OR length(trim(p_comment)) = 0 THEN
        RAISE EXCEPTION 'Comment is required when requesting changes';
      END IF;
      v_new_status := 'in_progress';
      v_new_approval := 'pending';

    WHEN 'reject' THEN
      IF NOT public.can_approve_tasks() THEN
        RAISE EXCEPTION 'Not authorized to reject';
      END IF;
      IF v_task.status <> 'pending_approval' THEN
        RAISE EXCEPTION 'Invalid transition from %', v_task.status;
      END IF;
      IF p_comment IS NULL OR length(trim(p_comment)) = 0 THEN
        RAISE EXCEPTION 'Rejection reason is required';
      END IF;
      v_new_status := 'in_progress';
      v_new_approval := 'rejected';

    ELSE
      RAISE EXCEPTION 'Unknown workflow action: %', p_action;
  END CASE;

  PERFORM set_config('app.task_workflow_bypass', 'true', true);

  UPDATE public.tasks
  SET
    status = v_new_status,
    approval_status = v_new_approval,
    completed_at = CASE WHEN v_new_status = 'completed' THEN NOW() ELSE completed_at END,
    updated_at = NOW()
  WHERE id = p_task_id
  RETURNING * INTO v_task;

  PERFORM public._append_task_workflow_history(
    p_task_id, v_previous_status, v_new_status, p_action, p_comment
  );

  CASE p_action
    WHEN 'submit_review' THEN
      PERFORM public.notify_task_reviewers(
        'task_review',
        'Task awaiting review',
        'A task is waiting for review: ' || v_task.title,
        v_link,
        auth.uid()
      );
    WHEN 'forward_approval' THEN
      PERFORM public.notify_task_approvers(
        'task_approval',
        'Task awaiting approval',
        'A task is waiting for approval: ' || v_task.title,
        v_link
      );
    WHEN 'request_changes_review', 'request_changes_approval', 'reject' THEN
      PERFORM public.notify_employees(
        v_assignee_ids,
        'task_changes',
        CASE p_action WHEN 'reject' THEN 'Task rejected' ELSE 'Changes requested' END,
        CASE p_action
          WHEN 'reject' THEN 'Your task was rejected: ' || v_task.title
          ELSE 'Changes were requested for your task: ' || v_task.title
        END,
        v_link
      );
    WHEN 'approve' THEN
      PERFORM public.notify_employees(
        v_assignee_ids,
        'task_approved',
        'Task approved',
        'Your task has been approved: ' || v_task.title,
        v_link
      );
    ELSE
      NULL;
  END CASE;

  RETURN v_task;
END;
$$;

REVOKE ALL ON FUNCTION public.perform_task_workflow_action(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.perform_task_workflow_action(UUID, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.notify_employees(UUID[], TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_employees(UUID[], TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Lifecycle events (create, assign) — not status transitions
CREATE OR REPLACE FUNCTION public.record_task_lifecycle_event(
  p_task_id UUID,
  p_action TEXT,
  p_comment TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task public.tasks;
  v_status public.task_status;
BEGIN
  IF NOT (
    public.has_permission('tasks.manage')
    OR public.can_approve_tasks()
    OR public.is_task_assignee(p_task_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized to record task lifecycle event';
  END IF;

  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  v_status := v_task.status;

  INSERT INTO public.task_workflow_history (
    task_id, previous_status, new_status, action, performed_by, performer_role, comment
  )
  SELECT
    p_task_id,
    v_status,
    v_status,
    p_action,
    auth.uid(),
    r.name::text,
    p_comment
  FROM public.profiles p
  JOIN public.roles r ON r.id = p.primary_role_id
  WHERE p.id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.record_task_lifecycle_event(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_task_lifecycle_event(UUID, TEXT, TEXT) TO authenticated;

COMMIT;
