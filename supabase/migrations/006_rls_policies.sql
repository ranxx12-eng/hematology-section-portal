-- ============================================================================
-- Hematology Section Portal
-- Migration 006: Row Level Security Policies
-- Production-safe. No seed data.
-- ============================================================================

-- ENABLE RLS ON ALL SENSITIVE TABLES
-- ============================================================================

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fte_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.critical_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sample_rejections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corrected_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tat_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capa_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ROLES, PERMISSIONS & USER ROLES
-- ============================================================================

CREATE POLICY roles_select ON public.roles
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY roles_manage ON public.roles
  FOR ALL TO authenticated
  USING (public.has_permission('roles.manage'))
  WITH CHECK (public.has_permission('roles.manage'));

CREATE POLICY permissions_select ON public.permissions
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY permissions_manage ON public.permissions
  FOR ALL TO authenticated
  USING (public.has_permission('roles.manage'))
  WITH CHECK (public.has_permission('roles.manage'));

CREATE POLICY role_permissions_select ON public.role_permissions
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY role_permissions_manage ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.has_permission('roles.manage'))
  WITH CHECK (public.has_permission('roles.manage'));

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.has_permission('users.manage')
    OR public.has_permission('employees.view')
  );

CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() AND deleted_at IS NULL AND is_active = TRUE)
  WITH CHECK (id = auth.uid() AND is_active = TRUE);

CREATE POLICY profiles_manage ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_permission('users.manage'))
  WITH CHECK (public.has_permission('users.manage'));

CREATE POLICY user_roles_select ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_permission('users.manage')
    OR public.has_permission('roles.manage')
  );

CREATE POLICY user_roles_manage ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_permission('roles.manage') OR public.has_permission('users.manage'))
  WITH CHECK (public.has_permission('roles.manage') OR public.has_permission('users.manage'));

-- ============================================================================
-- EMPLOYEES & HR
-- ============================================================================

CREATE POLICY employees_select ON public.employees
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.has_permission('employees.view')
      OR id = public.current_employee_id()
    )
  );

CREATE POLICY employees_insert ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('employees.manage'));

CREATE POLICY employees_update ON public.employees
  FOR UPDATE TO authenticated
  USING (public.has_permission('employees.manage') AND deleted_at IS NULL)
  WITH CHECK (public.has_permission('employees.manage'));

CREATE POLICY employees_delete ON public.employees
  FOR DELETE TO authenticated
  USING (public.has_permission('employees.manage'));

CREATE POLICY fte_records_select ON public.fte_records
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.can_view_evaluations()
      OR employee_id = public.current_employee_id()
    )
  );

CREATE POLICY fte_records_manage ON public.fte_records
  FOR ALL TO authenticated
  USING (public.has_permission('employees.manage') OR public.has_permission('kpi.manage'))
  WITH CHECK (public.has_permission('employees.manage') OR public.has_permission('kpi.manage'));

CREATE POLICY employee_evaluations_select ON public.employee_evaluations
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.can_view_evaluations()
      OR employee_id = public.current_employee_id()
    )
  );

CREATE POLICY employee_evaluations_manage ON public.employee_evaluations
  FOR ALL TO authenticated
  USING (public.has_permission('employees.evaluate'))
  WITH CHECK (public.has_permission('employees.evaluate'));

-- ============================================================================
-- TASKS
-- ============================================================================

CREATE POLICY tasks_select ON public.tasks
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.has_permission('tasks.view')
      AND (
        public.has_permission('tasks.manage')
        OR assigned_to = public.current_employee_id()
        OR assigned_by = auth.uid()
      )
    )
  );

CREATE POLICY tasks_insert ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('tasks.manage'));

CREATE POLICY tasks_update ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.has_permission('tasks.manage')
      OR (
        public.has_permission('tasks.view')
        AND assigned_to = public.current_employee_id()
      )
    )
  )
  WITH CHECK (
    public.has_permission('tasks.manage')
    OR assigned_to = public.current_employee_id()
  );

CREATE POLICY tasks_delete ON public.tasks
  FOR DELETE TO authenticated
  USING (public.has_permission('tasks.manage'));

CREATE POLICY task_comments_select ON public.task_comments
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.has_permission('tasks.view')
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id
        AND t.deleted_at IS NULL
        AND (
          public.has_permission('tasks.manage')
          OR t.assigned_to = public.current_employee_id()
          OR t.assigned_by = auth.uid()
        )
    )
  );

CREATE POLICY task_comments_insert ON public.task_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.has_permission('tasks.view')
  );

CREATE POLICY task_comments_update ON public.task_comments
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (author_id = auth.uid());

CREATE POLICY task_attachments_select ON public.task_attachments
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.has_permission('tasks.view')
  );

CREATE POLICY task_attachments_manage ON public.task_attachments
  FOR ALL TO authenticated
  USING (public.has_permission('tasks.manage') OR uploaded_by = auth.uid())
  WITH CHECK (public.has_permission('tasks.manage') OR uploaded_by = auth.uid());

-- ============================================================================
-- INSTRUMENTS & MAINTENANCE
-- ============================================================================

CREATE POLICY instruments_select ON public.instruments
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('instruments.view'));

CREATE POLICY instruments_manage ON public.instruments
  FOR ALL TO authenticated
  USING (public.has_permission('instruments.manage'))
  WITH CHECK (public.has_permission('instruments.manage'));

CREATE POLICY maintenance_records_select ON public.maintenance_records
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('maintenance.view'));

CREATE POLICY maintenance_records_manage ON public.maintenance_records
  FOR ALL TO authenticated
  USING (public.has_permission('maintenance.manage'))
  WITH CHECK (public.has_permission('maintenance.manage'));

CREATE POLICY maintenance_checklist_items_select ON public.maintenance_checklist_items
  FOR SELECT TO authenticated
  USING (public.has_permission('maintenance.view'));

CREATE POLICY maintenance_checklist_items_manage ON public.maintenance_checklist_items
  FOR ALL TO authenticated
  USING (public.has_permission('maintenance.manage'))
  WITH CHECK (public.has_permission('maintenance.manage'));

-- ============================================================================
-- QUALITY & CLINICAL OPERATIONS
-- ============================================================================

CREATE POLICY qc_records_select ON public.qc_records
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('qc.view'));

CREATE POLICY qc_records_manage ON public.qc_records
  FOR ALL TO authenticated
  USING (public.has_permission('qc.manage'))
  WITH CHECK (public.has_permission('qc.manage'));

CREATE POLICY critical_values_select ON public.critical_values
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('critical_values.view'));

CREATE POLICY critical_values_manage ON public.critical_values
  FOR ALL TO authenticated
  USING (public.has_permission('critical_values.manage'))
  WITH CHECK (public.has_permission('critical_values.manage'));

CREATE POLICY sample_rejections_select ON public.sample_rejections
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('sample_rejections.view'));

CREATE POLICY sample_rejections_manage ON public.sample_rejections
  FOR ALL TO authenticated
  USING (public.has_permission('sample_rejections.manage'))
  WITH CHECK (public.has_permission('sample_rejections.manage'));

CREATE POLICY corrected_results_select ON public.corrected_results
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('corrected_results.view'));

CREATE POLICY corrected_results_manage ON public.corrected_results
  FOR ALL TO authenticated
  USING (public.has_permission('corrected_results.manage'))
  WITH CHECK (public.has_permission('corrected_results.manage'));

CREATE POLICY tat_records_select ON public.tat_records
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('tat.view'));

CREATE POLICY tat_records_manage ON public.tat_records
  FOR ALL TO authenticated
  USING (public.has_permission('tat.manage'))
  WITH CHECK (public.has_permission('tat.manage'));

CREATE POLICY pending_samples_select ON public.pending_samples
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('tat.view'));

CREATE POLICY pending_samples_manage ON public.pending_samples
  FOR ALL TO authenticated
  USING (public.has_permission('tat.manage') OR public.has_role(ARRAY['senior_lab_technologist'::app_role, 'section_supervisor'::app_role]))
  WITH CHECK (public.has_permission('tat.manage') OR public.has_role(ARRAY['senior_lab_technologist'::app_role, 'section_supervisor'::app_role]));

-- ============================================================================
-- TRAINING & COMPETENCY
-- ============================================================================

CREATE POLICY training_courses_select ON public.training_courses
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('training.view'));

CREATE POLICY training_courses_manage ON public.training_courses
  FOR ALL TO authenticated
  USING (public.has_permission('training.manage'))
  WITH CHECK (public.has_permission('training.manage'));

CREATE POLICY training_enrollments_select ON public.training_enrollments
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.has_permission('training.manage')
      OR employee_id = public.current_employee_id()
    )
  );

CREATE POLICY training_enrollments_manage ON public.training_enrollments
  FOR ALL TO authenticated
  USING (public.has_permission('training.manage'))
  WITH CHECK (public.has_permission('training.manage'));

CREATE POLICY training_enrollments_self_update ON public.training_enrollments
  FOR UPDATE TO authenticated
  USING (employee_id = public.current_employee_id() AND deleted_at IS NULL)
  WITH CHECK (employee_id = public.current_employee_id());

CREATE POLICY quizzes_select ON public.quizzes
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('training.view'));

CREATE POLICY quizzes_manage ON public.quizzes
  FOR ALL TO authenticated
  USING (public.has_permission('training.manage'))
  WITH CHECK (public.has_permission('training.manage'));

CREATE POLICY quiz_questions_select ON public.quiz_questions
  FOR SELECT TO authenticated
  USING (public.has_permission('training.view'));

CREATE POLICY quiz_questions_manage ON public.quiz_questions
  FOR ALL TO authenticated
  USING (public.has_permission('training.manage'))
  WITH CHECK (public.has_permission('training.manage'));

CREATE POLICY quiz_attempts_select ON public.quiz_attempts
  FOR SELECT TO authenticated
  USING (
    public.has_permission('training.manage')
    OR employee_id = public.current_employee_id()
  );

CREATE POLICY quiz_attempts_manage ON public.quiz_attempts
  FOR ALL TO authenticated
  USING (
    public.has_permission('training.manage')
    OR employee_id = public.current_employee_id()
  )
  WITH CHECK (
    public.has_permission('training.manage')
    OR employee_id = public.current_employee_id()
  );

CREATE POLICY competencies_select ON public.competencies
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.has_permission('training.manage')
      OR employee_id = public.current_employee_id()
      OR public.has_role(ARRAY['head_of_section'::app_role, 'section_supervisor'::app_role])
    )
  );

CREATE POLICY competencies_manage ON public.competencies
  FOR ALL TO authenticated
  USING (public.has_permission('training.manage') OR public.has_role(ARRAY['head_of_section'::app_role, 'section_supervisor'::app_role]))
  WITH CHECK (public.has_permission('training.manage') OR public.has_role(ARRAY['head_of_section'::app_role, 'section_supervisor'::app_role]));

CREATE POLICY certificates_select ON public.certificates
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.has_permission('training.view')
      AND (
        public.has_permission('training.manage')
        OR employee_id = public.current_employee_id()
      )
    )
  );

CREATE POLICY certificates_manage ON public.certificates
  FOR ALL TO authenticated
  USING (public.has_permission('training.manage'))
  WITH CHECK (public.has_permission('training.manage'));

-- ============================================================================
-- DOCUMENTS
-- ============================================================================

CREATE POLICY documents_select ON public.documents
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('documents.view'));

CREATE POLICY documents_manage ON public.documents
  FOR ALL TO authenticated
  USING (public.has_permission('documents.manage'))
  WITH CHECK (public.has_permission('documents.manage'));

CREATE POLICY document_versions_select ON public.document_versions
  FOR SELECT TO authenticated
  USING (public.has_permission('documents.view'));

CREATE POLICY document_versions_manage ON public.document_versions
  FOR ALL TO authenticated
  USING (public.has_permission('documents.manage'))
  WITH CHECK (public.has_permission('documents.manage'));

CREATE POLICY document_acknowledgements_select ON public.document_acknowledgements
  FOR SELECT TO authenticated
  USING (
    public.has_permission('documents.manage')
    OR employee_id = public.current_employee_id()
  );

CREATE POLICY document_acknowledgements_manage ON public.document_acknowledgements
  FOR ALL TO authenticated
  USING (
    public.has_permission('documents.manage')
    OR employee_id = public.current_employee_id()
  )
  WITH CHECK (
    public.has_permission('documents.manage')
    OR employee_id = public.current_employee_id()
  );

-- ============================================================================
-- INVENTORY
-- ============================================================================

CREATE POLICY inventory_items_select ON public.inventory_items
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('inventory.view'));

CREATE POLICY inventory_items_manage ON public.inventory_items
  FOR ALL TO authenticated
  USING (public.has_permission('inventory.manage'))
  WITH CHECK (public.has_permission('inventory.manage'));

CREATE POLICY inventory_transactions_select ON public.inventory_transactions
  FOR SELECT TO authenticated
  USING (public.has_permission('inventory.view'));

CREATE POLICY inventory_transactions_manage ON public.inventory_transactions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('inventory.manage'));

-- ============================================================================
-- MEETINGS
-- ============================================================================

CREATE POLICY meetings_select ON public.meetings
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('meetings.view'));

CREATE POLICY meetings_manage ON public.meetings
  FOR ALL TO authenticated
  USING (public.has_permission('meetings.manage'))
  WITH CHECK (public.has_permission('meetings.manage'));

CREATE POLICY meeting_attendees_select ON public.meeting_attendees
  FOR SELECT TO authenticated
  USING (public.has_permission('meetings.view'));

CREATE POLICY meeting_attendees_manage ON public.meeting_attendees
  FOR ALL TO authenticated
  USING (public.has_permission('meetings.manage'))
  WITH CHECK (public.has_permission('meetings.manage'));

CREATE POLICY meeting_actions_select ON public.meeting_actions
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('meetings.view'));

CREATE POLICY meeting_actions_manage ON public.meeting_actions
  FOR ALL TO authenticated
  USING (public.has_permission('meetings.manage'))
  WITH CHECK (public.has_permission('meetings.manage'));

-- ============================================================================
-- RISK, INCIDENTS & CAPA
-- ============================================================================

CREATE POLICY risks_select ON public.risks
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('risk.view'));

CREATE POLICY risks_manage ON public.risks
  FOR ALL TO authenticated
  USING (public.has_permission('risk.manage'))
  WITH CHECK (public.has_permission('risk.manage'));

CREATE POLICY incidents_select ON public.incidents
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.has_permission('risk.view')
      OR public.has_permission('capa.manage')
    )
  );

CREATE POLICY incidents_manage ON public.incidents
  FOR ALL TO authenticated
  USING (
    public.has_permission('risk.manage')
    OR public.has_permission('capa.manage')
    OR public.has_role(ARRAY['quality_officer'::app_role, 'head_of_section'::app_role])
  )
  WITH CHECK (
    public.has_permission('risk.manage')
    OR public.has_permission('capa.manage')
    OR public.has_role(ARRAY['quality_officer'::app_role, 'head_of_section'::app_role])
  );

CREATE POLICY capa_records_select ON public.capa_records
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('capa.view'));

CREATE POLICY capa_records_manage ON public.capa_records
  FOR ALL TO authenticated
  USING (public.has_permission('capa.manage'))
  WITH CHECK (public.has_permission('capa.manage'));

-- ============================================================================
-- NOTIFICATIONS, REPORTS, AUDIT & SETTINGS
-- ============================================================================

CREATE POLICY notifications_select ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_permission('notifications.manage'));

CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('notifications.manage'));

CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_permission('notifications.manage'))
  WITH CHECK (user_id = auth.uid() OR public.has_permission('notifications.manage'));

CREATE POLICY notifications_delete ON public.notifications
  FOR DELETE TO authenticated
  USING (public.has_permission('notifications.manage'));

CREATE POLICY reports_select ON public.reports
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.has_permission('reports.view')
      OR generated_by = auth.uid()
    )
  );

CREATE POLICY reports_insert ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('reports.manage') OR public.has_permission('reports.view'));

CREATE POLICY reports_update ON public.reports
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.has_permission('reports.manage')
      OR (generated_by = auth.uid() AND status = 'draft')
    )
  )
  WITH CHECK (
    public.has_permission('reports.manage')
    OR (generated_by = auth.uid() AND status = 'draft')
    OR public.has_permission('reports.approve')
  );

CREATE POLICY reports_delete ON public.reports
  FOR DELETE TO authenticated
  USING (public.has_permission('reports.manage'));

CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_permission('audit.view'));

CREATE POLICY audit_logs_insert ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY system_settings_select_public ON public.system_settings
  FOR SELECT TO authenticated
  USING (is_public = TRUE);

CREATE POLICY system_settings_select_manage ON public.system_settings
  FOR SELECT TO authenticated
  USING (public.has_permission('settings.manage'));

CREATE POLICY system_settings_manage ON public.system_settings
  FOR ALL TO authenticated
  USING (public.has_permission('settings.manage'))
  WITH CHECK (public.has_permission('settings.manage'));

-- ============================================================================

-- Sample rejection status history (from operational schema)
ALTER TABLE public.sample_rejection_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY sample_rejection_status_history_select ON public.sample_rejection_status_history
  FOR SELECT TO authenticated
  USING (public.has_permission('sample_rejections.view'));

CREATE POLICY sample_rejection_status_history_insert ON public.sample_rejection_status_history
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('sample_rejections.manage'));

-- Soft delete: normal users cannot hard-delete; updates that set deleted_at require manage permission
-- (enforce via UPDATE policies checking deleted_at IS NULL on USING clause — already present on most tables)

-- SCHEMA GRANTS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
