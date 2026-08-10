-- ============================================================================
-- Hematology Section Portal
-- Migration 012: QC Operational Workflow
-- Extends qc_records for IN/OUT workflow with corrective actions & resolution
-- ============================================================================

CREATE TYPE public.qc_in_out AS ENUM ('IN', 'OUT');

CREATE TYPE public.qc_resolution_status AS ENUM ('IN', 'Still OUT', 'Pending');

-- Legacy numeric/statistical QC fields become optional; operational workflow uses IN/OUT
ALTER TABLE public.qc_records ALTER COLUMN lot_number DROP NOT NULL;
ALTER TABLE public.qc_records ALTER COLUMN expiry_date DROP NOT NULL;
ALTER TABLE public.qc_records ALTER COLUMN result_value DROP NOT NULL;
ALTER TABLE public.qc_records ALTER COLUMN mean_value DROP NOT NULL;
ALTER TABLE public.qc_records ALTER COLUMN standard_deviation DROP NOT NULL;
ALTER TABLE public.qc_records ALTER COLUMN cv_percent DROP NOT NULL;
ALTER TABLE public.qc_records ALTER COLUMN range_min DROP NOT NULL;
ALTER TABLE public.qc_records ALTER COLUMN range_max DROP NOT NULL;

ALTER TABLE public.qc_records
  ADD COLUMN IF NOT EXISTS qc_status public.qc_in_out,
  ADD COLUMN IF NOT EXISTS resolution_status public.qc_resolution_status,
  ADD COLUMN IF NOT EXISTS corrective_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS corrective_action_comment TEXT,
  ADD COLUMN IF NOT EXISTS corrective_action_other TEXT,
  ADD COLUMN IF NOT EXISTS action_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS action_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS action_by_name TEXT,
  ADD COLUMN IF NOT EXISTS action_by_staff_id TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_by_name TEXT,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS performed_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS performed_by_name TEXT,
  ADD COLUMN IF NOT EXISTS performed_by_staff_id TEXT,
  ADD COLUMN IF NOT EXISTS comment TEXT;

-- Migrate legacy status enum to qc_status where possible
UPDATE public.qc_records
SET qc_status = CASE
  WHEN status IN ('accepted', 'warning') THEN 'IN'::public.qc_in_out
  WHEN status IN ('rejected', 'pending_review') THEN 'OUT'::public.qc_in_out
  ELSE 'IN'::public.qc_in_out
END
WHERE qc_status IS NULL AND status IS NOT NULL;

UPDATE public.qc_records
SET qc_status = 'IN'::public.qc_in_out
WHERE qc_status IS NULL;

ALTER TABLE public.qc_records
  ALTER COLUMN qc_status SET NOT NULL;

ALTER TABLE public.qc_records DROP COLUMN IF EXISTS status;

ALTER TABLE public.qc_records DROP CONSTRAINT IF EXISTS qc_records_range_valid;

-- Ensure QC instruments exist (reuse by name if already present)
INSERT INTO public.instruments (
  name, manufacturer, model, serial_number, location, installation_date, status
)
SELECT v.name, v.manufacturer, v.model, v.serial_number, v.location, CURRENT_DATE, 'operational'::public.instrument_status
FROM (VALUES
  ('Alinity HQ 1147', 'Abbott', 'Alinity HQ', 'ALN-HQ-1147', 'Hematology Lab - Bench 1'),
  ('Alinity HQ 1149', 'Abbott', 'Alinity HQ', 'ALN-HQ-1149', 'Hematology Lab - Bench 2'),
  ('Stago STA R MAX3', 'Stago', 'STA-R Max 3', 'STAR-MAX3-001', 'Hematology Lab - Coag Bench'),
  ('Alifax Test1', 'Alifax', 'Test-1', 'ALX-TEST1-001', 'Hematology Lab - ESR Station'),
  ('Manual Test', 'Manual', 'Manual', 'MANUAL-QC-001', 'Hematology Lab - Manual Bench')
) AS v(name, manufacturer, model, serial_number, location)
WHERE NOT EXISTS (
  SELECT 1 FROM public.instruments i
  WHERE i.name = v.name AND i.deleted_at IS NULL
);

CREATE INDEX IF NOT EXISTS idx_qc_records_qc_status ON public.qc_records(qc_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_qc_records_resolution_status ON public.qc_records(resolution_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_qc_records_instrument_parameter ON public.qc_records(instrument_id, test_name) WHERE deleted_at IS NULL;
