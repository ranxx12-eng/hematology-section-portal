'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Profile } from '@/types';
import type { Role } from '@/lib/permissions/roles';
import { hasPermission, type Permission } from '@/lib/permissions/roles';
import { hasSupabaseConfig } from '@/lib/security/env';
import { createClient } from '@/lib/supabase/client';
import { mapSupabaseProfile, isProfileActive } from '@/lib/auth/profile';

interface AuthContextType {
  user: Profile | null;
  isLoading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  can: (permission: Permission) => boolean;
  role: Role | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchSupabaseProfile(userId: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, employee_id, avatar_url, language, is_active, deleted_at, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (error || !profile || !isProfileActive(profile)) {
    await supabase.auth.signOut();
    return null;
  }

  return mapSupabaseProfile(profile);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    async function initAuth() {
      if (!hasSupabaseConfig()) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (authUser && !cancelled) {
        const profile = await fetchSupabaseProfile(authUser.id);
        if (!cancelled) setUser(profile);
      }

      if (!cancelled) setIsLoading(false);

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (cancelled) return;
        if (!session?.user) {
          setUser(null);
          return;
        }
        const profile = await fetchSupabaseProfile(session.user.id);
        setUser(profile);
      });

      unsubscribe = () => subscription.unsubscribe();
    }

    void initAuth();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (!hasSupabaseConfig()) {
      return { error: 'Authentication is not configured. Contact your system administrator.' };
    }

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      return { error: 'Invalid email or password' };
    }

    const profile = await fetchSupabaseProfile(data.user.id);
    if (!profile) {
      return { error: 'Your account is disabled or inactive. Contact your administrator.' };
    }

    setUser(profile);
    return {};
  }, []);

  const logout = useCallback(async () => {
    if (hasSupabaseConfig()) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    setUser(null);
  }, []);

  const can = useCallback((permission: Permission) => {
    if (!user) return false;
    return hasPermission(user.role, permission);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, can, role: user?.role ?? null }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
