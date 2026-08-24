-- ============================================================================
-- Migration 036: Critical Values read_back field
-- Historical rows backfilled to TRUE (Read Back = Yes).
-- New rows require explicit TRUE/FALSE from the application (no DB default).
-- Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE public.critical_values
  ADD COLUMN IF NOT EXISTS read_back BOOLEAN;

UPDATE public.critical_values
SET read_back = TRUE
WHERE read_back IS NULL;

ALTER TABLE public.critical_values
  ALTER COLUMN read_back SET NOT NULL;

COMMIT;
