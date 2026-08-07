-- ============================================================================
-- Hematology Section Portal
-- Migration 001: Extensions and Types
-- Production-safe. No seed data.
-- Rollback: DROP TYPE ... CASCADE (only on empty database)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Application language
CREATE TYPE public.app_language AS ENUM ('en', 'ar');

-- Role enum: retained for roles.name compatibility; primary authorization uses roles.id
CREATE TYPE public.app_role AS ENUM (
  'system_admin',
  'lab_director',
  'lab_manager',
  'head_of_section',
  'section_supervisor',
  'quality_officer',
  'education_coordinator',
  'inventory_officer',
  'team_leader',
  'senior_lab_technologist',
  'lab_technologist',
  'trainee',
  'read_only',
  -- Legacy aliases (kept for enum stability; canonical names above)
  'quality_link',
  'viewer'
);

CREATE TYPE public.employment_status AS ENUM ('active', 'inactive', 'on_leave');
CREATE TYPE public.shift_type AS ENUM ('morning', 'evening', 'night');

CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.task_status AS ENUM (
  'not_started', 'in_progress', 'pending_review', 'completed', 'overdue', 'cancelled'
);
CREATE TYPE public.task_recurrence AS ENUM ('daily', 'weekly', 'monthly', 'none');
CREATE TYPE public.task_type AS ENUM ('daily', 'weekly', 'monthly', 'personal', 'team');
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TYPE public.instrument_status AS ENUM (
  'operational', 'warning', 'under_maintenance', 'out_of_service', 'decommissioned'
);

CREATE TYPE public.maintenance_type AS ENUM (
  'daily', 'weekly', 'monthly', 'preventive', 'corrective', 'emergency'
);
CREATE TYPE public.maintenance_result AS ENUM ('pass', 'fail', 'partial');

CREATE TYPE public.qc_status AS ENUM ('accepted', 'warning', 'rejected', 'pending_review');

CREATE TYPE public.tat_priority AS ENUM ('stat', 'routine');
CREATE TYPE public.tat_status AS ENUM ('within_target', 'near_breach', 'breached');

CREATE TYPE public.training_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE public.enrollment_status AS ENUM ('enrolled', 'in_progress', 'completed', 'failed', 'withdrawn');

CREATE TYPE public.document_status AS ENUM ('draft', 'under_review', 'approved', 'expired', 'archived');
CREATE TYPE public.inventory_status AS ENUM ('available', 'low_stock', 'expired', 'depleted');
CREATE TYPE public.inventory_transaction_type AS ENUM (
  'receive', 'issue', 'adjustment', 'transfer', 'expired', 'disposal'
);

CREATE TYPE public.risk_status AS ENUM ('open', 'in_progress', 'mitigated', 'closed');
CREATE TYPE public.incident_severity AS ENUM ('minor', 'moderate', 'major', 'critical');
CREATE TYPE public.incident_status AS ENUM ('reported', 'investigating', 'resolved', 'closed');
CREATE TYPE public.capa_status AS ENUM ('open', 'in_progress', 'pending_review', 'closed');

CREATE TYPE public.report_type AS ENUM ('kpi', 'quality', 'incident', 'monthly', 'custom');
CREATE TYPE public.report_status AS ENUM ('draft', 'pending_approval', 'approved', 'published', 'archived');

CREATE TYPE public.evaluation_rating AS ENUM (
  'outstanding', 'exceeds_expectations', 'meets_expectations', 'needs_improvement', 'unsatisfactory'
);

CREATE TYPE public.meeting_action_status AS ENUM ('open', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.competency_status AS ENUM ('pending', 'in_progress', 'verified', 'expired');

-- Sample rejection workflow (integrated from former migration 005)
CREATE TYPE public.supervisor_review_status AS ENUM ('pending_supervisor_review', 'reviewed');
CREATE TYPE public.replacement_sample_status AS ENUM (
  'Awaiting Replacement Sample',
  'Replacement Sample Received',
  'Completed',
  'Discarded',
  'Cancelled'
);
CREATE TYPE public.discard_status AS ENUM ('not_due', 'discard_due', 'discarded');
CREATE TYPE public.pending_sample_source AS ENUM ('tat', 'rejection');
