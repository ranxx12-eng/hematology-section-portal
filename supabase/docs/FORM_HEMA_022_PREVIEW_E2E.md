# Form-Hema-022 Isolated Preview Supabase — Setup & Acceptance Testing

Separate Supabase project for Vercel **Preview** acceptance of Form-Hema-022. Does **not** modify Production (`rrdedjnzqpgymoorvwio`).

## Projects

| | Isolated Preview | Production (unchanged) |
|--|------------------|------------------------|
| Ref | `kabfiqhnroxfpcevwtog` | `rrdedjnzqpgymoorvwio` |
| Migrations | 001–075 | 001–071 (072–075 deferred) |

## Security — preview credentials

- **Never** commit passwords, service role keys, invite links, or encryption keys.
- Run `node scripts/preview-access-bootstrap.mjs` once per rotation. It writes:
  - `scripts/.preview-secrets.local.json` — automation accounts only (gitignored)
  - `scripts/.preview-owner-invite.local.txt` — your invite link metadata (gitignored)
- Required env for bootstrap (preview project only):
  - `PREVIEW_SUPABASE_URL`
  - `PREVIEW_SUPABASE_SERVICE_ROLE_KEY`
  - `PREVIEW_OWNER_EMAIL` — your work email for Supabase invite (you choose password via email link)
  - `PREVIEW_SITE_URL` — Vercel Preview base URL (redirect target for invite)
- Disposable automation accounts (`e2e-*@preview-e2e.test`) use **unique random passwords** per bootstrap. Do not share or paste them in chat, tickets, or commits.
- If a password was ever exposed, re-run bootstrap immediately to rotate all automation accounts.

### Credential exposure audit (repo)

| Location | Finding |
|----------|---------|
| Git tracked files | No shared preview passwords committed. Scripts require bootstrap file or env. |
| Default fallbacks | Removed (`preview-e2e-change-me` no longer used). |
| Chat / deployment logs | Treat any pasted automation password as compromised; rotate via bootstrap. |

### `instruments.view` for inventory officer

- **Production / migrations:** `inventory_officer` in `010_reference_roles_permissions.sql` has `inventory.view` and `inventory.manage` but **not** `instruments.view`.
- **Isolated preview only:** `scripts/preview-access-bootstrap.mjs` and `scripts/seed-preview-form-hema-022.mjs` upsert `instruments.view` onto the `inventory_officer` role **in project `kabfiqhnroxfpcevwtog` only** so the instrument dropdown works for browser acceptance. This is **not** added to application code or Production migrations.

## Vercel Preview env (Preview scope only)

See prior runbook for splitting Preview vs Production Supabase URL/anon key. Keep `SAMPLE_ID_ENCRYPTION_SYNTHETIC_ONLY=true` on Preview for synthetic Sample IDs during acceptance.

## CLI acceptance tests

```bash
export PREVIEW_SUPABASE_URL="https://kabfiqhnroxfpcevwtog.supabase.co"
export PREVIEW_SUPABASE_ANON_KEY="<from-dashboard>"
export PREVIEW_SUPABASE_SERVICE_ROLE_KEY="<from-dashboard>"
node scripts/preview-access-bootstrap.mjs   # if not done yet
node scripts/run-form-hema-022-preview-e2e.mjs
```

## Browser walkthrough (Preview deployment)

```bash
export PREVIEW_BASE_URL="https://<preview-deployment>.vercel.app"
npx playwright test --config=playwright.preview.config.ts
```

Artifacts (gitignored): `tmp/form-hema-022-preview-artifacts/`

### Automation accounts (preview only)

| Role | Email |
|------|-------|
| Preparer | `e2e-preparer@preview-e2e.test` |
| Reviewer | `e2e-reviewer@preview-e2e.test` |
| Approver | `e2e-approver@preview-e2e.test` |

Passwords: only in `scripts/.preview-secrets.local.json` after bootstrap.

## Draft criteria backfill (draft/returned only)

`supabase/scripts/backfill_form_hema_022_draft_criteria.sql` — run only on **`kabfiqhnroxfpcevwtog`**.

## Production rollout (not executed)

Unchanged from prior runbook; stop before Production until Preview sign-off.
