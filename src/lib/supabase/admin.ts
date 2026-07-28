import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { getSupabaseServiceRoleKey, getSupabaseUrl } from '@/lib/security/env';

let adminClient: ReturnType<typeof createClient> | null = null;

/** Service-role client — server-only. Never import from client components. */
export function createAdminClient() {
  if (!adminClient) {
    adminClient = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}
