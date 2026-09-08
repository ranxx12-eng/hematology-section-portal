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
