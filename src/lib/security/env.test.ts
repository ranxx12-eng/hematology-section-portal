import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isDemoMode, hasSupabaseConfig, assertDemoModeForMockAccess } from '@/lib/security/env';

describe('security env', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('demo mode requires explicit NEXT_PUBLIC_DEMO_MODE=true', () => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    process.env.NEXT_PUBLIC_SUPABASE_URL = undefined;
    expect(isDemoMode()).toBe(false);
  });

  it('demo mode is true only when flag is set', () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'true';
    expect(isDemoMode()).toBe(true);
  });

  it('hasSupabaseConfig rejects placeholder values', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://your-project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'your-publishable-key';
    expect(hasSupabaseConfig()).toBe(false);
  });

  it('hasSupabaseConfig accepts publishable key env var', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://rrdedjnzqpgymoorvwio.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test_key';
    expect(hasSupabaseConfig()).toBe(true);
  });

  it('assertDemoModeForMockAccess throws outside demo mode', () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'false';
    expect(() => assertDemoModeForMockAccess()).toThrow(/Mock data is disabled/);
  });
});
