#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PRODUCTION_PROJECT_REF="rrdedjnzqpgymoorvwio"
LOCAL_DB_URL="${SUPABASE_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

if [[ "${LOCAL_DB_URL}" == *"${PRODUCTION_PROJECT_REF}"* ]]; then
  echo "Refusing to run migration verification against production project ${PRODUCTION_PROJECT_REF}" >&2
  exit 1
fi

if [[ "${NEXT_PUBLIC_SUPABASE_URL:-}" == *"${PRODUCTION_PROJECT_REF}"* && "${ALLOW_PRODUCTION_MIGRATION_VERIFY:-}" != "1" ]]; then
  echo "Refusing to run while NEXT_PUBLIC_SUPABASE_URL points at production." >&2
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is required for local migration verification." >&2
  exit 1
fi

echo "==> Resetting local disposable database (migrations 001–068, no remote link)"
supabase db reset --no-seed --local

echo "==> Running migration 068 schema and permission verification"
psql "${LOCAL_DB_URL}" -v ON_ERROR_STOP=1 -f supabase/scripts/verify_068_employee_portal_linking.sql

echo "==> Running upgrade edge-case fixtures against post-068 database"
psql "${LOCAL_DB_URL}" -v ON_ERROR_STOP=1 -f supabase/scripts/068_upgrade_fixtures.sql

echo "==> Re-running idempotent verification"
psql "${LOCAL_DB_URL}" -v ON_ERROR_STOP=1 -f supabase/scripts/verify_068_employee_portal_linking.sql

echo "Local migration 068 verification completed successfully."
