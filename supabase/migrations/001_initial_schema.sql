-- ============================================================================
-- Hematology Section Management Portal
-- Migration 001: Initial Schema
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE app_language AS ENUM ('en', 'ar');

CREATE TYPE app_role AS ENUM (
  'system_admin',
  'lab_director',
  'lab_manager',
  'head_of_section',
  'section_supervisor',
  'quality_link',
  'senior_lab_technologist',
  'lab_technologist',
  'viewer'
);

CREATE TYPE employment_status AS ENUM ('active', 'inactive', 'on_leave');
CREATE TYPE shift_type AS ENUM ('morning', 'evening', 'night');

CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE task_status AS ENUM (
  'not_started', 'in_progress', 'pending_review', 'completed', 'overdue', 'cancelled'
);
CREATE TYPE task_recurrence AS ENUM ('daily', 'weekly', 'monthly', 'none');
CREATE TYPE task_type AS ENUM ('daily', 'weekly', 'monthly', 'personal', 'team');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TYPE instrument_status AS ENUM (
  'operational', 'warning', 'under_maintenance', 'out_of_service', 'decommissioned'
);

CREATE TYPE maintenance_type AS ENUM (
  'daily', 'weekly', 'monthly', 'preventive', 'corrective', 'emergency'
);
CREATE TYPE maintenance_result AS ENUM ('pass', 'fail', 'partial');

CREATE TYPE qc_status AS ENUM ('accepted', 'warning', 'rejected', 'pending_review');
CREATE TYPE notification_status AS ENUM ('pending', 'notified', 'delayed');
CREATE TYPE sample_final_status AS ENUM ('open', 'recollected', 'cancelled');

CREATE TYPE tat_priority AS ENUM ('stat', 'routine');
CREATE TYPE tat_status AS ENUM ('within_target', 'near_breach', 'breached');

CREATE TYPE training_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE enrollment_status AS ENUM ('enrolled', 'in_progress', 'completed', 'failed', 'withdrawn');

CREATE TYPE document_status AS ENUM ('draft', 'under_review', 'approved', 'expired', 'archived');
CREATE TYPE inventory_status AS ENUM ('available', 'low_stock', 'expired', 'depleted');
CREATE TYPE inventory_transaction_type AS ENUM (
  'receive', 'issue', 'adjustment', 'transfer', 'expired', 'disposal'
);

CREATE TYPE risk_status AS ENUM ('open', 'in_progress', 'mitigated', 'closed');
CREATE TYPE incident_severity AS ENUM ('minor', 'moderate', 'major', 'critical');
CREATE TYPE incident_status AS ENUM ('reported', 'investigating', 'resolved', 'closed');
CREATE TYPE capa_status AS ENUM ('open', 'in_progress', 'pending_review', 'closed');

CREATE TYPE report_type AS ENUM ('kpi', 'quality', 'incident', 'monthly', 'custom');
CREATE TYPE report_status AS ENUM ('draft', 'pending_approval', 'approved', 'published', 'archived');

CREATE TYPE evaluation_rating AS ENUM (
  'outstanding', 'exceeds_expectations', 'meets_expectations', 'needs_improvement', 'unsatisfactory'
);

CREATE TYPE meeting_action_status AS ENUM ('open', 'in_progress', 'completed', 'cancelled');
CREATE TYPE competency_status AS ENUM ('pending', 'in_progress', 'verified', 'expired');

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
-- CORE AUTH & RBAC
-- ============================================================================

CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name app_role NOT NULL UNIQUE,
  display_name_en TEXT NOT NULL,
  display_name_ar TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  module TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email CITEXT NOT NULL UNIQUE,
  phone TEXT,
  job_title TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'lab_technologist',
  section TEXT NOT NULL DEFAULT 'Hematology',
  hire_date DATE NOT NULL,
  employment_status employment_status NOT NULL DEFAULT 'active',
  shift shift_type NOT NULL DEFAULT 'morning',
  supervisor_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  profile_photo TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT employees_supervisor_not_self CHECK (supervisor_id IS NULL OR supervisor_id <> id)
);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email CITEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'viewer',
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  avatar_url TEXT,
  language app_language NOT NULL DEFAULT 'en',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.employees
  ADD CONSTRAINT employees_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role_id)
);

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
  patient_id TEXT NOT NULL,
  test_name TEXT NOT NULL,
  result_value TEXT NOT NULL,
  unit TEXT NOT NULL,
  critical_limit TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT 'Hematology',
  physician_contacted TEXT,
  contact_time TIMESTAMPTZ,
  read_back_completed BOOLEAN NOT NULL DEFAULT FALSE,
  reported_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  notification_status notification_status NOT NULL DEFAULT 'pending',
  delay_reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE public.sample_rejections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  patient_id TEXT NOT NULL,
  sample_type TEXT NOT NULL,
  test_requested TEXT NOT NULL,
  rejection_reason TEXT NOT NULL,
  collection_area TEXT NOT NULL,
  collector TEXT,
  rejected_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  recollection_requested BOOLEAN NOT NULL DEFAULT FALSE,
  recollection_time TIMESTAMPTZ,
  final_status sample_final_status NOT NULL DEFAULT 'open',
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
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
  patient_id TEXT NOT NULL,
  test_name TEXT NOT NULL,
  priority tat_priority NOT NULL DEFAULT 'routine',
  received_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  elapsed_minutes INTEGER NOT NULL DEFAULT 0 CHECK (elapsed_minutes >= 0),
  instrument_id UUID REFERENCES public.instruments(id) ON DELETE SET NULL,
  assigned_staff_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
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
  description TEXT,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_profiles_employee_id ON public.profiles(employee_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_role ON public.profiles(role) WHERE deleted_at IS NULL;

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id) WHERE is_active = TRUE;
CREATE INDEX idx_user_roles_role_id ON public.user_roles(role_id);

CREATE INDEX idx_employees_supervisor_id ON public.employees(supervisor_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_employees_role ON public.employees(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_employees_section ON public.employees(section) WHERE deleted_at IS NULL;
CREATE INDEX idx_employees_active ON public.employees(is_active) WHERE deleted_at IS NULL;

CREATE INDEX idx_fte_records_employee_period ON public.fte_records(employee_id, period_start DESC);
CREATE INDEX idx_employee_evaluations_employee ON public.employee_evaluations(employee_id, period);

CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_assigned_by ON public.tasks(assigned_by) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_status ON public.tasks(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date) WHERE deleted_at IS NULL;

CREATE INDEX idx_task_comments_task_id ON public.task_comments(task_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_task_attachments_task_id ON public.task_attachments(task_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_instruments_status ON public.instruments(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_instruments_location ON public.instruments(location) WHERE deleted_at IS NULL;

CREATE INDEX idx_maintenance_records_instrument ON public.maintenance_records(instrument_id, maintenance_date DESC);
CREATE INDEX idx_maintenance_records_performed_by ON public.maintenance_records(performed_by);

CREATE INDEX idx_qc_records_instrument ON public.qc_records(instrument_id, recorded_at DESC);
CREATE INDEX idx_qc_records_status ON public.qc_records(status) WHERE deleted_at IS NULL;

CREATE INDEX idx_critical_values_recorded_at ON public.critical_values(recorded_at DESC);
CREATE INDEX idx_critical_values_patient ON public.critical_values(patient_id);
CREATE INDEX idx_critical_values_status ON public.critical_values(notification_status);

CREATE INDEX idx_sample_rejections_recorded_at ON public.sample_rejections(recorded_at DESC);
CREATE INDEX idx_sample_rejections_patient ON public.sample_rejections(patient_id);

CREATE INDEX idx_corrected_results_date ON public.corrected_results(correction_date DESC);
CREATE INDEX idx_corrected_results_patient ON public.corrected_results(patient_id);

CREATE INDEX idx_tat_records_received ON public.tat_records(sample_received_time DESC);
CREATE INDEX idx_tat_records_status ON public.tat_records(status);

CREATE INDEX idx_pending_samples_received ON public.pending_samples(received_time DESC);
CREATE INDEX idx_pending_samples_assigned ON public.pending_samples(assigned_staff_id);

CREATE INDEX idx_training_enrollments_employee ON public.training_enrollments(employee_id);
CREATE INDEX idx_training_enrollments_course ON public.training_enrollments(course_id);

CREATE INDEX idx_quiz_attempts_employee ON public.quiz_attempts(employee_id);
CREATE INDEX idx_competencies_employee ON public.competencies(employee_id);

CREATE INDEX idx_documents_status ON public.documents(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_owner ON public.documents(owner_id);

CREATE INDEX idx_inventory_items_status ON public.inventory_items(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_inventory_items_expiry ON public.inventory_items(expiry_date);
CREATE INDEX idx_inventory_transactions_item ON public.inventory_transactions(item_id, transaction_date DESC);

CREATE INDEX idx_meetings_date ON public.meetings(meeting_date DESC);
CREATE INDEX idx_meeting_attendees_meeting ON public.meeting_attendees(meeting_id);
CREATE INDEX idx_meeting_actions_meeting ON public.meeting_actions(meeting_id);

CREATE INDEX idx_risks_owner ON public.risks(owner_id);
CREATE INDEX idx_risks_status ON public.risks(status) WHERE deleted_at IS NULL;

CREATE INDEX idx_incidents_occurred_at ON public.incidents(occurred_at DESC);
CREATE INDEX idx_incidents_status ON public.incidents(status);

CREATE INDEX idx_capa_records_owner ON public.capa_records(owner_id);
CREATE INDEX idx_capa_records_status ON public.capa_records(status) WHERE deleted_at IS NULL;

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_reports_type_status ON public.reports(report_type, status);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_module ON public.audit_logs(module, created_at DESC);

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_employees_updated_at BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_user_roles_updated_at BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_fte_records_updated_at BEFORE UPDATE ON public.fte_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_employee_evaluations_updated_at BEFORE UPDATE ON public.employee_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_task_comments_updated_at BEFORE UPDATE ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_instruments_updated_at BEFORE UPDATE ON public.instruments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_maintenance_records_updated_at BEFORE UPDATE ON public.maintenance_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_maintenance_checklist_items_updated_at BEFORE UPDATE ON public.maintenance_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_qc_records_updated_at BEFORE UPDATE ON public.qc_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_critical_values_updated_at BEFORE UPDATE ON public.critical_values
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_sample_rejections_updated_at BEFORE UPDATE ON public.sample_rejections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_corrected_results_updated_at BEFORE UPDATE ON public.corrected_results
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_tat_records_updated_at BEFORE UPDATE ON public.tat_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_pending_samples_updated_at BEFORE UPDATE ON public.pending_samples
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_training_courses_updated_at BEFORE UPDATE ON public.training_courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_training_enrollments_updated_at BEFORE UPDATE ON public.training_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_quizzes_updated_at BEFORE UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_quiz_questions_updated_at BEFORE UPDATE ON public.quiz_questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_quiz_attempts_updated_at BEFORE UPDATE ON public.quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_competencies_updated_at BEFORE UPDATE ON public.competencies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_certificates_updated_at BEFORE UPDATE ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_meetings_updated_at BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_meeting_attendees_updated_at BEFORE UPDATE ON public.meeting_attendees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_meeting_actions_updated_at BEFORE UPDATE ON public.meeting_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_risks_updated_at BEFORE UPDATE ON public.risks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_incidents_updated_at BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_capa_records_updated_at BEFORE UPDATE ON public.capa_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_reports_updated_at BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_system_settings_updated_at BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- AUTH PROFILE PROVISIONING
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::app_role, 'viewer')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- AUDIT LOG HELPER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action TEXT,
  p_module TEXT,
  p_record_id UUID DEFAULT NULL,
  p_previous_value JSONB DEFAULT NULL,
  p_new_value JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (user_id, action, module, record_id, previous_value, new_value)
  VALUES (auth.uid(), p_action, p_module, p_record_id, p_previous_value, p_new_value)
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$;
