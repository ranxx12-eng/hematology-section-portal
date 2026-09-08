SELECT
  p.id AS profile_id,
  p.email,
  p.full_name,
  p.staff_id,
  p.employee_id,
  p.is_active,
  r.name AS primary_role,
  e.employee_code,
  e.role AS operational_role
FROM public.profiles p
LEFT JOIN public.roles r ON r.id = p.primary_role_id
LEFT JOIN public.employees e ON e.id = p.employee_id AND e.deleted_at IS NULL
WHERE p.deleted_at IS NULL
  AND (
    lower(p.full_name) LIKE '%rawan%alheta%'
    OR lower(p.email) LIKE '%rawan.alhetah%'
    OR lower(trim(p.staff_id)) = '439396'
  );

SELECT ur.user_id, rr.name AS role_name, ur.is_active, ur.expires_at
FROM public.user_roles ur
JOIN public.roles rr ON rr.id = ur.role_id
WHERE ur.user_id IN (
  SELECT p.id FROM public.profiles p
  WHERE p.deleted_at IS NULL
    AND (
      lower(p.full_name) LIKE '%rawan%alheta%'
      OR lower(p.email) LIKE '%rawan.alhetah%'
      OR lower(trim(p.staff_id)) = '439396'
    )
);
