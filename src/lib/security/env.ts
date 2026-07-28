/**
 * Centralized environment configuration.
 * Demo mode is opt-in only — production never auto-falls back to mock data.
 */

const PLACEHOLDER_PATTERNS = ['your-project', 'your-anon-key', 'your-service-role-key'];

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  return PLACEHOLDER_PATTERNS.some((p) => value.includes(p));
}

/** Explicit demo flag only — never inferred from missing Supabase config. */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
}

export function isProductionMode(): boolean {
  return process.env.NODE_ENV === 'production' && !isDemoMode();
}

export function hasSupabaseConfig(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && anonKey && !isPlaceholder(url) && !isPlaceholder(anonKey));
}

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || isPlaceholder(url)) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured.');
  }
  return url;
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key || isPlaceholder(key)) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured.');
  }
  return key;
}

/** Server-only — never import from client components. */
export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || isPlaceholder(key)) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }
  return key;
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

export function getDemoPassword(): string {
  return process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? '';
}

/** Throws when mock/localStorage data access is attempted outside demo mode. */
export function assertDemoModeForMockAccess(): void {
  if (!isDemoMode()) {
    throw new Error(
      'Mock data is disabled. Configure Supabase and set NEXT_PUBLIC_DEMO_MODE=false for production.',
    );
  }
}

export function validateProductionConfig(): string[] {
  const errors: string[] = [];
  if (isDemoMode()) return errors;
  if (!hasSupabaseConfig()) {
    errors.push('Supabase URL and anon key must be configured for production.');
  }
  if (process.env.NODE_ENV === 'production' && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY is required for production server operations.');
  }
  return errors;
}
