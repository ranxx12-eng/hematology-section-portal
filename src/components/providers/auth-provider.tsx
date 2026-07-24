'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Profile } from '@/types';
import type { Role } from '@/lib/permissions/roles';
import { hasPermission, type Permission } from '@/lib/permissions/roles';
import { DEMO_USERS, getDemoProfile, getStoredAuth, setStoredAuth, clearStoredAuth, isDemoMode } from '@/lib/mock/store';

interface AuthContextType {
  user: Profile | null;
  isLoading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<{ error?: string }>;
  logout: () => void;
  can: (permission: Permission) => boolean;
  role: Role | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredAuth();
    if (stored) setUser(stored);
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string, remember = false) => {
    if (isDemoMode()) {
      const demoUser = DEMO_USERS.find((u) => u.email === email && u.password === password);
      if (!demoUser) return { error: 'Invalid email or password' };
      const profile = getDemoProfile(email);
      if (!profile) return { error: 'Failed to create profile' };
      setStoredAuth(profile, remember);
      setUser(profile);
      return {};
    }
    return { error: 'Supabase auth not configured. Enable demo mode.' };
  }, []);

  const logout = useCallback(() => {
    clearStoredAuth();
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
