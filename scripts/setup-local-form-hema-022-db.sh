#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${FORM_HEMA_022_TEST_DB:-hematology_form_hema_022_test}"
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@16/bin}"
export PATH="$PG_BIN:$PATH"
LOG_DIR="${ROOT}/tmp/local-migration-log"
mkdir -p "$LOG_DIR"

echo "Recreating disposable database: $DB_NAME"
dropdb --if-exists "$DB_NAME"
createdb "$DB_NAME"

psql -v ON_ERROR_STOP=1 -d "$DB_NAME" <<'SQL'
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE supabase_admin NOLOGIN SUPERUSER; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS realtime;
CREATE SCHEMA IF NOT EXISTS graphql_public;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY,
  email TEXT,
  raw_user_meta_data JSONB,
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

CREATE OR REPLACE FUNCTION storage.foldername(name text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT string_to_array(name, '/');
$$;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  public BOOLEAN NOT NULL DEFAULT FALSE,
  file_size_limit BIGINT,
  allowed_mime_types TEXT[]
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT NOT NULL REFERENCES storage.buckets(id),
  name TEXT NOT NULL,
  owner UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ,
  metadata JSONB
);

GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA storage TO authenticated, anon, service_role;
SQL

apply_migration() {
  local file="$1"
  local name
  name="$(basename "$file")"
  echo "Applying $name..."
  if psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$file" >"$LOG_DIR/$name.log" 2>&1; then
    echo "  OK $name"
    return 0
  fi
  echo "  FAIL $name (see $LOG_DIR/$name.log)" >&2
  tail -8 "$LOG_DIR/$name.log" >&2 || true
  return 1
}

FAILED=()
while IFS= read -r file; do
  num="$(basename "$file" | sed -E 's/^0*([0-9]+)_.*/\1/')"
  if [ "$num" -le 71 ]; then
    apply_migration "$file" || FAILED+=("$(basename "$file")")
  fi
done < <(ls "$ROOT/supabase/migrations"/[0-9][0-9][0-9]_*.sql | sort)

if [ "${#FAILED[@]}" -gt 0 ]; then
  echo "Baseline 001-071 incomplete; Form-Hema-022 migrations were not applied." >&2
  echo "Migration failures: ${FAILED[*]}" >&2
  exit 1
fi

while IFS= read -r file; do
  num="$(basename "$file" | sed -E 's/^0*([0-9]+)_.*/\1/')"
  if [ "$num" -ge 72 ] && [ "$num" -le 75 ]; then
    apply_migration "$file" || FAILED+=("$(basename "$file")")
  fi
done < <(ls "$ROOT/supabase/migrations"/[0-9][0-9][0-9]_*.sql | sort)

if [ "${#FAILED[@]}" -gt 0 ]; then
  echo "Form-Hema-022 migration failures: ${FAILED[*]}" >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -c "ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_user_meta_data JSONB;"

echo "Local database ready: $DB_NAME (001-071 + 072-075 applied)"
