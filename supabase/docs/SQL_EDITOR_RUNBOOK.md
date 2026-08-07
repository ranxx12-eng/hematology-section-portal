# Production Migration Runbook — Supabase SQL Editor

**Project:** `rrdedjnzqpgymoorvwio`  
**Execute:** Migrations `001`–`010` only  
**Do NOT run:** `supabase/seed.sql` or `supabase/seeds/development_seed.sql`

---

## Before you start

1. Open [Supabase Dashboard](https://supabase.com/dashboard/project/rrdedjnzqpgymoorvwio/sql/new)
2. Confirm the database is **empty** (no existing `public.profiles`, `public.roles`, etc.)
3. Keep `NEXT_PUBLIC_DEMO_MODE=true` in `.env.local` (unchanged)

---

## Execution order (run each file separately, in order)

| Step | File | Action |
|------|------|--------|
| 1 | `supabase/migrations/001_extensions_and_types.sql` | Copy entire file → SQL Editor → **Run** |
| 2 | `supabase/migrations/002_core_auth_rbac_schema.sql` | Run |
| 3 | `supabase/migrations/003_operational_schema.sql` | Run |
| 4 | `supabase/migrations/004_indexes_and_triggers.sql` | Run |
| 5 | `supabase/migrations/005_rls_helpers.sql` | Run |
| 6 | `supabase/migrations/006_rls_policies.sql` | Run |
| 7 | `supabase/migrations/007_cms_schema.sql` | Run |
| 8 | `supabase/migrations/008_storage_buckets_and_policies.sql` | Run |
| 9 | `supabase/migrations/009_security_hardening.sql` | Run |
| 10 | `supabase/migrations/010_reference_roles_permissions.sql` | Run |

**Important:** Wait for each step to complete successfully before running the next. If a step fails, stop and note the error message.

---

## What gets created (no demo data)

### Schema
- 47 empty application tables
- 13 roles, 54 permissions, role-permission mappings
- 5 public + 2 restricted system settings
- 10+ security functions, 10 audit triggers
- 4 secure views (`safe_system_settings`, `masked_critical_values`, etc.)

### Storage
- 9 private buckets with 36 RLS policies

### NOT created
- No demo employees, patients, or clinical records
- No auth users (except those you create manually)
- No development seed data

---

## After all 10 migrations succeed

Run verification in SQL Editor:

```
supabase/scripts/post_migration_verification.sql
```

Expected results:

| Check | Expected |
|-------|----------|
| Public tables | ~47 |
| RLS enabled | All application tables |
| Storage buckets | 9, all `is_public = false` |
| Storage policies | 36 |
| Roles | 13 |
| Permissions | 54 |
| Employees | 0 |
| Critical values | 0 |
| Sample rejections | 0 |

---

## Next step: First admin (after migrations)

Follow `supabase/docs/ADMIN_BOOTSTRAP.md`:

1. Create user in Authentication → Users
2. Run: `SELECT public.bootstrap_system_admin('YOUR-USER-UUID');`

---

## Troubleshooting

| Error | Likely cause |
|-------|--------------|
| `type "app_role" already exists` | Migrations partially applied — do not re-run 001 |
| `relation "profiles" already exists` | Database not empty — restore/reset before retry |
| `Required role read_only is not configured` | Run 010 before creating auth users |
| Storage policy errors | Ensure migration 008 ran after 005 helpers |

---

## Rollback

If migration fails mid-way on a fresh project: reset database via Supabase Dashboard → Settings → Database → Reset, then re-run from step 1.

Do **not** reset if you have data you need to keep.
