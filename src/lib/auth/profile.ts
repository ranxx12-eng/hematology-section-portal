import { normalizeStaffId } from '@/lib/staff/identity';
import type { Profile } from '@/types';
import type { Role } from '@/lib/permissions/roles';
import { ROLES } from '@/lib/permissions/roles';

export interface SupabaseProfileRow {
  id: string;
  email: string;
  full_name: string;
  role?: string;
  roles?: { name: string } | { name: string }[] | null;
  employee_id?: string | null;
  staff_id?: string | null;
  avatar_url?: string | null;
  language: 'en' | 'ar';
  is_active: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** Profile fields plus joined role name from `roles.primary_role_id`. */
export const PROFILE_WITH_ROLE_SELECT = `
  id,
  email,
  full_name,
  employee_id,
  staff_id,
  avatar_url,
  language,
  is_active,
  deleted_at,
  created_at,
  updated_at,
  roles!primary_role_id (
    name
  )
`;

function resolveRoleName(row: SupabaseProfileRow): string {
  if (row.role) return row.role;
  const joined = row.roles;
  if (Array.isArray(joined)) return joined[0]?.name ?? 'read_only';
  return joined?.name ?? 'read_only';
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
  const sourceRole = resolveRoleName(row);
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: normalizeRole(sourceRole),
    sourceRole,
    employeeId: row.employee_id ?? undefined,
    staffId: normalizeStaffId(row.staff_id) ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    language: row.language,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function isProfileActive(row: SupabaseProfileRow): boolean {
  return row.is_active === true && !row.deleted_at;
}
