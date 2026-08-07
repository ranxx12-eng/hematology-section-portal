-- ============================================================================
-- Hematology Section Portal
-- Migration 004: Indexes and Triggers
-- Production-safe. No seed data.
-- Idempotent: safe to rerun after partial failure.
-- ============================================================================

-- UTILITY FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_hard_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Hard deletes are not allowed on %. Use deleted_at for soft delete.', TG_TABLE_NAME;
END;
$$;

-- ============================================================================
-- INDEXES
-- Note: idx_user_roles_user_id and idx_user_roles_role_id are created in
-- migration 002 with is_active predicates — not duplicated here.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_employees_supervisor_id ON public.employees(supervisor_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_employees_role ON public.employees(role) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_employees_section ON public.employees(section) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_employees_active ON public.employees(is_active) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fte_records_employee_period ON public.fte_records(employee_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_employee_evaluations_employee ON public.employee_evaluations(employee_id, period);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON public.tasks(assigned_by) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments(task_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON public.task_attachments(task_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_instruments_status ON public.instruments(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_instruments_location ON public.instruments(location) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_maintenance_records_instrument ON public.maintenance_records(instrument_id, maintenance_date DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_records_performed_by ON public.maintenance_records(performed_by);

CREATE INDEX IF NOT EXISTS idx_qc_records_instrument ON public.qc_records(instrument_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_qc_records_status ON public.qc_records(status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_critical_values_record_date ON public.critical_values(record_date DESC);
CREATE INDEX IF NOT EXISTS idx_critical_values_patient ON public.critical_values(patient_id);
CREATE INDEX IF NOT EXISTS idx_critical_values_department ON public.critical_values(department);

CREATE INDEX IF NOT EXISTS idx_sample_rejections_accession ON public.sample_rejections(patient_lab_accession);
CREATE INDEX IF NOT EXISTS idx_sample_rejections_department ON public.sample_rejections(department_name);
CREATE INDEX IF NOT EXISTS idx_sample_rejections_review_status ON public.sample_rejections(supervisor_review_status);
CREATE INDEX IF NOT EXISTS idx_sample_rejections_replacement_status ON public.sample_rejections(replacement_sample_status);
CREATE INDEX IF NOT EXISTS idx_sample_rejections_discard_status ON public.sample_rejections(discard_status);

CREATE INDEX IF NOT EXISTS idx_corrected_results_date ON public.corrected_results(correction_date DESC);
CREATE INDEX IF NOT EXISTS idx_corrected_results_patient ON public.corrected_results(patient_id);

CREATE INDEX IF NOT EXISTS idx_tat_records_received ON public.tat_records(sample_received_time DESC);
CREATE INDEX IF NOT EXISTS idx_tat_records_status ON public.tat_records(status);

CREATE INDEX IF NOT EXISTS idx_pending_samples_received ON public.pending_samples(received_time DESC);
CREATE INDEX IF NOT EXISTS idx_pending_samples_assigned ON public.pending_samples(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_pending_samples_rejection ON public.pending_samples(sample_rejection_id);
CREATE INDEX IF NOT EXISTS idx_pending_samples_active ON public.pending_samples(is_active);

CREATE INDEX IF NOT EXISTS idx_training_enrollments_employee ON public.training_enrollments(employee_id);
CREATE INDEX IF NOT EXISTS idx_training_enrollments_course ON public.training_enrollments(course_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_employee ON public.quiz_attempts(employee_id);
CREATE INDEX IF NOT EXISTS idx_competencies_employee ON public.competencies(employee_id);

CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_owner ON public.documents(owner_id);

CREATE INDEX IF NOT EXISTS idx_inventory_items_status ON public.inventory_items(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_items_expiry ON public.inventory_items(expiry_date);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON public.inventory_transactions(item_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_meetings_date ON public.meetings(meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_meeting ON public.meeting_attendees(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_actions_meeting ON public.meeting_actions(meeting_id);

CREATE INDEX IF NOT EXISTS idx_risks_owner ON public.risks(owner_id);
CREATE INDEX IF NOT EXISTS idx_risks_status ON public.risks(status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_incidents_occurred_at ON public.incidents(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents(status);

CREATE INDEX IF NOT EXISTS idx_capa_records_owner ON public.capa_records(owner_id);
CREATE INDEX IF NOT EXISTS idx_capa_records_status ON public.capa_records(status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_type_status ON public.reports(report_type, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON public.audit_logs(module, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON public.audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_settings_public ON public.system_settings(setting_key) WHERE is_public = TRUE;

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trg_roles_updated_at ON public.roles;
CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_employees_updated_at ON public.employees;
CREATE TRIGGER trg_employees_updated_at BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_user_roles_updated_at ON public.user_roles;
CREATE TRIGGER trg_user_roles_updated_at BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_fte_records_updated_at ON public.fte_records;
CREATE TRIGGER trg_fte_records_updated_at BEFORE UPDATE ON public.fte_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_employee_evaluations_updated_at ON public.employee_evaluations;
CREATE TRIGGER trg_employee_evaluations_updated_at BEFORE UPDATE ON public.employee_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_task_comments_updated_at ON public.task_comments;
CREATE TRIGGER trg_task_comments_updated_at BEFORE UPDATE ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_instruments_updated_at ON public.instruments;
CREATE TRIGGER trg_instruments_updated_at BEFORE UPDATE ON public.instruments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_maintenance_records_updated_at ON public.maintenance_records;
CREATE TRIGGER trg_maintenance_records_updated_at BEFORE UPDATE ON public.maintenance_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_maintenance_checklist_items_updated_at ON public.maintenance_checklist_items;
CREATE TRIGGER trg_maintenance_checklist_items_updated_at BEFORE UPDATE ON public.maintenance_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_qc_records_updated_at ON public.qc_records;
CREATE TRIGGER trg_qc_records_updated_at BEFORE UPDATE ON public.qc_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_critical_values_updated_at ON public.critical_values;
CREATE TRIGGER trg_critical_values_updated_at BEFORE UPDATE ON public.critical_values
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_sample_rejections_updated_at ON public.sample_rejections;
CREATE TRIGGER trg_sample_rejections_updated_at BEFORE UPDATE ON public.sample_rejections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_corrected_results_updated_at ON public.corrected_results;
CREATE TRIGGER trg_corrected_results_updated_at BEFORE UPDATE ON public.corrected_results
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tat_records_updated_at ON public.tat_records;
CREATE TRIGGER trg_tat_records_updated_at BEFORE UPDATE ON public.tat_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_pending_samples_updated_at ON public.pending_samples;
CREATE TRIGGER trg_pending_samples_updated_at BEFORE UPDATE ON public.pending_samples
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_training_courses_updated_at ON public.training_courses;
CREATE TRIGGER trg_training_courses_updated_at BEFORE UPDATE ON public.training_courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_training_enrollments_updated_at ON public.training_enrollments;
CREATE TRIGGER trg_training_enrollments_updated_at BEFORE UPDATE ON public.training_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_quizzes_updated_at ON public.quizzes;
CREATE TRIGGER trg_quizzes_updated_at BEFORE UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_quiz_questions_updated_at ON public.quiz_questions;
CREATE TRIGGER trg_quiz_questions_updated_at BEFORE UPDATE ON public.quiz_questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_quiz_attempts_updated_at ON public.quiz_attempts;
CREATE TRIGGER trg_quiz_attempts_updated_at BEFORE UPDATE ON public.quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_competencies_updated_at ON public.competencies;
CREATE TRIGGER trg_competencies_updated_at BEFORE UPDATE ON public.competencies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_certificates_updated_at ON public.certificates;
CREATE TRIGGER trg_certificates_updated_at BEFORE UPDATE ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_documents_updated_at ON public.documents;
CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_inventory_items_updated_at ON public.inventory_items;
CREATE TRIGGER trg_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_meetings_updated_at ON public.meetings;
CREATE TRIGGER trg_meetings_updated_at BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_meeting_attendees_updated_at ON public.meeting_attendees;
CREATE TRIGGER trg_meeting_attendees_updated_at BEFORE UPDATE ON public.meeting_attendees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_meeting_actions_updated_at ON public.meeting_actions;
CREATE TRIGGER trg_meeting_actions_updated_at BEFORE UPDATE ON public.meeting_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_risks_updated_at ON public.risks;
CREATE TRIGGER trg_risks_updated_at BEFORE UPDATE ON public.risks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_incidents_updated_at ON public.incidents;
CREATE TRIGGER trg_incidents_updated_at BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_capa_records_updated_at ON public.capa_records;
CREATE TRIGGER trg_capa_records_updated_at BEFORE UPDATE ON public.capa_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_reports_updated_at ON public.reports;
CREATE TRIGGER trg_reports_updated_at BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER trg_system_settings_updated_at BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- Hard delete prevention
-- ============================================================================

DROP TRIGGER IF EXISTS trg_prevent_hard_delete_profiles ON public.profiles;
CREATE TRIGGER trg_prevent_hard_delete_profiles BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

DROP TRIGGER IF EXISTS trg_prevent_hard_delete_employees ON public.employees;
CREATE TRIGGER trg_prevent_hard_delete_employees BEFORE DELETE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

DROP TRIGGER IF EXISTS trg_prevent_hard_delete_critical_values ON public.critical_values;
CREATE TRIGGER trg_prevent_hard_delete_critical_values BEFORE DELETE ON public.critical_values
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

DROP TRIGGER IF EXISTS trg_prevent_hard_delete_sample_rejections ON public.sample_rejections;
CREATE TRIGGER trg_prevent_hard_delete_sample_rejections BEFORE DELETE ON public.sample_rejections
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

DROP TRIGGER IF EXISTS trg_prevent_hard_delete_corrected_results ON public.corrected_results;
CREATE TRIGGER trg_prevent_hard_delete_corrected_results BEFORE DELETE ON public.corrected_results
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

DROP TRIGGER IF EXISTS trg_prevent_hard_delete_pending_samples ON public.pending_samples;
CREATE TRIGGER trg_prevent_hard_delete_pending_samples BEFORE DELETE ON public.pending_samples
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

DROP TRIGGER IF EXISTS trg_prevent_hard_delete_documents ON public.documents;
CREATE TRIGGER trg_prevent_hard_delete_documents BEFORE DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

DROP TRIGGER IF EXISTS trg_prevent_hard_delete_document_versions ON public.document_versions;
CREATE TRIGGER trg_prevent_hard_delete_document_versions BEFORE DELETE ON public.document_versions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

DROP TRIGGER IF EXISTS trg_prevent_hard_delete_audit_logs ON public.audit_logs;
CREATE TRIGGER trg_prevent_hard_delete_audit_logs BEFORE DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

DROP TRIGGER IF EXISTS trg_prevent_hard_delete_system_settings ON public.system_settings;
CREATE TRIGGER trg_prevent_hard_delete_system_settings BEFORE DELETE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

DROP TRIGGER IF EXISTS trg_prevent_hard_delete_role_permissions ON public.role_permissions;
CREATE TRIGGER trg_prevent_hard_delete_role_permissions BEFORE DELETE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

DROP TRIGGER IF EXISTS trg_prevent_hard_delete_user_roles ON public.user_roles;
CREATE TRIGGER trg_prevent_hard_delete_user_roles BEFORE DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();
