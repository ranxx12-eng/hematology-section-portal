SELECT
  p.id AS profile_id,
  p.email,
  p.full_name,
  p.staff_id,
  p.employee_id,
  p.is_active,
  p.deleted_at,
  r.name AS portal_role,
  u.email AS auth_email,
  (u.email_confirmed_at IS NOT NULL) AS email_confirmed,
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
