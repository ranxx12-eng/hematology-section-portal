# Migration & Application Transition Plan

## Production migrations (001–010)

Apply in order to production Supabase. **Do not run `seed.sql` or `seeds/development_seed.sql`.**

| # | File | Purpose |
|---|------|---------|
| 001 | `001_extensions_and_types.sql` | Extensions, enums |
| 002 | `002_core_auth_rbac_schema.sql` | Roles, permissions, profiles, employees |
| 003 | `003_operational_schema.sql` | All operational tables (empty) |
| 004 | `004_indexes_and_triggers.sql` | Indexes, updated_at, hard-delete prevention |
| 005 | `005_rls_helpers.sql` | Authorization helper functions |
| 006 | `006_rls_policies.sql` | RLS policies |
| 007 | `007_cms_schema.sql` | CMS tables + policies |
| 008 | `008_storage_buckets_and_policies.sql` | 9 private buckets, 36 storage policies |
| 009 | `009_security_hardening.sql` | Audit triggers, secure views, bootstrap fn |
| 010 | `010_reference_roles_permissions.sql` | Idempotent roles/permissions + auth trigger |

## Development only

| File | Purpose |
|------|---------|
| `supabase/seed.sql` | CLI wrapper (local `supabase db reset` only) |
| `supabase/seeds/development_seed.sql` | Demo employees, patients, clinical data |

## Pre-execution checklist

1. Run `supabase/scripts/preflight_validation.sql`
2. Confirm empty database (or planned migration strategy)
3. Disable public signup in Supabase Auth
4. Apply migrations 001–010
5. Bootstrap first admin per `supabase/docs/ADMIN_BOOTSTRAP.md`
6. Keep `NEXT_PUBLIC_DEMO_MODE=true` until app data layer is wired

## Demo → Supabase transition (application)

| Phase | Task | Status |
|-------|------|--------|
| 1 | Database schema + RLS | Migrations ready (awaiting approval) |
| 2 | Authentication | Supabase auth wired; demo mode active |
| 3 | Admin bootstrap | Documented procedure ready |
| 4 | Supabase CRUD adapters | Not started (40+ pages use mock store) |
| 5 | Module-by-module migration | Not started |
| 6 | Compatibility tests | Run after each module wired |
| 7 | Disable demo mode | Only after phases 4–6 verified |

## Rollback plan

- **Before any migration:** No action needed
- **After partial migration:** Restore from Supabase backup or reset project; do not run destructive rollback scripts on production without backup
- **After full migration:** Rollback requires database restore; migrations are forward-only
