import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { mapSupabaseProfile, isProfileActive, PROFILE_WITH_ROLE_SELECT } from '@/lib/auth/profile';
import { hasEffectivePermission, normalizePermissionCodes } from '@/lib/auth/effective-permissions';
import type { Profile } from '@/types';
import { type Permission } from '@/lib/permissions/roles';
import { hasSupabaseConfig } from '@/lib/security/env';

async function fetchSessionPermissions(): Promise<Permission[] | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_my_permissions');
  if (error) return undefined;
  return normalizePermissionCodes(data as string[] | null);
}

export async function getSessionUser(): Promise<Profile | null> {
  if (!hasSupabaseConfig()) return null;

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select(PROFILE_WITH_ROLE_SELECT)
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !isProfileActive(profile)) {
    await supabase.auth.signOut();
    return null;
  }

  const permissions = await fetchSessionPermissions();
  return { ...mapSupabaseProfile(profile), permissions };
}

export async function requireSessionUser(): Promise<Profile> {
  const profile = await getSessionUser();
  if (!profile) {
    throw new Error('Unauthorized');
  }
  return profile;
}

export async function requirePermission(permission: Permission): Promise<Profile> {
  const profile = await requireSessionUser();
  if (!hasEffectivePermission(profile.permissions, profile.role, permission)) {
    throw new Error('Forbidden');
  }
  return profile;
}

export async function requireSystemAdmin(): Promise<Profile> {
  const profile = await requireSessionUser();
  if (profile.role !== 'system_admin') {
    throw new Error('Forbidden');
  }
  return profile;
}

export async function logServerAudit(params: {
  userId: string;
  role: string;
  module: string;
  action: string;
  recordId?: string;
  success: boolean;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = await createClient();
  await supabase.from('audit_logs').insert({
    user_id: params.userId,
    action: params.action,
    module: params.module,
    record_id: params.recordId ?? null,
    new_value: {
      role: params.role,
      success: params.success,
      ...params.metadata,
    },
  });
}
