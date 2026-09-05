import type { Role } from '@/lib/permissions/roles';
import type { Employee } from '@/types';
import {
  buildStaffIdIndex,
  resolveEmployeePortalLink,
  type EmployeePortalLinkStatus,
  type ProfileLinkRow,
} from '@/lib/employees/portal-link';

export interface EmployeeRow {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  job_title: string;
  role: Employee['role'];
  section: string;
  hire_date: string | null;
  employment_status: Employee['employmentStatus'];
  shift: Employee['shift'];
  supervisor_id: string | null;
  profile_photo: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeWithPortalLink extends Employee {
  portalLink: EmployeePortalLinkStatus;
  portalRole: Role | null;
}

export function mapEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    employeeId: row.employee_code,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone ?? undefined,
    jobTitle: row.job_title,
    role: row.role,
    section: row.section,
    hireDate: row.hire_date,
    employmentStatus: row.employment_status,
    shift: row.shift,
    supervisorId: row.supervisor_id ?? undefined,
    profilePhoto: row.profile_photo ?? undefined,
    notes: row.notes ?? undefined,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function attachPortalLinkFromProfiles(
  employees: Employee[],
  profiles: ProfileLinkRow[],
): EmployeeWithPortalLink[] {
  const linkedByEmployeeId = new Map<string, ProfileLinkRow>();
  for (const profile of profiles) {
    if (profile.employeeId) {
      linkedByEmployeeId.set(profile.employeeId, profile);
    }
  }
  const staffIdIndex = buildStaffIdIndex(profiles);

  return employees.map((employee) => {
    const linkedProfile = linkedByEmployeeId.get(employee.id) ?? null;
    return {
      ...employee,
      portalLink: resolveEmployeePortalLink(employee.employeeId, linkedProfile, staffIdIndex),
      portalRole: linkedProfile?.portalRole ?? null,
    };
  });
}
