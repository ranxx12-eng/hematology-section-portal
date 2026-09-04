-- ============================================================================
-- Migration 062: Inventory module extension (Store, Lot in Use, Reagent Lot-to-Lot)
-- Does NOT auto-apply.
-- QC Lot Verification is provided by migration 063 (qc_lot_verification_*).
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'inventory_status' AND e.enumlabel = 'quarantined'
  ) THEN
    ALTER TYPE public.inventory_status ADD VALUE 'quarantined';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'inventory_status' AND e.enumlabel = 'inactive'
  ) THEN
    ALTER TYPE public.inventory_status ADD VALUE 'inactive';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_lot_usage_status') THEN
    CREATE TYPE public.inventory_lot_usage_status AS ENUM (
      'active',
      'due_to_expire',
      'expired',
      'replacement_pending',
      'closed',
      'superseded'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_lot_study_status') THEN
    CREATE TYPE public.inventory_lot_study_status AS ENUM (
      'draft',
      'submitted',
      'pending_review',
      'pending_approval',
      'approved',
      'returned',
      'rejected'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_lot_interpretation') THEN
    CREATE TYPE public.inventory_lot_interpretation AS ENUM (
      'incomplete',
      'criteria_not_configured',
      'acceptable',
      'not_acceptable',
      'manual_review'
    );
  END IF;
END $$;

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS item_code TEXT,
  ADD COLUMN IF NOT EXISTS reorder_level NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.inventory_lot_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  item_name_snapshot TEXT NOT NULL,
  category_snapshot TEXT NOT NULL,
  lot_number_snapshot TEXT NOT NULL,
  manufacturer_snapshot TEXT,
  context_key TEXT NOT NULL,
  instrument_id UUID REFERENCES public.instruments(id) ON DELETE SET NULL,
  instrument_name_snapshot TEXT,
  test_parameter TEXT,
  method_name TEXT,
  start_date DATE,
  open_date DATE,
  expiry_date DATE,
  open_vial_expiry_date DATE,
  quantity_remaining NUMERIC(12, 2),
  status public.inventory_lot_usage_status NOT NULL DEFAULT 'active',
  started_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_by_name TEXT,
  started_by_staff_id TEXT,
  superseded_by_usage_id UUID REFERENCES public.inventory_lot_usage(id) ON DELETE SET NULL,
  reagent_comparison_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_lot_usage_active_context
  ON public.inventory_lot_usage(context_key)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_inventory_lot_usage_item
  ON public.inventory_lot_usage(inventory_item_id, status);

CREATE TABLE IF NOT EXISTS public.inventory_reagent_lot_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_number TEXT NOT NULL UNIQUE,
  status public.inventory_lot_study_status NOT NULL DEFAULT 'draft',
  instrument_id UUID REFERENCES public.instruments(id) ON DELETE SET NULL,
  instrument_name_snapshot TEXT,
  reagent_name TEXT NOT NULL,
  test_parameter TEXT,
  old_lot_number TEXT NOT NULL,
  new_lot_number TEXT NOT NULL,
  old_store_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  new_store_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  study_date DATE,
  acceptance_criteria_configured BOOLEAN NOT NULL DEFAULT FALSE,
  acceptance_max_difference_percent NUMERIC(10, 4),
  conclusion TEXT,
  comments TEXT,
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
  old_lot_snapshot JSONB,
  new_lot_snapshot JSONB,
  activated_at TIMESTAMPTZ,
  activated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.inventory_reagent_lot_comparison_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comparison_id UUID NOT NULL REFERENCES public.inventory_reagent_lot_comparisons(id) ON DELETE CASCADE,
  sample_number INTEGER NOT NULL CHECK (sample_number >= 1),
  old_result NUMERIC(14, 6),
  new_result NUMERIC(14, 6),
  difference_units NUMERIC(14, 6),
  difference_percent NUMERIC(10, 4),
  acceptance_criterion_text TEXT,
  interpretation public.inventory_lot_interpretation NOT NULL DEFAULT 'incomplete',
  comment TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_reagent_lot_results_unique UNIQUE (comparison_id, sample_number)
);

CREATE TABLE IF NOT EXISTS public.inventory_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  lot_number TEXT,
  action TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name TEXT,
  staff_id TEXT,
  comment TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_audit_entity
  ON public.inventory_audit_events(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_audit_item
  ON public.inventory_audit_events(inventory_item_id, created_at DESC);

ALTER TABLE public.inventory_lot_usage
  ADD CONSTRAINT inventory_lot_usage_reagent_comparison_fk
  FOREIGN KEY (reagent_comparison_id) REFERENCES public.inventory_reagent_lot_comparisons(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS trg_inventory_lot_usage_updated_at ON public.inventory_lot_usage;
CREATE TRIGGER trg_inventory_lot_usage_updated_at
  BEFORE UPDATE ON public.inventory_lot_usage
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_inventory_reagent_lot_comparisons_updated_at ON public.inventory_reagent_lot_comparisons;
CREATE TRIGGER trg_inventory_reagent_lot_comparisons_updated_at
  BEFORE UPDATE ON public.inventory_reagent_lot_comparisons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.inventory_lot_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reagent_lot_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reagent_lot_comparison_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_lot_usage_select ON public.inventory_lot_usage;
CREATE POLICY inventory_lot_usage_select ON public.inventory_lot_usage
  FOR SELECT TO authenticated USING (public.has_permission('inventory.view'));

DROP POLICY IF EXISTS inventory_lot_usage_manage ON public.inventory_lot_usage;
CREATE POLICY inventory_lot_usage_manage ON public.inventory_lot_usage
  FOR ALL TO authenticated
  USING (public.has_permission('inventory.manage'))
  WITH CHECK (public.has_permission('inventory.manage'));

DROP POLICY IF EXISTS inventory_reagent_lot_select ON public.inventory_reagent_lot_comparisons;
CREATE POLICY inventory_reagent_lot_select ON public.inventory_reagent_lot_comparisons
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('inventory.view'));

DROP POLICY IF EXISTS inventory_reagent_lot_manage ON public.inventory_reagent_lot_comparisons;
CREATE POLICY inventory_reagent_lot_manage ON public.inventory_reagent_lot_comparisons
  FOR ALL TO authenticated
  USING (public.has_permission('inventory.manage'))
  WITH CHECK (public.has_permission('inventory.manage'));

DROP POLICY IF EXISTS inventory_reagent_lot_results_all ON public.inventory_reagent_lot_comparison_results;
CREATE POLICY inventory_reagent_lot_results_all ON public.inventory_reagent_lot_comparison_results
  FOR ALL TO authenticated
  USING (public.has_permission('inventory.view'))
  WITH CHECK (public.has_permission('inventory.manage'));

DROP POLICY IF EXISTS inventory_audit_select ON public.inventory_audit_events;
CREATE POLICY inventory_audit_select ON public.inventory_audit_events
  FOR SELECT TO authenticated USING (public.has_permission('inventory.view'));

DROP POLICY IF EXISTS inventory_audit_insert ON public.inventory_audit_events;
CREATE POLICY inventory_audit_insert ON public.inventory_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('inventory.manage'));

COMMIT;
