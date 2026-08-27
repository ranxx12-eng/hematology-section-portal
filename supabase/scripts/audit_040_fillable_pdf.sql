-- Audit migration 040 fillable PDF objects (single result set)
SELECT json_build_object(
  'tables', (
    SELECT COALESCE(json_agg(json_build_object(
      'name', c.relname,
      'rls', CASE WHEN c.relrowsecurity THEN 'enabled' ELSE 'disabled' END
    ) ORDER BY c.relname), '[]'::json)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('fillable_pdf_templates', 'fillable_pdf_fields', 'fillable_pdf_submissions')
      AND c.relkind = 'r'
  ),
  'indexes', (
    SELECT COALESCE(json_agg(indexname ORDER BY tablename, indexname), '[]'::json)
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN ('fillable_pdf_templates', 'fillable_pdf_fields', 'fillable_pdf_submissions')
  ),
  'triggers', (
    SELECT COALESCE(json_agg(tgname ORDER BY tgname), '[]'::json)
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND NOT t.tgisinternal
      AND tgname LIKE '%fillable_pdf%'
  ),
  'functions', (
    SELECT COALESCE(json_agg(proname ORDER BY proname), '[]'::json)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('set_updated_at', 'can_access_form_design', 'can_manage_form_responses', 'can_submit_forms', 'is_published_form')
  ),
  'table_policies', (
    SELECT COALESCE(json_agg(json_build_object('table', c.relname, 'policy', pol.polname) ORDER BY c.relname, pol.polname), '[]'::json)
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('fillable_pdf_templates', 'fillable_pdf_fields', 'fillable_pdf_submissions')
  ),
  'storage_policies', (
    SELECT COALESCE(json_agg(pol.polname ORDER BY pol.polname), '[]'::json)
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage'
      AND c.relname = 'objects'
      AND pol.polname LIKE '%fillable%'
  ),
  'bucket', (
    SELECT COALESCE(json_agg(json_build_object('id', id, 'public', public)), '[]'::json)
    FROM storage.buckets WHERE id = 'fillable-forms'
  ),
  'hema001', (
    SELECT json_build_object(
      'exists', EXISTS(SELECT 1 FROM public.fillable_pdf_templates WHERE id = 'a1000000-0000-4000-8000-000000000001'),
      'field_count', (SELECT count(*) FROM public.fillable_pdf_fields WHERE template_id = 'a1000000-0000-4000-8000-000000000001' AND deleted_at IS NULL)
    )
  )
) AS audit;
