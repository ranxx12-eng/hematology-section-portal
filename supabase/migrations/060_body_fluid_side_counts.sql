-- ============================================================================
-- Migration 060: Body Fluid optional Side 2 per technologist
-- Does NOT auto-apply.
-- ============================================================================

BEGIN;

ALTER TABLE public.body_fluid_count_entries
  ADD COLUMN IF NOT EXISTS side_number SMALLINT NOT NULL DEFAULT 1;

UPDATE public.body_fluid_count_entries
SET side_number = 1
WHERE side_number IS NULL;

ALTER TABLE public.body_fluid_count_entries
  DROP CONSTRAINT IF EXISTS body_fluid_count_unique;

ALTER TABLE public.body_fluid_count_entries
  ADD CONSTRAINT body_fluid_count_side_check CHECK (side_number IN (1, 2));

ALTER TABLE public.body_fluid_count_entries
  ADD CONSTRAINT body_fluid_count_unique
  UNIQUE (worksheet_id, tech_number, side_number, cell_type, square_number);

CREATE INDEX IF NOT EXISTS idx_body_fluid_counts_worksheet_side
  ON public.body_fluid_count_entries(worksheet_id, tech_number, side_number, cell_type);

COMMIT;
