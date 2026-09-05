#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LOCAL_SUPABASE_DB_PORT="${LOCAL_SUPABASE_DB_PORT:-54322}"
DEFAULT_LOCAL_DB_URL="postgresql://postgres:postgres@127.0.0.1:${LOCAL_SUPABASE_DB_PORT}/postgres"

validate_local_db_url() {
  local url="$1"
  local host port

  if [[ ! "$url" =~ ^postgres(ql)?:// ]]; then
    echo "Refusing non-PostgreSQL database URL: ${url}" >&2
    exit 1
  fi

  if [[ "$url" =~ @([^:/@]+)(:([0-9]+))?/ ]]; then
    host="${BASH_REMATCH[1]}"
    port="${BASH_REMATCH[3]:-${LOCAL_SUPABASE_DB_PORT}}"
  else
    echo "Unable to parse database host from URL: ${url}" >&2
    exit 1
  fi

  case "$host" in
    localhost|127.0.0.1) ;;
    *)
      echo "Refusing remote database host '${host}'. Local migration verification permits only localhost or 127.0.0.1." >&2
      exit 1
      ;;
  esac

  if [[ "$port" != "$LOCAL_SUPABASE_DB_PORT" ]]; then
    echo "Refusing database port '${port}'. Expected local Supabase port ${LOCAL_SUPABASE_DB_PORT}." >&2
    exit 1
  fi
}

run_sql_file() {
  local file="$1"
  if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
    validate_local_db_url "${SUPABASE_DB_URL}"
    echo "==> Executing ${file} against validated local URL"
    supabase db query --db-url "${SUPABASE_DB_URL}" -f "${file}"
  else
    echo "==> Executing ${file} against local Supabase (${DEFAULT_LOCAL_DB_URL})"
    supabase db query --local -f "${file}"
  fi
}

if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
  validate_local_db_url "${SUPABASE_DB_URL}"
  echo "==> Validated local database target: ${SUPABASE_DB_URL}"
else
  echo "==> Validated local database target: ${DEFAULT_LOCAL_DB_URL}"
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is required for local migration verification." >&2
  exit 1
fi

echo "==> Resetting local disposable database (migrations 001–068, no seed)"
supabase db reset --local --no-seed

echo "==> Running migration 068 schema and permission verification"
run_sql_file supabase/scripts/verify_068_employee_portal_linking.sql

echo "==> Running upgrade edge-case fixtures against post-068 database"
run_sql_file supabase/scripts/068_upgrade_fixtures.sql

echo "==> Re-running idempotent verification"
run_sql_file supabase/scripts/verify_068_employee_portal_linking.sql

echo "Local migration 068 verification completed successfully."
