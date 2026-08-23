-- ============================================================================
-- Hematology Section Portal
-- Migration 029: Critical Values Escalation Field
-- Adds escalation_to for "In Case of Escalation" selection.
-- Non-destructive, idempotent — no backfill of existing rows.
-- ============================================================================

ALTER TABLE public.critical_values
  ADD COLUMN IF NOT EXISTS escalation_to TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'critical_values_escalation_to_check'
      AND conrelid = 'public.critical_values'::regclass
  ) THEN
    ALTER TABLE public.critical_values
      ADD CONSTRAINT critical_values_escalation_to_check
      CHECK (
        escalation_to IS NULL
        OR escalation_to IN ('ER Physician', 'Medical Administration', 'None')
      );
  END IF;
END $$;
