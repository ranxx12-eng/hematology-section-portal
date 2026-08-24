import type { Role } from '@/lib/permissions/roles';

export const STAFF_ID_NOT_ASSIGNED = 'Not assigned';

export interface StaffIdentity {
  profileId: string;
  fullName: string;
  email: string;
  staffId: string | null;
  role: Role;
  isActive: boolean;
}

export function normalizeStaffId(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function formatStaffIdLabel(staffId: string | null | undefined): string {
  const normalized = normalizeStaffId(staffId);
  return normalized ? `Staff ID: ${normalized}` : `Staff ID: ${STAFF_ID_NOT_ASSIGNED}`;
}

export function formatStaffOptionLabel(fullName: string, staffId: string | null | undefined): string {
  const normalized = normalizeStaffId(staffId);
  return normalized ? `${fullName} — ${normalized}` : `${fullName} — ${STAFF_ID_NOT_ASSIGNED}`;
}

export function formatStaffIdentityBlock(fullName: string, staffId: string | null | undefined): string {
  const normalized = normalizeStaffId(staffId);
  return normalized
    ? `${fullName}\nStaff ID: ${normalized}`
    : `${fullName}\nStaff ID: ${STAFF_ID_NOT_ASSIGNED}`;
}

export function matchesStaffSearch(
  query: string,
  identity: Pick<StaffIdentity, 'fullName' | 'email' | 'staffId'>,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    identity.fullName.toLowerCase().includes(q)
    || identity.email.toLowerCase().includes(q)
    || (identity.staffId?.toLowerCase().includes(q) ?? false)
  );
}

export function resolveVisibleStaffId(
  profileStaffId: string | null | undefined,
  employeeCode: string | null | undefined,
): string | null {
  return normalizeStaffId(profileStaffId) ?? normalizeStaffId(employeeCode);
}
