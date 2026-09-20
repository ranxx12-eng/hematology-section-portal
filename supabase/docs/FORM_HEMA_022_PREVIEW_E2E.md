# Form-Hema-022 Isolated Preview Supabase — Setup & Acceptance Testing

Separate Supabase project for Vercel **Preview** acceptance of Form-Hema-022. Does **not** modify Production (`rrdedjnzqpgymoorvwio`).

## Projects

| | Isolated Preview | Production (unchanged) |
|--|------------------|------------------------|
| Ref | `kabfiqhnroxfpcevwtog` | `rrdedjnzqpgymoorvwio` |
| Migrations | 001–075 | 001–071 (072–075 deferred) |

## Vercel Preview env (Preview scope only)

Shared variables currently bind **Production + Preview**. Split Preview without changing Production values:

```bash
# Remove Preview binding only (Production value unchanged)
vercel env rm NEXT_PUBLIC_SUPABASE_URL preview -y
vercel env rm NEXT_PUBLIC_SUPABASE_ANON_KEY preview -y

# Add Preview-only overrides (isolated project)
printf '%s' 'https://kabfiqhnroxfpcevwtog.supabase.co' | vercel env add NEXT_PUBLIC_SUPABASE_URL preview
printf '%s' '<preview-anon-key-from-dashboard>' | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview

# Sample IDs — synthetic mode for browser acceptance
printf '%s' '<preview-only-32-byte-base64-key>' | vercel env add SAMPLE_ID_ENCRYPTION_KEY preview
printf 'true' | vercel env add SAMPLE_ID_ENCRYPTION_SYNTHETIC_ONLY preview
```

Keep `NEXT_PUBLIC_DEMO_MODE=false`. **Do not** add Preview `SUPABASE_SECRET_KEY` for Form-Hema-022: workflow, activation, and Sample ID API routes use the authenticated user session + RLS via `createClient()`.

**Note:** Existing `SUPABASE_SECRET_KEY` (Production + Preview) remains for admin API routes only. Avoid admin user management on Preview deployments until Preview-specific service role is configured separately.

Redeploy the feature branch after env changes.

## Verify deployed refs (no secrets)

Extract project ref from client JS bundles:

```bash
# Preview deployment URL — expect kabfiqhnroxfpcevwtog
curl -sL 'https://<preview-host>/en/login' | rg -o '/_next/static/[^"]+\.js' | head -5 | while read -r p; do
  curl -sL "https://<preview-host>${p}" | rg -o '[a-z0-9]{20}\.supabase\.co' | head -1
done

# Production — expect rrdedjnzqpgymoorvwio
curl -sL 'https://hematology-section-portal.vercel.app/en/login' | ...
```

## CLI acceptance tests

Requires env vars from Supabase Dashboard (never commit keys):

```bash
export PREVIEW_SUPABASE_URL="https://kabfiqhnroxfpcevwtog.supabase.co"
export PREVIEW_SUPABASE_ANON_KEY="<preview-anon-key>"
export PREVIEW_SUPABASE_SERVICE_ROLE_KEY="<preview-service-role-key>"
export E2E_PREVIEW_USER_PASSWORD="<disposable-preview-password>"

node scripts/run-form-hema-022-preview-e2e.mjs
```

Script refuses to run against `rrdedjnzqpgymoorvwio`.

### Browser test accounts (preview project only)

Created by the E2E script via service role (one-time bootstrap):

| Role | Email |
|------|-------|
| Preparer | `e2e-preparer@preview-e2e.test` |
| Reviewer | `e2e-reviewer@preview-e2e.test` |
| Approver | `e2e-approver@preview-e2e.test` |

Password: set via `E2E_PREVIEW_USER_PASSWORD` when bootstrapping. All three have `inventory_officer` (`inventory.manage`).

## Draft criteria backfill (draft/returned only)

`supabase/scripts/backfill_form_hema_022_draft_criteria.sql` updates **only** `draft` and `returned` RETIC studies. Submitted, pending, approved, rejected, and activated studies are excluded by status filter.

Run only while linked to **`kabfiqhnroxfpcevwtog`**.

## Production rollout (not executed)

1. Maintenance window + backup on `rrdedjnzqpgymoorvwio`
2. Apply migrations 072 → 075
3. Run draft-only backfill SQL on Production
4. Configure Production `SAMPLE_ID_ENCRYPTION_KEY` (new key; not Preview test key)
5. Merge feature branch after Preview sign-off
