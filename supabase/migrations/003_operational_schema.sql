-- ============================================================================
-- Hematology Section Portal
-- Migration 003: Operational Schema
-- Production-safe. No seed data.
-- ============================================================================

-- HR & PERFORMANCE
-- ============================================================================

CREATE TABLE public.fte_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  fte_value NUMERIC(4, 3) NOT NULL CHECK (fte_value >= 0 AND fte_value <= 1),
  productive_hours NUMERIC(8, 2),
  scheduled_hours NUMERIC(8, 2),
  absence_hours NUMERIC(8, 2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT fte_records_period_valid CHECK (period_end >= period_start),
  UNIQUE (employee_id, period_start, period_end)
);

CREATE TABLE public.employee_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  fte NUMERIC(4, 3) NOT NULL CHECK (fte >= 0 AND fte <= 1),
  staff_evaluation SMALLINT NOT NULL CHECK (staff_evaluation BETWEEN 1 AND 5),
  supervisor_evaluation SMALLINT NOT NULL CHECK (supervisor_evaluation BETWEEN 1 AND 5),
  lab_manager_evaluation SMALLINT NOT NULL CHECK (lab_manager_evaluation BETWEEN 1 AND 5),
  lab_director_evaluation SMALLINT NOT NULL CHECK (lab_director_evaluation BETWEEN 1 AND 5),
  final_score NUMERIC(5, 2) NOT NULL CHECK (final_score >= 0 AND final_score <= 100),
  rating evaluation_rating NOT NULL,
  strengths TEXT,
  areas_for_improvement TEXT,
  comments TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (employee_id, period)
);

-- ============================================================================
-- TASK MANAGEMENT
-- ============================================================================

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  assigned_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  priority task_priority NOT NULL DEFAULT 'medium',
  status task_status NOT NULL DEFAULT 'not_started',
  start_date DATE NOT NULL,
  due_date DATE NOT NULL,
  recurrence task_recurrence NOT NULL DEFAULT 'none',
  task_type task_type NOT NULL DEFAULT 'personal',
  approval_status approval_status,
  completion_evidence TEXT,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT tasks_due_after_start CHECK (due_date >= start_date)
);

CREATE TABLE public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- INSTRUMENTS & MAINTENANCE
-- ============================================================================

CREATE TABLE public.instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  model TEXT NOT NULL,
  serial_number TEXT NOT NULL UNIQUE,
  location TEXT NOT NULL,
  installation_date DATE NOT NULL,
  status instrument_status NOT NULL DEFAULT 'operational',
  last_maintenance DATE,
  next_maintenance DATE,
  calibration_due_date DATE,
  warranty_expiry DATE,
  service_provider TEXT,
  contact_info TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE public.maintenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id UUID NOT NULL REFERENCES public.instruments(id) ON DELETE RESTRICT,
  maintenance_type maintenance_type NOT NULL,
  maintenance_date DATE NOT NULL,
  shift shift_type NOT NULL,
  performed_by UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  result maintenance_result NOT NULL,
  issue_found TEXT,
  corrective_action TEXT,
  ticket_number TEXT,
  engineer_name TEXT,
  supervisor_review BOOLEAN NOT NULL DEFAULT FALSE,
  review_date DATE,
  electronic_signature TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE public.maintenance_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_record_id UUID NOT NULL REFERENCES public.maintenance_records(id) ON DELETE CASCADE,
  item_order SMALLINT NOT NULL DEFAULT 1,
  item_text TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (maintenance_record_id, item_order)
);

-- ============================================================================
-- QUALITY CONTROL & CLINICAL OPERATIONS
-- ============================================================================

CREATE TABLE public.qc_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id UUID NOT NULL REFERENCES public.instruments(id) ON DELETE RESTRICT,
  test_name TEXT NOT NULL,
  control_level TEXT NOT NULL,
  lot_number TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  result_value NUMERIC(12, 4) NOT NULL,
  mean_value NUMERIC(12, 4) NOT NULL,
  standard_deviation NUMERIC(12, 4) NOT NULL,
  cv_percent NUMERIC(8, 4) NOT NULL,
  range_min NUMERIC(12, 4) NOT NULL,
  range_max NUMERIC(12, 4) NOT NULL,
  status qc_status NOT NULL DEFAULT 'pending_review',
  corrective_action TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT qc_records_range_valid CHECK (range_max >= range_min)
);


CREATE TABLE public.critical_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  record_date DATE NOT NULL,
  patient_id TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  patient_acc_number TEXT NOT NULL,
  test_name TEXT NOT NULL,
  critical_value TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT 'Hematology',
  informed_to_dr TEXT NOT NULL,
  dr_id TEXT NOT NULL,
  verify_time TIME NOT NULL,
  informed_time TIME NOT NULL,
  comment TEXT,
  initial TEXT NOT NULL,
  reported_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);


CREATE TABLE public.sample_rejections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  patient_lab_accession TEXT NOT NULL,
  department_name TEXT NOT NULL DEFAULT 'Hematology Section',
  rejection_date DATE NOT NULL,
  rejection_time TIME NOT NULL,
  rejected_tests JSONB NOT NULL DEFAULT '[]'::jsonb,
  rejected_tube TEXT NOT NULL,
  rejection_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  other_rejection_reason TEXT,
  informed_nurse_name TEXT NOT NULL,
  nurse_id TEXT NOT NULL,
  nurse_notification_date DATE NOT NULL,
  nurse_notification_time TIME NOT NULL,
  doctor_notification_required BOOLEAN NOT NULL DEFAULT FALSE,
  doctor_name TEXT,
  doctor_id TEXT,
  doctor_notification_date DATE,
  doctor_notification_time TIME,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_staff_name TEXT NOT NULL,
  created_by_staff_id TEXT NOT NULL,
  record_created_date DATE NOT NULL,
  record_created_time TIME NOT NULL,
  supervisor_review_status public.supervisor_review_status NOT NULL DEFAULT 'pending_supervisor_review',
  reviewed_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_by_name TEXT,
  reviewed_by_staff_id TEXT,
  reviewed_date DATE,
  reviewed_time TIME,
  replacement_sample_status public.replacement_sample_status NOT NULL DEFAULT 'Awaiting Replacement Sample',
  replacement_received_date DATE,
  replacement_received_time TIME,
  replacement_received_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  replacement_received_by_name TEXT,
  replacement_received_by_staff_id TEXT,
  completion_date DATE,
  completion_time TIME,
  completed_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_by_name TEXT,
  completed_by_staff_id TEXT,
  discard_due_at TIMESTAMPTZ,
  discard_status public.discard_status NOT NULL DEFAULT 'not_due',
  discard_date DATE,
  discard_time TIME,
  discarded_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  discarded_by_name TEXT,
  discarded_by_staff_id TEXT,
  comments TEXT,
  pending_sample_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE public.sample_rejection_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_rejection_id UUID NOT NULL REFERENCES public.sample_rejections(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

CREATE TABLE public.corrected_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correction_date DATE NOT NULL,
  patient_id TEXT NOT NULL,
  test_name TEXT NOT NULL,
  original_result TEXT NOT NULL,
  corrected_result TEXT NOT NULL,
  reason TEXT NOT NULL,
  corrected_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  physician_notified BOOLEAN NOT NULL DEFAULT FALSE,
  notification_time TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE public.tat_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_received_time TIMESTAMPTZ NOT NULL,
  result_released_time TIMESTAMPTZ NOT NULL,
  calculated_tat_minutes INTEGER NOT NULL CHECK (calculated_tat_minutes >= 0),
  target_tat_minutes INTEGER NOT NULL CHECK (target_tat_minutes > 0),
  test_type TEXT NOT NULL,
  priority tat_priority NOT NULL DEFAULT 'routine',
  department TEXT NOT NULL DEFAULT 'Hematology',
  shift shift_type NOT NULL,
  instrument_id UUID REFERENCES public.instruments(id) ON DELETE SET NULL,
  status tat_status NOT NULL,
  delay_reason TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT tat_records_time_valid CHECK (result_released_time >= sample_received_time)
);

CREATE TABLE public.pending_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type public.pending_sample_source NOT NULL DEFAULT 'tat',
  sample_rejection_id UUID REFERENCES public.sample_rejections(id) ON DELETE SET NULL,
  patient_id TEXT NOT NULL,
  patient_name TEXT,
  patient_lab_accession TEXT,
  department_name TEXT,
  rejected_tests JSONB,
  rejected_tube TEXT,
  rejection_reasons JSONB,
  rejection_date DATE,
  rejection_time TIME,
  test_name TEXT NOT NULL,
  priority tat_priority NOT NULL DEFAULT 'routine',
  received_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  elapsed_minutes INTEGER NOT NULL DEFAULT 0 CHECK (elapsed_minutes >= 0),
  instrument_id UUID REFERENCES public.instruments(id) ON DELETE SET NULL,
  assigned_staff_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  assigned_staff_name TEXT,
  replacement_sample_status public.replacement_sample_status,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  current_status TEXT NOT NULL DEFAULT 'pending',
  delay_reason TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- TRAINING & COMPETENCY
-- ============================================================================

CREATE TABLE public.training_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  instructor TEXT NOT NULL,
  start_date DATE NOT NULL,
  due_date DATE NOT NULL,
  content TEXT,
  passing_score SMALLINT NOT NULL DEFAULT 80 CHECK (passing_score BETWEEN 0 AND 100),
  status training_status NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT training_courses_due_after_start CHECK (due_date >= start_date)
);

CREATE TABLE public.training_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  status enrollment_status NOT NULL DEFAULT 'enrolled',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  score SMALLINT CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  certificate_id UUID,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (course_id, employee_id)
);

CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  time_limit_minutes INTEGER CHECK (time_limit_minutes IS NULL OR time_limit_minutes > 0),
  max_attempts SMALLINT NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  passing_score SMALLINT NOT NULL DEFAULT 80 CHECK (passing_score BETWEEN 0 AND 100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_order SMALLINT NOT NULL DEFAULT 1,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice',
  options JSONB NOT NULL DEFAULT '[]'::JSONB,
  correct_answer TEXT NOT NULL,
  points SMALLINT NOT NULL DEFAULT 1 CHECK (points > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quiz_id, question_order)
);

CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  attempt_number SMALLINT NOT NULL DEFAULT 1 CHECK (attempt_number > 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  score SMALLINT CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  passed BOOLEAN,
  answers JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quiz_id, employee_id, attempt_number)
);

CREATE TABLE public.competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  competency_name TEXT NOT NULL,
  category TEXT NOT NULL,
  assessment_date DATE NOT NULL,
  assessor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status competency_status NOT NULL DEFAULT 'pending',
  score SMALLINT CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  valid_until DATE,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.training_courses(id) ON DELETE SET NULL,
  certificate_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  issued_date DATE NOT NULL,
  expiry_date DATE,
  issued_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  file_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.training_enrollments
  ADD CONSTRAINT training_enrollments_certificate_fkey
  FOREIGN KEY (certificate_id) REFERENCES public.certificates(id) ON DELETE SET NULL;

-- ============================================================================
-- DOCUMENT CONTROL
-- ============================================================================

CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  current_version TEXT NOT NULL DEFAULT '1.0',
  effective_date DATE NOT NULL,
  review_date DATE NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status document_status NOT NULL DEFAULT 'draft',
  revision_notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE public.document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_number TEXT NOT NULL,
  file_path TEXT NOT NULL,
  change_summary TEXT,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, version_number)
);

CREATE TABLE public.document_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  document_version_id UUID REFERENCES public.document_versions(id) ON DELETE SET NULL,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, employee_id, document_version_id)
);

-- ============================================================================
-- INVENTORY
-- ============================================================================

CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  manufacturer TEXT,
  catalog_number TEXT,
  lot_number TEXT,
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit TEXT NOT NULL,
  minimum_stock NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  maximum_stock NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (maximum_stock >= 0),
  expiry_date DATE,
  storage_location TEXT NOT NULL,
  supplier TEXT,
  received_date DATE,
  opened_date DATE,
  status inventory_status NOT NULL DEFAULT 'available',
  barcode TEXT UNIQUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT inventory_items_stock_range CHECK (maximum_stock >= minimum_stock)
);

CREATE TABLE public.inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  transaction_type inventory_transaction_type NOT NULL,
  quantity_change NUMERIC(12, 2) NOT NULL,
  quantity_before NUMERIC(12, 2) NOT NULL,
  quantity_after NUMERIC(12, 2) NOT NULL,
  reference_number TEXT,
  reason TEXT,
  performed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- MEETINGS
-- ============================================================================

CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  meeting_time TIME NOT NULL,
  location TEXT NOT NULL,
  organizer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  agenda TEXT NOT NULL,
  discussion TEXT,
  decisions TEXT,
  minutes_approved BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE public.meeting_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  attendance_status TEXT NOT NULL DEFAULT 'invited',
  attended BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (meeting_id, employee_id)
);

CREATE TABLE public.meeting_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  action_text TEXT NOT NULL,
  assigned_to UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  due_date DATE,
  status meeting_action_status NOT NULL DEFAULT 'open',
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- RISK, INCIDENTS & CAPA
-- ============================================================================

CREATE TABLE public.risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  likelihood SMALLINT NOT NULL CHECK (likelihood BETWEEN 1 AND 5),
  severity SMALLINT NOT NULL CHECK (severity BETWEEN 1 AND 5),
  risk_score SMALLINT NOT NULL CHECK (risk_score BETWEEN 1 AND 25),
  existing_controls TEXT,
  action_plan TEXT,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  due_date DATE NOT NULL,
  residual_risk SMALLINT CHECK (residual_risk IS NULL OR residual_risk BETWEEN 1 AND 25),
  status risk_status NOT NULL DEFAULT 'open',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  incident_type TEXT NOT NULL,
  severity incident_severity NOT NULL DEFAULT 'minor',
  description TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  reported_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  patient_id TEXT,
  instrument_id UUID REFERENCES public.instruments(id) ON DELETE SET NULL,
  immediate_action TEXT,
  root_cause TEXT,
  status incident_status NOT NULL DEFAULT 'reported',
  closed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE public.capa_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
  problem_statement TEXT NOT NULL,
  immediate_correction TEXT,
  root_cause TEXT,
  corrective_action TEXT,
  preventive_action TEXT,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  due_date DATE NOT NULL,
  evidence TEXT,
  effectiveness_review TEXT,
  closure_approval BOOLEAN NOT NULL DEFAULT FALSE,
  status capa_status NOT NULL DEFAULT 'open',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- NOTIFICATIONS, REPORTS, AUDIT & SETTINGS
-- ============================================================================

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  report_type report_type NOT NULL,
  period_start DATE,
  period_end DATE,
  generated_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status report_status NOT NULL DEFAULT 'draft',
  content JSONB NOT NULL DEFAULT '{}'::JSONB,
  file_path TEXT,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  record_id UUID,
  previous_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
