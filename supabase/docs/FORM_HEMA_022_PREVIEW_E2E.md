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
  - `scripts/.preview-owner-invite.local.txt` — invite metadata only: email, fullName, generatedAt, previewSiteUrl (gitignored; **no** action link stored)
- Required env for bootstrap (preview project only):
  - `PREVIEW_SUPABASE_URL`
  - `PREVIEW_SUPABASE_SERVICE_ROLE_KEY`
  - `PREVIEW_OWNER_EMAIL` — preview portal owner for Supabase email invite (password chosen in invite flow)
  - `PREVIEW_OWNER_FULL_NAME` — display name on preview profile
  - `PREVIEW_SITE_URL` — Vercel Preview base URL (redirect target for invite)
  - `PREVIEW_REVOKE_OWNER_EMAIL` — optional; removes a mistaken preview-only auth user on **`kabfiqhnroxfpcevwtog` only**
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

## Merge to `main` without leaking old preview passwords

Historical commits on this feature branch (e.g. `96ab066`, `d456dac`) once contained a shared preview test fallback string in seed/E2E scripts. Current branch removes that fallback and uses gitignored bootstrap credentials only.

**Do not merge the feature branch to `main` as-is** if you need to avoid carrying readable password material in git history on `main`.

Recommended approaches (pick one; do **not** rewrite `main`):

1. **Squash merge** the feature branch into `main` via a single new commit (GitHub squash merge), so `main` only contains the sanitized tree — not the intermediate commits with old script literals.
2. **Merge via clean commit:** merge `main` into the feature branch, then replace sensitive script history on the branch with the current sanitized files and merge once reviewers sign off.
3. **Rebase/squash on the feature branch** before PR merge so the PR diff contains no credential strings (verify with `git log -S` on the PR branch tip).

Never paste removed credential values into docs, PR descriptions, or chat.
