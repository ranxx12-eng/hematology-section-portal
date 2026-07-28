import type { Profile } from '@/types';
import type { Role } from '@/lib/permissions/roles';
import { ROLES } from '@/lib/permissions/roles';

interface SupabaseProfileRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
  employee_id?: string | null;
  avatar_url?: string | null;
  language: 'en' | 'ar';
  is_active: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

const LEGACY_ROLE_MAP: Record<string, Role> = {
  quality_link: 'quality_officer',
  viewer: 'read_only',
};

export function normalizeRole(role: string): Role {
  const mapped = LEGACY_ROLE_MAP[role] ?? role;
  if ((ROLES as readonly string[]).includes(mapped)) {
    return mapped as Role;
  }
  return 'read_only';
}

export function mapSupabaseProfile(row: SupabaseProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: normalizeRole(row.role),
    employeeId: row.employee_id ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    language: row.language,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function isProfileActive(row: SupabaseProfileRow): boolean {
  return row.is_active === true && !row.deleted_at;
}
