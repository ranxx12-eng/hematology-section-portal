-- PROPOSED production data correction — DO NOT RUN without explicit approval.
-- Rawan Alheta (rawan.alhetah@hmg.local, staff_id 439396)
-- Profile UUID: 49124e39-0236-4079-b756-f8c8f79bf27a
-- Employee UUID: 543aab69-427c-41b3-9fab-76c410faf9aa

BEGIN;

UPDATE public.profiles
SET
  primary_role_id = (SELECT id FROM public.roles WHERE name = 'lab_technologist'::public.app_role LIMIT 1),
  updated_at = NOW()
WHERE id = '49124e39-0236-4079-b756-f8c8f79bf27a'
  AND deleted_at IS NULL;

UPDATE public.user_roles ur
SET is_active = FALSE, updated_at = NOW()
FROM public.roles r
WHERE ur.role_id = r.id
  AND ur.user_id = '49124e39-0236-4079-b756-f8c8f79bf27a'
  AND r.name IN ('read_only'::public.app_role, 'viewer'::public.app_role)
  AND ur.is_active = TRUE;

INSERT INTO public.user_roles (user_id, role_id, assigned_by, is_active)
SELECT
  '49124e39-0236-4079-b756-f8c8f79bf27a',
  r.id,
  '49124e39-0236-4079-b756-f8c8f79bf27a',
  TRUE
FROM public.roles r
WHERE r.name = 'lab_technologist'::public.app_role
ON CONFLICT (user_id, role_id) DO UPDATE
  SET is_active = TRUE, updated_at = NOW();

COMMIT;
