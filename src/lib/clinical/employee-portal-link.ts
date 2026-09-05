import { createClient } from '@/lib/supabase/client';
import { normalizeRole } from '@/lib/auth/profile';
import type { Role } from '@/lib/permissions/roles';
import type { Employee } from '@/types';
import {
  attachPortalLinkFromProfiles,
  type EmployeeWithPortalLink,
} from '@/lib/clinical/employees-shared';
import {
  type ProfileLinkRow,
  unknownPortalLinkStatus,
} from '@/lib/employees/portal-link';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';
import { mapEmployee, type EmployeeRow } from './employees-shared';

export type { EmployeeWithPortalLink };

interface ProfileRow {
  employee_id: string | null;
  staff_id: string | null;
  is_active: boolean;
  roles: { name: string } | { name: string }[] | null;
}

const PROFILE_LINK_SELECT = `
  employee_id,
  staff_id,
  is_active,
  roles!primary_role_id ( name )
`;

function mapProfileLinkRow(row: ProfileRow): ProfileLinkRow {
  const roleJoined = row.roles;
  const roleName = Array.isArray(roleJoined) ? roleJoined[0]?.name : roleJoined?.name;
  return {
    employeeId: row.employee_id,
    staffId: row.staff_id,
    isActive: row.is_active,
    portalRole: roleName ? normalizeRole(roleName) : null,
  };
}

export async function fetchProfileLinkRows(): Promise<{
  data: ProfileLinkRow[];
  error: string | null;
}> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_LINK_SELECT)
      .is('deleted_at', null);

    if (error) {
      return { data: [], error: error.message };
    }

    return {
      data: ((data ?? []) as ProfileRow[]).map(mapProfileLinkRow),
      error: null,
    };
  } catch (err) {
    return {
      data: [],
      error: err instanceof Error ? err.message : 'Failed to load portal link status',
    };
  }
}

export async function fetchEmployeesWithPortalLink(): Promise<
  ClinicalListResult<EmployeeWithPortalLink> & { portalLinkError: string | null }
> {
  const employeeResult = await runClinicalListQuery('Failed to load employees', async () => {
    const supabase = createClient();
    return supabase
      .from('employees')
      .select('*')
      .is('deleted_at', null)
      .order('full_name');
  });

  if (employeeResult.error) {
    return { data: [], error: employeeResult.error, portalLinkError: null };
  }

  const employees = (employeeResult.data as unknown as EmployeeRow[]).map(mapEmployee);
  const profileResult = await fetchProfileLinkRows();

  if (profileResult.error) {
    return {
      data: employees.map((employee) => ({
        ...employee,
        portalLink: unknownPortalLinkStatus(),
        portalRole: null,
      })),
      error: null,
      portalLinkError: profileResult.error,
    };
  }

  return {
    data: attachPortalLinkFromProfiles(employees, profileResult.data),
    error: null,
    portalLinkError: null,
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
