-- Read-only production reconciliation for employee portal link status (Phase 1)
-- Do not modify data.

-- Per-employee link reconciliation
SELECT
  e.id AS employee_id,
  e.employee_code,
  e.full_name,
  e.is_active AS employee_active,
  p.id AS profile_id,
  p.employee_id AS profile_employee_id,
  p.staff_id,
  p.is_active AS profile_active,
  p.deleted_at AS profile_deleted_at,
  r.name AS portal_role,
  (p.id IS NOT NULL AND p.employee_id = e.id AND p.deleted_at IS NULL) AS satisfies_link
FROM public.employees e
LEFT JOIN public.profiles p
  ON p.employee_id = e.id
 AND p.deleted_at IS NULL
LEFT JOIN public.roles r ON r.id = p.primary_role_id
WHERE e.deleted_at IS NULL
ORDER BY e.full_name;

-- Summary counts
SELECT
  (SELECT count(*) FROM public.employees WHERE deleted_at IS NULL AND is_active = TRUE) AS active_employees,
  (SELECT count(*) FROM public.profiles WHERE deleted_at IS NULL AND is_active = TRUE AND employee_id IS NOT NULL) AS linked_active_profiles,
  (SELECT count(*)
   FROM public.employees e
   WHERE e.deleted_at IS NULL
     AND EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.deleted_at IS NULL AND p.employee_id = e.id
     )) AS employees_with_matching_linked_profile,
  (SELECT count(*)
   FROM public.employees e
   WHERE e.deleted_at IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.deleted_at IS NULL AND p.employee_id = e.id
     )) AS employees_without_linked_profile,
  (SELECT count(*)
   FROM public.profiles
   WHERE deleted_at IS NULL
     AND (staff_id IS NULL OR length(trim(staff_id)) = 0)) AS profiles_without_staff_id,
  (SELECT count(*)
   FROM (
     SELECT lower(trim(staff_id))
     FROM public.profiles
     WHERE deleted_at IS NULL AND staff_id IS NOT NULL AND length(trim(staff_id)) > 0
     GROUP BY 1 HAVING count(*) > 1
   ) d) AS duplicate_normalized_staff_ids,
  (SELECT count(*)
   FROM (
     SELECT lower(trim(employee_code))
     FROM public.employees
     WHERE deleted_at IS NULL
     GROUP BY 1 HAVING count(*) > 1
   ) d) AS duplicate_normalized_employee_codes,
  (SELECT count(*)
   FROM public.profiles p
   WHERE p.deleted_at IS NULL
     AND p.employee_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.employees e
       WHERE e.id = p.employee_id AND e.deleted_at IS NULL
     )) AS profiles_linked_to_nonexistent_employee,
  (SELECT count(*)
   FROM (
     SELECT p.employee_id
     FROM public.profiles p
     WHERE p.deleted_at IS NULL AND p.employee_id IS NOT NULL
     GROUP BY p.employee_id HAVING count(*) > 1
   ) d) AS employees_linked_to_multiple_profiles;

-- Alhanouf Khalaf / Staff ID 244741
SELECT 'alhanouf_profile' AS section,
  p.id AS profile_id,
  p.email,
  p.full_name,
  p.staff_id,
  p.employee_id,
  p.is_active,
  p.deleted_at,
  r.name AS portal_role,
  u.email AS auth_email,
  u.email_confirmed_at IS NOT NULL AS email_confirmed,
  u.banned_until,
  u.deleted_at AS auth_deleted_at
FROM public.profiles p
LEFT JOIN public.roles r ON r.id = p.primary_role_id
LEFT JOIN auth.users u ON u.id = p.id
WHERE p.deleted_at IS NULL
  AND (
    lower(p.full_name) LIKE '%alhanouf%khalaf%'
    OR lower(p.email) LIKE '%alhanouf%'
    OR lower(trim(p.staff_id)) = '244741'
  );

SELECT 'staff_id_244741' AS section,
  'profile' AS entity,
  p.id::text AS id,
  p.email::text,
  p.full_name,
  p.staff_id,
  p.employee_id::text,
  p.is_active
FROM public.profiles p
WHERE p.deleted_at IS NULL AND lower(trim(p.staff_id)) = '244741'
UNION ALL
SELECT 'staff_id_244741',
  'employee',
  e.id::text,
  e.email::text,
  e.full_name,
  e.employee_code,
  NULL::text,
  e.is_active
FROM public.employees e
WHERE e.deleted_at IS NULL AND lower(trim(e.employee_code)) = '244741';

-- Rawan Alheta authorization
SELECT 'rawan_alheta' AS section,
  p.id AS profile_id,
  p.email,
  p.full_name,
  p.staff_id,
  p.employee_id,
  p.is_active,
  r.name AS primary_role,
  e.employee_code,
  e.role AS operational_role,
  (
    SELECT json_agg(json_build_object(
      'role', rr.name,
      'is_active', ur.is_active,
      'expires_at', ur.expires_at
    ) ORDER BY rr.name)
    FROM public.user_roles ur
    JOIN public.roles rr ON rr.id = ur.role_id
    WHERE ur.user_id = p.id
  ) AS user_roles
FROM public.profiles p
LEFT JOIN public.roles r ON r.id = p.primary_role_id
LEFT JOIN public.employees e ON e.id = p.employee_id AND e.deleted_at IS NULL
WHERE p.deleted_at IS NULL
  AND (
    lower(p.full_name) LIKE '%rawan%alheta%'
    OR lower(p.email) LIKE '%rawan.alhetah%'
    OR lower(trim(p.staff_id)) = '439396'
  );
