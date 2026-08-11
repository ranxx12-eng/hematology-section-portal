-- ============================================================================
-- Hematology Section Portal
-- Migration 013: QC batch ID for All Parameters submissions
-- Groups individual parameter records from one All Parameters workflow run
-- ============================================================================

ALTER TABLE public.qc_records
  ADD COLUMN IF NOT EXISTS qc_batch_id UUID;

CREATE INDEX IF NOT EXISTS idx_qc_records_qc_batch_id
  ON public.qc_records(qc_batch_id)
  WHERE deleted_at IS NULL AND qc_batch_id IS NOT NULL;
