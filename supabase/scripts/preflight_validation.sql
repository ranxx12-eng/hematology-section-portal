-- ============================================================================
-- Preflight Validation Script
-- Run BEFORE applying migrations to a Supabase project.
-- Usage: psql $DATABASE_URL -f supabase/scripts/preflight_validation.sql
-- Does NOT modify schema. Read-only checks.
-- ============================================================================

DO $$
DECLARE
  v_errors TEXT[] := ARRAY[]::TEXT[];
  v_warnings TEXT[] := ARRAY[]::TEXT[];
  v_count INTEGER;
BEGIN
  -- Required extensions
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    v_warnings := array_append(v_warnings, 'Extension pgcrypto not installed (migration 001 will install it)');
  END IF;

  -- Conflicting legacy tables
  SELECT COUNT(*) INTO v_count FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name IN ('profiles', 'roles', 'employees', 'critical_values');
  IF v_count > 0 THEN
    v_errors := array_append(v_errors, format('Found %s existing public tables — migrations target empty database or require review', v_count));
  END IF;

  -- Conflicting migration history
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations') THEN
    SELECT COUNT(*) INTO v_count FROM supabase_migrations.schema_migrations;
    IF v_count > 0 THEN
      v_warnings := array_append(v_warnings, format('supabase_migrations.schema_migrations has %s entries — verify migration order', v_count));
    END IF;
  END IF;

  -- Auth schema accessible
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    v_errors := array_append(v_errors, 'auth schema not found — Supabase Auth required');
  END IF;

  -- Storage schema accessible
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    v_warnings := array_append(v_warnings, 'storage schema not found — storage migration 008 requires Supabase Storage');
  END IF;

  -- Report
  RAISE NOTICE '=== PREFLIGHT VALIDATION ===';
  IF array_length(v_errors, 1) IS NULL AND array_length(v_warnings, 1) IS NULL THEN
    RAISE NOTICE 'PASS: No blocking issues detected for empty-database migration.';
  END IF;

  IF array_length(v_errors, 1) IS NOT NULL THEN
    RAISE NOTICE 'ERRORS (%):', array_length(v_errors, 1);
    FOR v_count IN 1..array_length(v_errors, 1) LOOP
      RAISE NOTICE '  [ERROR] %', v_errors[v_count];
    END LOOP;
  END IF;

  IF array_length(v_warnings, 1) IS NOT NULL THEN
    RAISE NOTICE 'WARNINGS (%):', array_length(v_warnings, 1);
    FOR v_count IN 1..array_length(v_warnings, 1) LOOP
      RAISE NOTICE '  [WARN] %', v_warnings[v_count];
    END LOOP;
  END IF;

  RAISE NOTICE 'Expected migration order: 001 → 010 (production). Seed: seeds/development_seed.sql (dev only).';
  RAISE NOTICE '=== END PREFLIGHT ===';

  IF array_length(v_errors, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Preflight validation failed with % error(s)', array_length(v_errors, 1);
  END IF;
END $$;
