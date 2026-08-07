/**
 * Centralized environment configuration.
 * Demo mode is opt-in only — production never auto-falls back to mock data.
 */

const PLACEHOLDER_PATTERNS = [
  'your-project',
  'your-anon-key',
  'your-publishable-key',
  'your-service-role-key',
  'your-secret-key',
];

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

export function getSupabasePublishableKeyValue(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function hasSupabaseConfig(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = getSupabasePublishableKeyValue();
  return Boolean(url && publishableKey && !isPlaceholder(url) && !isPlaceholder(publishableKey));
}

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || isPlaceholder(url)) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured.');
  }
  return url.replace(/\/+$/, '');
}

export function getSupabasePublishableKey(): string {
  const key = getSupabasePublishableKeyValue();
  if (!key || isPlaceholder(key)) {
    throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not configured.');
  }
  return key;
}

/** @deprecated Use getSupabasePublishableKey — kept for backward compatibility. */
export function getSupabaseAnonKey(): string {
  return getSupabasePublishableKey();
}

/** Server-only — never import from client components. */
export function getSupabaseSecretKeyValue(): string | undefined {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/** Server-only — never import from client components. */
export function getSupabaseServiceRoleKey(): string {
  const key = getSupabaseSecretKeyValue();
  if (!key || isPlaceholder(key)) {
    throw new Error('SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is not configured.');
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
    errors.push('Supabase URL and publishable key must be configured for production.');
  }
  if (process.env.NODE_ENV === 'production' && !getSupabaseSecretKeyValue()) {
    errors.push('SUPABASE_SECRET_KEY is required for production server operations.');
  }
  return errors;
}
