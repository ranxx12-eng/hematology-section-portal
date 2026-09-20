#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${FORM_HEMA_022_TEST_DB:-hematology_form_hema_022_test}"
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@16/bin}"
export PATH="$PG_BIN:$PATH"

echo "Recreating disposable database: $DB_NAME"
dropdb --if-exists "$DB_NAME"
createdb "$DB_NAME"

psql -v ON_ERROR_STOP=1 -d "$DB_NAME" <<'SQL'
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.test_user_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.test_role', true), ''), 'authenticated');
$$;

GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
SQL

MIGRATIONS=(
  001_extensions_and_types.sql
  002_core_auth_rbac_schema.sql
  003_operational_schema.sql
  004_indexes_and_triggers.sql
  005_rls_helpers.sql
  033_profiles_staff_id.sql
  062_inventory_module_extension.sql
  072_form_hema_022_enum.sql
  073_form_hema_022_schema_and_activation.sql
  074_reagent_lot_workflow_enforcement.sql
)

for name in "${MIGRATIONS[@]}"; do
  file="$ROOT/supabase/migrations/$name"
  echo "Applying $name..."
  psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$file"
done

echo "Local database ready: $DB_NAME"
