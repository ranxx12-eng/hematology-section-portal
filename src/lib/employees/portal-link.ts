import { normalizeStaffId } from '@/lib/staff/identity';
import type { Role } from '@/lib/permissions/roles';

export interface ProfileLinkRow {
  employeeId: string | null;
  staffId: string | null;
  isActive: boolean;
  portalRole: Role | null;
}

export type PortalAccountLinkState = 'linked' | 'not_linked' | 'unknown';

export interface EmployeePortalLinkStatus {
  linkState: PortalAccountLinkState;
  portalLinked: boolean;
  portalLoginActive: boolean;
  canLinkByStaffId: boolean;
}

export function unknownPortalLinkStatus(): EmployeePortalLinkStatus {
  return {
    linkState: 'unknown',
    portalLinked: false,
    portalLoginActive: false,
    canLinkByStaffId: false,
  };
}

export function buildStaffIdIndex(profiles: ProfileLinkRow[]): Map<string, ProfileLinkRow[]> {
  const index = new Map<string, ProfileLinkRow[]>();
  for (const profile of profiles) {
    const key = normalizeStaffId(profile.staffId)?.toLowerCase();
    if (!key) continue;
    const list = index.get(key) ?? [];
    list.push(profile);
    index.set(key, list);
  }
  return index;
}

export function resolveEmployeePortalLink(
  employeeCode: string,
  linkedProfile: ProfileLinkRow | null,
  staffIdIndex: Map<string, ProfileLinkRow[]>,
): EmployeePortalLinkStatus {
  const codeKey = normalizeStaffId(employeeCode)?.toLowerCase();
  const matchingProfiles = codeKey ? (staffIdIndex.get(codeKey) ?? []) : [];
  const unlinkedMatch = matchingProfiles.find((profile) => !profile.employeeId);

  if (linkedProfile != null) {
    return {
      linkState: 'linked',
      portalLinked: true,
      portalLoginActive: linkedProfile.isActive,
      canLinkByStaffId: false,
    };
  }

  return {
    linkState: 'not_linked',
    portalLinked: false,
    portalLoginActive: false,
    canLinkByStaffId: matchingProfiles.length === 1 && !!unlinkedMatch,
  };
}

export function formatPortalAccountLabel(status: EmployeePortalLinkStatus): string {
  if (status.linkState === 'unknown') return 'Link status unavailable';
  return status.portalLinked ? 'Linked' : 'Not Linked';
}

export function formatPortalLoginLabel(status: EmployeePortalLinkStatus): string {
  if (status.linkState === 'unknown') return '—';
  if (!status.portalLinked) return '—';
  return status.portalLoginActive ? 'Active' : 'Inactive';
}

export const PORTAL_ACCOUNT_REQUIRED_MESSAGE =
  'Portal account required for My Tasks and notifications.';

export const STAFF_ID_REQUIRED_MESSAGE =
  'Hospital Staff ID required. Assign the verified Hospital Staff ID on the portal account to create and link the employee record automatically.';

export const OPERATIONAL_ROLE_HELP =
  'Operational roster role only. Does not change portal login permissions.';

export function profileNeedsStaffId(staffId: string | null | undefined, employeeId: string | null | undefined): boolean {
  const normalized = normalizeStaffId(staffId);
  return !normalized && !employeeId;
}

export const UNLINKED_ASSIGNEE_WARNING =
  'Selected employee has no linked portal account. Task can be assigned, but My Tasks and login notifications will not be delivered until a portal account is linked with the same Hospital Staff ID.';

export const PORTAL_LINK_STATUS_UNAVAILABLE_WARNING =
  'Portal account link status could not be verified. Assignees are not marked as unlinked until link status loads successfully.';

export function hasUnlinkedAssigneeSelection(
  selectedIds: string[],
  employees: Array<{ id: string; linkState: PortalAccountLinkState }>,
): boolean {
  const byId = Object.fromEntries(employees.map((employee) => [employee.id, employee]));
  return selectedIds.some((id) => byId[id]?.linkState === 'not_linked');
}

export function parseEmployeeDuplicateError(message: string): string | null {
  const lower = message.toLowerCase();
  if (lower.includes('employees_employee_code_key') || lower.includes('duplicate key') && lower.includes('employee_code')) {
    return 'Hospital Staff ID is already assigned to another employee.';
  }
  if (lower.includes('employees_email_key') || lower.includes('duplicate key') && lower.includes('email')) {
    return 'Email is already assigned to another employee.';
  }
  if (lower.includes('idx_profiles_staff_id_unique')) {
    return 'Hospital Staff ID is already assigned to another portal account.';
  }
  return null;
}
