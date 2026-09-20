-- ============================================================================
-- Migration 072: Form-Hema-022 enum extension (run before 073)
-- PostgreSQL requires new enum values in a separate committed transaction
-- before they are referenced by functions or CHECK constraints in 073.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'inventory_lot_interpretation' AND e.enumlabel = 'cannot_calculate'
  ) THEN
    ALTER TYPE public.inventory_lot_interpretation ADD VALUE 'cannot_calculate';
  END IF;
END $$;
