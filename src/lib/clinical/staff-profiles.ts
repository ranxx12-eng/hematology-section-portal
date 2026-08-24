import { createClient } from '@/lib/supabase/client';
import type { Role } from '@/lib/permissions/roles';
import { normalizeRole } from '@/lib/auth/profile';
import { normalizeStaffId, type StaffIdentity } from '@/lib/staff/identity';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface PortalStaffRow {
  id: string;
  email: string;
  full_name: string;
  staff_id: string | null;
  is_active: boolean;
  employee_id: string | null;
  roles: { name: string } | { name: string }[] | null;
}

const PORTAL_STAFF_SELECT = `
  id,
  email,
  full_name,
  staff_id,
  is_active,
  employee_id,
  roles!primary_role_id ( name )
`;

function mapPortalStaff(row: PortalStaffRow, employeeCodeById: Record<string, string>): StaffIdentity {
  const roleJoined = row.roles;
  const roleName = Array.isArray(roleJoined) ? roleJoined[0]?.name : roleJoined?.name;
  const linkedEmployeeCode = row.employee_id ? employeeCodeById[row.employee_id] : undefined;

  return {
    profileId: row.id,
    fullName: row.full_name,
    email: row.email,
    staffId: normalizeStaffId(row.staff_id) ?? normalizeStaffId(linkedEmployeeCode),
    role: normalizeRole(roleName ?? 'read_only'),
    isActive: row.is_active,
  };
}

async function fetchLinkedEmployeeCodes(employeeIds: string[]): Promise<Record<string, string>> {
  const uniqueIds = [...new Set(employeeIds.filter(Boolean))];
  if (uniqueIds.length === 0) return {};

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('employees')
      .select('id, employee_code')
      .in('id', uniqueIds)
      .is('deleted_at', null);

    if (error || !data) return {};
    return Object.fromEntries(data.map((row) => [row.id, row.employee_code]));
  } catch {
    return {};
  }
}

export async function fetchPortalStaff(): Promise<ClinicalListResult<StaffIdentity>> {
  return runClinicalListQuery('Failed to load portal staff', async () => {
    const supabase = createClient();
    return supabase
      .from('profiles')
      .select(PORTAL_STAFF_SELECT)
      .is('deleted_at', null)
      .order('full_name');
  }).then(async (result) => {
    if (result.error) {
      return { data: [], error: result.error };
    }

    const rows = result.data as unknown as PortalStaffRow[];
    const employeeCodeById = await fetchLinkedEmployeeCodes(
      rows.map((row) => row.employee_id).filter((id): id is string => !!id),
    );

    return {
      data: rows.map((row) => mapPortalStaff(row, employeeCodeById)),
      error: null,
    };
  });
}

export async function fetchStaffIdentityMap(): Promise<Record<string, { fullName: string; staffId: string | null }>> {
  const result = await fetchPortalStaff();
  if (result.error) return {};
  return Object.fromEntries(
    result.data.map((staff) => [staff.profileId, { fullName: staff.fullName, staffId: staff.staffId }]),
  );
}

export async function updatePortalStaffId(
  profileId: string,
  staffId: string | null,
): Promise<ClinicalResult<{ profileId: string; staffId: string | null }>> {
  const normalized = normalizeStaffId(staffId);
  return runClinicalMutation('Failed to update staff ID', async () => {
    const supabase = createClient();
    return supabase
      .from('profiles')
      .update({ staff_id: normalized })
      .eq('id', profileId)
      .is('deleted_at', null)
      .select('id, staff_id')
      .single();
  }).then((result) => ({
    data: result.data
      ? { profileId: (result.data as { id: string; staff_id: string | null }).id, staffId: normalizeStaffId((result.data as { staff_id: string | null }).staff_id) }
      : null,
    error: result.error,
  }));
}

export async function auditPortalStaffIds(): Promise<{
  withStaffId: StaffIdentity[];
  missingStaffId: StaffIdentity[];
  duplicateGroups: Array<{ staffId: string; members: StaffIdentity[] }>;
}> {
  const result = await fetchPortalStaff();
  const active = result.data.filter((row) => row.isActive);
  const withStaffId = active.filter((row) => row.staffId);
  const missingStaffId = active.filter((row) => !row.staffId);

  const groups = new Map<string, StaffIdentity[]>();
  for (const member of withStaffId) {
    const key = member.staffId!.toLowerCase();
    const list = groups.get(key) ?? [];
    list.push(member);
    groups.set(key, list);
  }

  const duplicateGroups = [...groups.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([staffId, members]) => ({ staffId, members }));

  return { withStaffId, missingStaffId, duplicateGroups };
}
