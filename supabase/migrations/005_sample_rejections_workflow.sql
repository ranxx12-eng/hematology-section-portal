-- Sample Rejection workflow redesign + Pending Samples integration

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

ALTER TABLE public.sample_rejections
  ADD COLUMN IF NOT EXISTS patient_name TEXT,
  ADD COLUMN IF NOT EXISTS patient_lab_accession TEXT,
  ADD COLUMN IF NOT EXISTS department_name TEXT,
  ADD COLUMN IF NOT EXISTS rejection_date DATE,
  ADD COLUMN IF NOT EXISTS rejection_time TIME,
  ADD COLUMN IF NOT EXISTS rejected_tests JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rejected_tube TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reasons JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS other_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS informed_nurse_name TEXT,
  ADD COLUMN IF NOT EXISTS nurse_id TEXT,
  ADD COLUMN IF NOT EXISTS nurse_notification_date DATE,
  ADD COLUMN IF NOT EXISTS nurse_notification_time TIME,
  ADD COLUMN IF NOT EXISTS doctor_notification_required BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS doctor_name TEXT,
  ADD COLUMN IF NOT EXISTS doctor_id TEXT,
  ADD COLUMN IF NOT EXISTS doctor_notification_date DATE,
  ADD COLUMN IF NOT EXISTS doctor_notification_time TIME,
  ADD COLUMN IF NOT EXISTS created_by_staff_name TEXT,
  ADD COLUMN IF NOT EXISTS created_by_staff_id TEXT,
  ADD COLUMN IF NOT EXISTS record_created_date DATE,
  ADD COLUMN IF NOT EXISTS record_created_time TIME,
  ADD COLUMN IF NOT EXISTS supervisor_review_status public.supervisor_review_status DEFAULT 'pending_supervisor_review',
  ADD COLUMN IF NOT EXISTS reviewed_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by_name TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by_staff_id TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_date DATE,
  ADD COLUMN IF NOT EXISTS reviewed_time TIME,
  ADD COLUMN IF NOT EXISTS replacement_sample_status public.replacement_sample_status DEFAULT 'Awaiting Replacement Sample',
  ADD COLUMN IF NOT EXISTS replacement_received_date DATE,
  ADD COLUMN IF NOT EXISTS replacement_received_time TIME,
  ADD COLUMN IF NOT EXISTS replacement_received_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replacement_received_by_name TEXT,
  ADD COLUMN IF NOT EXISTS replacement_received_by_staff_id TEXT,
  ADD COLUMN IF NOT EXISTS completion_date DATE,
  ADD COLUMN IF NOT EXISTS completion_time TIME,
  ADD COLUMN IF NOT EXISTS completed_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_by_name TEXT,
  ADD COLUMN IF NOT EXISTS completed_by_staff_id TEXT,
  ADD COLUMN IF NOT EXISTS discard_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discard_status public.discard_status DEFAULT 'not_due',
  ADD COLUMN IF NOT EXISTS discard_date DATE,
  ADD COLUMN IF NOT EXISTS discard_time TIME,
  ADD COLUMN IF NOT EXISTS discarded_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discarded_by_name TEXT,
  ADD COLUMN IF NOT EXISTS discarded_by_staff_id TEXT,
  ADD COLUMN IF NOT EXISTS comments TEXT,
  ADD COLUMN IF NOT EXISTS pending_sample_id UUID;

-- Migrate legacy rows
UPDATE public.sample_rejections
SET
  patient_name = COALESCE(patient_name, 'Legacy Patient'),
  patient_lab_accession = COALESCE(patient_lab_accession, patient_id),
  department_name = COALESCE(department_name, collection_area, 'Hematology Section'),
  rejection_date = COALESCE(rejection_date, recorded_at::date),
  rejection_time = COALESCE(rejection_time, recorded_at::time),
  rejected_tests = COALESCE(rejected_tests, jsonb_build_array(test_requested)),
  rejected_tube = COALESCE(rejected_tube, sample_type),
  rejection_reasons = COALESCE(rejection_reasons, jsonb_build_array(rejection_reason)),
  informed_nurse_name = COALESCE(informed_nurse_name, 'Legacy Nurse'),
  nurse_id = COALESCE(nurse_id, 'N/A'),
  nurse_notification_date = COALESCE(nurse_notification_date, recorded_at::date),
  nurse_notification_time = COALESCE(nurse_notification_time, recorded_at::time),
  created_by_staff_name = COALESCE(created_by_staff_name, 'Legacy Staff'),
  created_by_staff_id = COALESCE(created_by_staff_id, 'LEGACY'),
  record_created_date = COALESCE(record_created_date, created_at::date),
  record_created_time = COALESCE(record_created_time, created_at::time),
  discard_due_at = COALESCE(discard_due_at, created_at + INTERVAL '3 days')
WHERE deleted_at IS NULL;

ALTER TABLE public.sample_rejections
  DROP COLUMN IF EXISTS recorded_at,
  DROP COLUMN IF EXISTS sample_type,
  DROP COLUMN IF EXISTS test_requested,
  DROP COLUMN IF EXISTS rejection_reason,
  DROP COLUMN IF EXISTS collection_area,
  DROP COLUMN IF EXISTS collector,
  DROP COLUMN IF EXISTS rejected_by,
  DROP COLUMN IF EXISTS recollection_requested,
  DROP COLUMN IF EXISTS recollection_time,
  DROP COLUMN IF EXISTS final_status,
  DROP COLUMN IF EXISTS notes;

CREATE TABLE IF NOT EXISTS public.sample_rejection_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_rejection_id UUID NOT NULL REFERENCES public.sample_rejections(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

ALTER TABLE public.pending_samples
  ADD COLUMN IF NOT EXISTS source_type public.pending_sample_source DEFAULT 'tat',
  ADD COLUMN IF NOT EXISTS sample_rejection_id UUID REFERENCES public.sample_rejections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS patient_name TEXT,
  ADD COLUMN IF NOT EXISTS patient_lab_accession TEXT,
  ADD COLUMN IF NOT EXISTS department_name TEXT,
  ADD COLUMN IF NOT EXISTS rejected_tests JSONB,
  ADD COLUMN IF NOT EXISTS rejected_tube TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reasons JSONB,
  ADD COLUMN IF NOT EXISTS rejection_date DATE,
  ADD COLUMN IF NOT EXISTS rejection_time TIME,
  ADD COLUMN IF NOT EXISTS assigned_staff_name TEXT,
  ADD COLUMN IF NOT EXISTS replacement_sample_status public.replacement_sample_status,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS rejected_sample_retention_days INTEGER NOT NULL DEFAULT 3 CHECK (rejected_sample_retention_days > 0);

CREATE INDEX IF NOT EXISTS idx_sample_rejections_accession ON public.sample_rejections(patient_lab_accession);
CREATE INDEX IF NOT EXISTS idx_sample_rejections_department ON public.sample_rejections(department_name);
CREATE INDEX IF NOT EXISTS idx_sample_rejections_review_status ON public.sample_rejections(supervisor_review_status);
CREATE INDEX IF NOT EXISTS idx_sample_rejections_replacement_status ON public.sample_rejections(replacement_sample_status);
CREATE INDEX IF NOT EXISTS idx_sample_rejections_discard_status ON public.sample_rejections(discard_status);
CREATE INDEX IF NOT EXISTS idx_pending_samples_rejection ON public.pending_samples(sample_rejection_id);
CREATE INDEX IF NOT EXISTS idx_pending_samples_active ON public.pending_samples(is_active);

ALTER TABLE public.sample_rejection_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY sample_rejection_status_history_select ON public.sample_rejection_status_history
  FOR SELECT TO authenticated
  USING (public.has_permission('sample_rejections.view'));

CREATE POLICY sample_rejection_status_history_insert ON public.sample_rejection_status_history
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('sample_rejections.manage'));
