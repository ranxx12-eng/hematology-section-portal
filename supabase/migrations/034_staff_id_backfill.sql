-- ============================================================================
-- Migration 034: Backfill verified Hospital Staff IDs on profiles
-- Idempotent. Email-exact match only. Does not alter schema, RLS, or policies.
-- ============================================================================

BEGIN;

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
  AND p.is_active = TRUE
  AND (p.staff_id IS NULL OR p.staff_id = v.staff_id);

COMMIT;
