-- ============================================================================
-- Migration 037: Critical Values multi-test storage (test_names TEXT[])
-- Backfills existing single test_name values into test_names array.
-- Keeps test_name synced for legacy readers (first selected test).
-- Idempotent. Does not modify read_back (migration 036).
-- ============================================================================

BEGIN;

ALTER TABLE public.critical_values
  ADD COLUMN IF NOT EXISTS test_names TEXT[];

UPDATE public.critical_values
SET test_names = ARRAY[test_name]
WHERE test_name IS NOT NULL
  AND btrim(test_name) <> ''
  AND (
    test_names IS NULL
    OR cardinality(test_names) = 0
  );

UPDATE public.critical_values
SET test_names = ARRAY[]::TEXT[]
WHERE test_names IS NULL;

ALTER TABLE public.critical_values
  ALTER COLUMN test_names SET NOT NULL;

COMMIT;
