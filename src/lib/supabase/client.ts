import { createBrowserClient } from '@supabase/ssr';
import { getSupabasePublishableKey, getSupabaseUrl, hasSupabaseConfig } from '@/lib/security/env';

export function createClient() {
  if (!hasSupabaseConfig()) {
    throw new Error('Supabase is not configured.');
  }
  return createBrowserClient(getSupabaseUrl(), getSupabasePublishableKey());
}
