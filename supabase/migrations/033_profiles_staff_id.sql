-- ============================================================================
-- Migration 033: Hospital Staff ID on profiles
-- Canonical portal identifier: profiles.staff_id (employees.employee_code for HR rows).
-- Idempotent. Does not modify auth or invent IDs for existing users.
-- ============================================================================

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS staff_id TEXT;

COMMENT ON COLUMN public.profiles.staff_id IS
  'Hospital Staff ID / Employee ID visible to users. Internal auth remains profiles.id UUID.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_staff_id_unique
  ON public.profiles (lower(trim(staff_id)))
  WHERE deleted_at IS NULL
    AND staff_id IS NOT NULL
    AND length(trim(staff_id)) > 0;

-- ---------------------------------------------------------------------------
-- Backfill verified Hospital Staff IDs (exact email match only; idempotent)
-- Does not modify admin@hematology.local or unverified profiles.
-- Alanoud duplicate (dr.sulimanalhabib.com) intentionally excluded.
-- Alhanouf Khalaf (244741): no matching active profile found — left NULL.
-- ---------------------------------------------------------------------------
UPDATE public.profiles AS p
SET
  staff_id = v.staff_id,
  updated_at = NOW()
FROM (
  VALUES
    ('rawan.alfaifi@drsulaimanalhabib.com', '399894'),
    ('abdullah.alghayamh@drsulaimanalhabib.com', '280103'),
    ('ahmed.al-asiri@hmg.local', '412866'),
    ('mousa.alrashedi@hmg.local', '446382'),
    ('alanoud.alhamdan@dr.sulaimanalhabib.com', '440924'),
    ('renad.alimani@hmg.local', '438584'),
    ('nahlaa.mohammed@hmg.local', '404777'),
    ('rawan.albalawe@hmg.local', '413861'),
    ('rawan.alhetah@hmg.local', '439396'),
    ('hamzah.nammazi@hmg.local', '433112'),
    ('fatimah.alsayed@hmg.local', '435124'),
    ('shereen.khaled@drsulaimanalhabib.com', '7479')
) AS v(email, staff_id)
WHERE lower(p.email::text) = lower(v.email)
  AND p.deleted_at IS NULL
  AND (p.staff_id IS NULL OR p.staff_id = v.staff_id);

-- HR / admin may update staff_id on other profiles (not self — enforced by trigger)
CREATE POLICY profiles_hr_staff_id_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND id <> auth.uid()
    AND public.has_permission('employees.manage')
  )
  WITH CHECK (public.has_permission('employees.manage'));

CREATE OR REPLACE FUNCTION public.protect_profile_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id = auth.uid() AND NOT public.has_permission('users.manage') THEN
    IF NEW.primary_role_id IS DISTINCT FROM OLD.primary_role_id THEN
      RAISE EXCEPTION 'Cannot change your own role';
    END IF;
    IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
      RAISE EXCEPTION 'Cannot change your own employee link';
    END IF;
    IF NEW.staff_id IS DISTINCT FROM OLD.staff_id THEN
      RAISE EXCEPTION 'Cannot change your own staff ID';
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Cannot change your own active status';
    END IF;
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      RAISE EXCEPTION 'Cannot modify your own deletion status';
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Cannot change email directly';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_profile_safe_self_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id = auth.uid() AND NOT public.has_permission('users.manage') THEN
    NEW.primary_role_id := OLD.primary_role_id;
    NEW.employee_id := OLD.employee_id;
    NEW.staff_id := OLD.staff_id;
    NEW.is_active := OLD.is_active;
    NEW.deleted_at := OLD.deleted_at;
    NEW.email := OLD.email;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
