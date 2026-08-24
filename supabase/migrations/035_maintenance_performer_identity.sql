-- ============================================================================
-- Migration 035: Maintenance performer identity snapshots
-- Denormalizes performer name/staff_id on maintenance_records (QC pattern).
-- Backfills existing rows where performed_by matches a profile exactly.
-- Idempotent. Non-destructive. Does not change RLS or policies.
-- ============================================================================

BEGIN;

ALTER TABLE public.maintenance_records
  ADD COLUMN IF NOT EXISTS performed_by_name TEXT,
  ADD COLUMN IF NOT EXISTS performed_by_staff_id TEXT;

-- Backfill performer snapshots from linked profiles (performed_by = profiles.id)
UPDATE public.maintenance_records AS m
SET
  performed_by_name = p.full_name,
  performed_by_staff_id = COALESCE(m.performed_by_staff_id, p.staff_id),
  updated_at = NOW()
FROM public.profiles AS p
WHERE m.performed_by = p.id
  AND m.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND (
    m.performed_by_name IS NULL
    OR (m.performed_by_staff_id IS NULL AND p.staff_id IS NOT NULL)
  );

-- Repoint performed_by from legacy employee UUID when created_by is the exact profile
UPDATE public.maintenance_records AS m
SET
  performed_by = m.created_by,
  updated_at = NOW()
WHERE m.deleted_at IS NULL
  AND m.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles AS p WHERE p.id = m.performed_by AND p.deleted_at IS NULL
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles AS p WHERE p.id = m.created_by AND p.deleted_at IS NULL
  )
  AND EXISTS (
    SELECT 1 FROM public.employees AS e WHERE e.id = m.performed_by AND e.deleted_at IS NULL
  );

-- Snapshot after performer repoint
UPDATE public.maintenance_records AS m
SET
  performed_by_name = p.full_name,
  performed_by_staff_id = COALESCE(m.performed_by_staff_id, p.staff_id),
  updated_at = NOW()
FROM public.profiles AS p
WHERE m.performed_by = p.id
  AND m.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND m.performed_by_name IS NULL;

COMMIT;
