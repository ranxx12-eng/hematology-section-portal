-- Read-only status check for Alhanouf Khalaf / Staff ID 244741
-- Production audit (2026-09-06): NO matching auth.users or profiles records exist.
-- The two profiles awaiting Staff ID are admin@hematology.local and
-- alanoud.alhamdan@dr.sulimanalhabib.com — not Alhanouf Khalaf.
--
-- STOP: Do not run write corrections until an existing auth user/profile is identified
-- or separate approval is given to create a new auth account.

SELECT 'auth.users' AS source, u.id::text, u.email::text, NULL::text AS full_name, NULL::text AS staff_id
FROM auth.users u
WHERE lower(u.email) LIKE '%alhanouf%'
   OR lower(u.email) LIKE '%khalaf%'
UNION ALL
SELECT 'profiles', p.id::text, p.email::text, p.full_name, p.staff_id
FROM public.profiles p
WHERE p.deleted_at IS NULL
  AND (
    lower(p.full_name) LIKE '%alhanouf%'
    OR lower(p.full_name) LIKE '%khalaf%'
    OR lower(trim(p.staff_id)) = '244741'
  )
UNION ALL
SELECT 'employees', e.id::text, e.email::text, e.full_name, e.employee_code
FROM public.employees e
WHERE e.deleted_at IS NULL
  AND lower(trim(e.employee_code)) = '244741';
