-- ============================================================================
-- Hematology Section Portal
-- Migration 028: Corrected Results Extended Fields
-- Adds patient_name, lab_accession, status, and notified_to columns.
-- Non-destructive, idempotent — no backfill of existing rows.
-- ============================================================================

ALTER TABLE public.corrected_results
  ADD COLUMN IF NOT EXISTS patient_name TEXT,
  ADD COLUMN IF NOT EXISTS lab_accession TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Open',
  ADD COLUMN IF NOT EXISTS notified_to TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'corrected_results_status_check'
      AND conrelid = 'public.corrected_results'::regclass
  ) THEN
    ALTER TABLE public.corrected_results
      ADD CONSTRAINT corrected_results_status_check
      CHECK (status IS NULL OR status IN ('Open', 'Completed', 'Pending Review'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_corrected_results_lab_accession
  ON public.corrected_results(lab_accession)
  WHERE deleted_at IS NULL AND lab_accession IS NOT NULL;
