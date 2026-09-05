import { normalizeStaffId } from '@/lib/staff/identity';

export interface ProfileLinkRow {
  employeeId: string | null;
  staffId: string | null;
  isActive: boolean;
}

export interface EmployeePortalLinkStatus {
  portalLinked: boolean;
  portalLoginActive: boolean;
  canLinkByStaffId: boolean;
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

  return {
    portalLinked: linkedProfile != null,
    portalLoginActive: linkedProfile?.isActive ?? false,
    canLinkByStaffId: linkedProfile == null && matchingProfiles.length === 1 && !!unlinkedMatch,
  };
}

export function formatPortalAccountLabel(status: EmployeePortalLinkStatus): string {
  return status.portalLinked ? 'Linked' : 'Not Linked';
}

export function formatPortalLoginLabel(status: EmployeePortalLinkStatus): string {
  if (!status.portalLinked) return '—';
  return status.portalLoginActive ? 'Active' : 'Inactive';
}

export const PORTAL_ACCOUNT_REQUIRED_MESSAGE =
  'Portal account required for My Tasks and notifications.';

export const STAFF_ID_REQUIRED_MESSAGE =
  'Hospital Staff ID required. Assign the verified Hospital Staff ID on the portal account to create and link the employee record automatically.';

export function profileNeedsStaffId(staffId: string | null | undefined, employeeId: string | null | undefined): boolean {
  const normalized = normalizeStaffId(staffId);
  return !normalized && !employeeId;
}

export const UNLINKED_ASSIGNEE_WARNING =
  'Selected employee has no linked portal account. Task can be assigned, but My Tasks and login notifications will not be delivered until a portal account is linked with the same Hospital Staff ID.';

export function hasUnlinkedAssigneeSelection(
  selectedIds: string[],
  employees: Array<{ id: string; portalLinked: boolean }>,
): boolean {
  const byId = Object.fromEntries(employees.map((employee) => [employee.id, employee]));
  return selectedIds.some((id) => byId[id] && !byId[id].portalLinked);
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
