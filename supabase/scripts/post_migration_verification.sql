-- ============================================================================
-- POST-MIGRATION VERIFICATION (run in Supabase SQL Editor after 001–010)
-- Read-only checks — safe to run
-- ============================================================================

-- 1. Tables created (expect ~47 public tables)
SELECT COUNT(*) AS public_table_count
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. RLS enabled (expect all application tables)
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

-- 3. Storage buckets (expect 9 private)
SELECT id, name, public AS is_public
FROM storage.buckets
WHERE id IN (
  'patient-documents','sop-documents','policy-documents','qc-files',
  'maintenance-records','competency-files','audit-evidence','certificates','portal-media'
)
ORDER BY id;

-- 4. Storage policies (expect 36)
SELECT COUNT(*) AS storage_policy_count
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects';

-- 5. Reference data (no demo PHI)
SELECT COUNT(*) AS role_count FROM public.roles;           -- expect 13
SELECT COUNT(*) AS permission_count FROM public.permissions; -- expect 54
SELECT COUNT(*) AS role_permission_count FROM public.role_permissions;
SELECT COUNT(*) AS employee_count FROM public.employees;     -- expect 0
SELECT COUNT(*) AS critical_values_count FROM public.critical_values; -- expect 0
SELECT COUNT(*) AS sample_rejections_count FROM public.sample_rejections; -- expect 0

-- 6. Public vs restricted settings
SELECT setting_key, is_public
FROM public.system_settings
ORDER BY setting_key;

-- 7. Functions present
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'handle_new_user','has_permission','log_audit_event',
    'bootstrap_system_admin','audit_trigger_fn'
  )
ORDER BY routine_name;

-- 8. Auth trigger
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';
