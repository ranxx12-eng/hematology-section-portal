-- Deep audit: constraints, columns, grants
SELECT 'columns' AS section, table_name, count(*)::text AS detail
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('fillable_pdf_templates', 'fillable_pdf_fields', 'fillable_pdf_submissions')
GROUP BY table_name
ORDER BY table_name;

SELECT 'constraints' AS section, rel.relname AS table_name, con.conname AS detail
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace n ON n.oid = rel.relnamespace
WHERE n.nspname = 'public'
  AND rel.relname LIKE 'fillable_pdf%'
ORDER BY rel.relname, con.conname;

SELECT 'migration_history' AS section, version, name
FROM supabase_migrations.schema_migrations
WHERE version >= '038'
ORDER BY version;
