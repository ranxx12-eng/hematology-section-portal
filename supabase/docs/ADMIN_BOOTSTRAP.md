# Admin Bootstrap Procedure

**One-time System Admin assignment for production.**

Public signup metadata must never grant admin access. New users receive `read_only` via the `handle_new_user()` trigger.

## Prerequisites

1. Production migrations `001` through `010` applied
2. Public signup disabled in Supabase Dashboard → Authentication → Settings
3. `SUPABASE_SECRET_KEY` configured server-side only (never in browser)

## Method A: Supabase SQL Editor (recommended)

1. Create the admin user in Supabase Dashboard → Authentication → Users → **Add user**
2. Confirm the user appears in `auth.users`
3. Wait for profile auto-creation (trigger creates `read_only` profile)
4. Run in SQL Editor using the **service role** context:

```sql
SELECT public.bootstrap_system_admin('YOUR-USER-UUID-HERE');
```

5. Verify:

```sql
SELECT p.id, p.email, r.name AS role
FROM public.profiles p
JOIN public.roles r ON r.id = p.primary_role_id
WHERE p.id = 'YOUR-USER-UUID-HERE';
```

6. Confirm audit entry:

```sql
SELECT action, module, created_at
FROM public.audit_logs
WHERE record_id = 'YOUR-USER-UUID-HERE'
ORDER BY created_at DESC LIMIT 5;
```

## Method B: Server-only script

Use `@supabase/supabase-js` with `SUPABASE_SECRET_KEY` on the server:

```typescript
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// 1. Create user (or use existing)
const { data: user } = await admin.auth.admin.createUser({
  email: 'admin@hospital.example',
  password: '...',
  email_confirm: true,
});

// 2. Bootstrap system admin role
await admin.rpc('bootstrap_system_admin', { p_user_id: user.user!.id });
```

## Security notes

- `bootstrap_system_admin()` is **revoked from `authenticated` and `anon`**
- Callable only via service role / postgres owner
- Action is written to `audit_logs`
- Do not expose `SUPABASE_SECRET_KEY` in client code or `.env` files shipped to browsers
- Assign clinical permissions separately if the admin also needs PHI access (system_admin does **not** include clinical permissions by default)

## Optional: Supplemental roles

```sql
INSERT INTO public.user_roles (user_id, role_id, assigned_by, expires_at)
SELECT
  'YOUR-USER-UUID',
  r.id,
  'YOUR-USER-UUID',
  NULL
FROM public.roles r
WHERE r.name = 'quality_officer'
ON CONFLICT (user_id, role_id) DO NOTHING;
```
