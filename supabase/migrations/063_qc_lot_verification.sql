-- ============================================================================
-- Migration 063: QC Lot Verification framework (CBC Form-Hema-020)
-- Does NOT auto-apply.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qc_verification_type') THEN
    CREATE TYPE public.qc_verification_type AS ENUM ('cbc', 'coagulation');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qc_verification_study_status') THEN
    CREATE TYPE public.qc_verification_study_status AS ENUM (
      'draft',
      'runs_completed',
      'pending_review',
      'pending_approval',
      'approved',
      'rejected'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qc_verification_final_decision') THEN
    CREATE TYPE public.qc_verification_final_decision AS ENUM (
      'verification_acceptable',
      'established_data_acceptable',
      'reestablished_data_acceptable',
      'verification_unacceptable_reject'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qc_verification_parameter_result') THEN
    CREATE TYPE public.qc_verification_parameter_result AS ENUM (
      'pass',
      'fail',
      'manual_review',
      'incomplete'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.qc_lot_verification_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_number TEXT NOT NULL UNIQUE,
  verification_type public.qc_verification_type NOT NULL,
  status public.qc_verification_study_status NOT NULL DEFAULT 'draft',
  qc_material_name TEXT NOT NULL,
  qc_material_code TEXT,
  lot_number TEXT NOT NULL,
  inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  instrument_id UUID REFERENCES public.instruments(id) ON DELETE SET NULL,
  instrument_name_snapshot TEXT,
  context_key TEXT NOT NULL,
  study_date DATE,
  final_decision public.qc_verification_final_decision,
  final_decision_notes TEXT,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  material_snapshot JSONB,
  prepared_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  prepared_by_name TEXT,
  prepared_by_staff_id TEXT,
  prepared_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_by_name TEXT,
  reviewed_by_staff_id TEXT,
  reviewed_at TIMESTAMPTZ,
  review_comment TEXT,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by_name TEXT,
  approved_by_staff_id TEXT,
  approved_at TIMESTAMPTZ,
  approval_comment TEXT,
  rejected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejected_by_name TEXT,
  rejected_by_staff_id TEXT,
  rejected_at TIMESTAMPTZ,
  rejection_comment TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_qc_lot_verification_active_context
  ON public.qc_lot_verification_studies(context_key)
  WHERE deleted_at IS NULL
    AND status IN ('draft', 'runs_completed', 'pending_review', 'pending_approval');

CREATE INDEX IF NOT EXISTS idx_qc_lot_verification_lookup
  ON public.qc_lot_verification_studies(verification_type, qc_material_name, lot_number, instrument_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.qc_lot_verification_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id UUID NOT NULL REFERENCES public.qc_lot_verification_studies(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL CHECK (day_number BETWEEN 1 AND 5),
  run_number INTEGER NOT NULL CHECK (run_number BETWEEN 1 AND 4),
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_by_name TEXT,
  completed_by_staff_id TEXT,
  completed_at TIMESTAMPTZ,
  UNIQUE (study_id, day_number, run_number)
);

CREATE TABLE IF NOT EXISTS public.qc_lot_verification_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id UUID NOT NULL REFERENCES public.qc_lot_verification_studies(id) ON DELETE CASCADE,
  parameter_code TEXT NOT NULL,
  parameter_name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  manufacturer_mean NUMERIC(16, 6),
  manufacturer_sd NUMERIC(16, 6),
  established_mean NUMERIC(16, 6),
  established_sd NUMERIC(16, 6),
  manufacturer_lower NUMERIC(16, 6),
  manufacturer_upper NUMERIC(16, 6),
  established_lower NUMERIC(16, 6),
  established_upper NUMERIC(16, 6),
  difference NUMERIC(16, 6),
  sdi NUMERIC(16, 6),
  result public.qc_verification_parameter_result NOT NULL DEFAULT 'incomplete',
  UNIQUE (study_id, parameter_code)
);

DROP TRIGGER IF EXISTS trg_qc_lot_verification_studies_updated_at ON public.qc_lot_verification_studies;
CREATE TRIGGER trg_qc_lot_verification_studies_updated_at
  BEFORE UPDATE ON public.qc_lot_verification_studies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.qc_lot_verification_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_lot_verification_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_lot_verification_parameters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qc_lot_verification_studies_select ON public.qc_lot_verification_studies;
CREATE POLICY qc_lot_verification_studies_select ON public.qc_lot_verification_studies
  FOR SELECT TO authenticated USING (deleted_at IS NULL AND public.has_permission('inventory.view'));

DROP POLICY IF EXISTS qc_lot_verification_studies_manage ON public.qc_lot_verification_studies;
CREATE POLICY qc_lot_verification_studies_manage ON public.qc_lot_verification_studies
  FOR ALL TO authenticated
  USING (public.has_permission('inventory.manage'))
  WITH CHECK (public.has_permission('inventory.manage'));

DROP POLICY IF EXISTS qc_lot_verification_runs_select ON public.qc_lot_verification_runs;
CREATE POLICY qc_lot_verification_runs_select ON public.qc_lot_verification_runs
  FOR SELECT TO authenticated USING (public.has_permission('inventory.view'));

DROP POLICY IF EXISTS qc_lot_verification_runs_manage ON public.qc_lot_verification_runs;
CREATE POLICY qc_lot_verification_runs_manage ON public.qc_lot_verification_runs
  FOR ALL TO authenticated
  USING (public.has_permission('inventory.manage'))
  WITH CHECK (public.has_permission('inventory.manage'));

DROP POLICY IF EXISTS qc_lot_verification_parameters_select ON public.qc_lot_verification_parameters;
CREATE POLICY qc_lot_verification_parameters_select ON public.qc_lot_verification_parameters
  FOR SELECT TO authenticated USING (public.has_permission('inventory.view'));

DROP POLICY IF EXISTS qc_lot_verification_parameters_manage ON public.qc_lot_verification_parameters;
CREATE POLICY qc_lot_verification_parameters_manage ON public.qc_lot_verification_parameters
  FOR ALL TO authenticated
  USING (public.has_permission('inventory.manage'))
  WITH CHECK (public.has_permission('inventory.manage'));

COMMIT;
