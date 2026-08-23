import type { Permission, Role } from '@/lib/permissions/roles';
import { hasPermission } from '@/lib/permissions/roles';

const PERMISSION_CODE_PATTERN = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/;

export function isPermissionCode(value: string): value is Permission {
  return PERMISSION_CODE_PATTERN.test(value);
}

export function normalizePermissionCodes(values: string[] | null | undefined): Permission[] {
  if (!values?.length) return [];
  return values.filter(isPermissionCode);
}

export function hasEffectivePermission(
  permissions: Permission[] | undefined,
  role: Role,
  permission: Permission,
): boolean {
  if (permissions?.includes(permission)) return true;
  return hasPermission(role, permission);
}

export function createPermissionChecker(
  permissions: Permission[] | undefined,
  role: Role,
): (permission: Permission) => boolean {
  return (permission: Permission) => hasEffectivePermission(permissions, role, permission);
}
