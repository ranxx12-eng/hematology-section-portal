-- Verification queries for migrations 011-025 (read-only)
-- Run: supabase db query --linked -f supabase/.temp/verify_migrations_011_025.sql

\echo '=== 011: system_admin clinical permissions ==='
SELECT p.code, rp.deleted_at IS NULL AS active
FROM public.role_permissions rp
JOIN public.roles r ON r.id = rp.role_id
JOIN public.permissions p ON p.id = rp.permission_id
WHERE r.name = 'system_admin'
  AND p.code IN ('qc.view','qc.manage','critical_values.view','critical_values.manage',
    'sample_rejections.view','sample_rejections.manage','corrected_results.view',
    'corrected_results.manage','tat.view','tat.manage','instruments.view','employees.view')
ORDER BY p.code;

\echo '=== 012: qc operational workflow ==='
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'qc_records'
  AND column_name IN ('qc_status','resolution_status','corrective_actions','status')
ORDER BY column_name;

SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qc_in_out') AS has_qc_in_out,
       EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qc_resolution_status') AS has_qc_resolution_status;

\echo '=== 013: qc_batch_id ==='
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'qc_records' AND column_name = 'qc_batch_id';

SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'qc_records' AND indexname = 'idx_qc_records_qc_batch_id';

\echo '=== 014: qc live view ==='
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'instruments' AND column_name = 'live_view_slug';

SELECT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'qc_live_view') AS has_qc_live_view;
SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND proname IN ('get_qc_live_instrument','get_qc_live_records');
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'qc_live_access_log') AS has_qc_live_access_log;

\echo '=== 015: lab technologist permissions (soft-delete version) ==='
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'role_permissions' AND column_name = 'deleted_at';

SELECT pg_get_functiondef(p.oid) LIKE '%rp.deleted_at IS NULL%' AS has_permission_checks_soft_delete
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'has_permission';

SELECT r.name, p.code, rp.deleted_at IS NULL AS active, rp.deleted_at
FROM public.role_permissions rp
JOIN public.roles r ON r.id = rp.role_id
JOIN public.permissions p ON p.id = rp.permission_id
WHERE r.name IN ('lab_technologist','senior_lab_technologist')
  AND p.code IN ('qc.manage','critical_values.manage','sample_rejections.manage','maintenance.view')
ORDER BY r.name, p.code;

\echo '=== 016: restore maintenance.view ==='
SELECT r.name, p.code, rp.deleted_at IS NULL AS active
FROM public.role_permissions rp
JOIN public.roles r ON r.id = rp.role_id
JOIN public.permissions p ON p.id = rp.permission_id
WHERE r.name = 'lab_technologist' AND p.code = 'maintenance.view';

\echo '=== 017-024: table existence ==='
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('announcements','calendar_events','media_folders','media_assets',
    'dynamic_forms','form_fields','form_submissions','report_templates',
    'dashboard_layouts','notification_preferences')
ORDER BY table_name;

\echo '=== 023: cms settings ==='
SELECT setting_key FROM public.system_settings
WHERE setting_key IN ('cms_pages','cms_navigation','cms_dashboard_widgets','cms_homepage','cms_branding')
ORDER BY setting_key;

\echo '=== 025: extended_portal ==='
SELECT setting_key, is_public FROM public.system_settings WHERE setting_key = 'extended_portal';

\echo '=== migration history (011-025) ==='
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE version >= '011' ORDER BY version;
