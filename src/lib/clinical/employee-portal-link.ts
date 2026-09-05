import { createClient } from '@/lib/supabase/client';
import type { Employee } from '@/types';
import {
  buildStaffIdIndex,
  resolveEmployeePortalLink,
  type EmployeePortalLinkStatus,
  type ProfileLinkRow,
} from '@/lib/employees/portal-link';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';
import { mapEmployee, type EmployeeRow } from './employees-shared';

export interface EmployeeWithPortalLink extends Employee {
  portalLink: EmployeePortalLinkStatus;
}

interface ProfileRow {
  id: string;
  employee_id: string | null;
  staff_id: string | null;
  is_active: boolean;
}

const EMPLOYEE_WITH_LINK_SELECT = '*';

async function fetchProfileLinkRows(): Promise<ProfileLinkRow[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('employee_id, staff_id, is_active')
      .is('deleted_at', null);

    if (error || !data) return [];
    return (data as ProfileRow[]).map((row) => ({
      employeeId: row.employee_id,
      staffId: row.staff_id,
      isActive: row.is_active,
    }));
  } catch {
    return [];
  }
}

export function attachPortalLinkStatus(
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

  return employees.map((employee) => ({
    ...employee,
    portalLink: resolveEmployeePortalLink(
      employee.employeeId,
      linkedByEmployeeId.get(employee.id) ?? null,
      staffIdIndex,
    ),
  }));
}

export async function fetchEmployeesWithPortalLink(): Promise<ClinicalListResult<EmployeeWithPortalLink>> {
  const [employeeResult, profiles] = await Promise.all([
    runClinicalListQuery('Failed to load employees', async () => {
      const supabase = createClient();
      return supabase
        .from('employees')
        .select(EMPLOYEE_WITH_LINK_SELECT)
        .is('deleted_at', null)
        .order('full_name');
    }),
    fetchProfileLinkRows(),
  ]);

  if (employeeResult.error) {
    return { data: [], error: employeeResult.error };
  }

  const employees = (employeeResult.data as unknown as EmployeeRow[]).map(mapEmployee);
  return {
    data: attachPortalLinkStatus(employees, profiles),
    error: null,
  };
}

interface LinkRpcResult {
  success: boolean;
  code: string;
  message?: string;
}

export async function linkEmployeeToPortalAccount(
  employeeId: string,
): Promise<ClinicalResult<{ code: string; message?: string }>> {
  return runClinicalMutation('Failed to link portal account', async () => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('link_employee_to_portal_account', {
      p_employee_id: employeeId,
    });

    if (error) {
      return { data: null, error };
    }

    const payload = data as LinkRpcResult;
    if (!payload?.success) {
      return {
        data: null,
        error: {
          message: payload?.message ?? payload?.code ?? 'Unable to link portal account',
        },
      };
    }

    return {
      data: { code: payload.code, message: payload.message },
      error: null,
    };
  }).then((result) => ({
    data: result.data,
    error: result.error,
  }));
}
