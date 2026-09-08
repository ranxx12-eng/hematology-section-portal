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
