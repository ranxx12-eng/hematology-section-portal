import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';

export interface StaffContext {
  userId: string;
  fullName: string;
  staffId: string;
}

export interface EmployeeContext extends StaffContext {
  employeeId: string;
}

export async function resolveStaffContext(user: Profile): Promise<StaffContext> {
  let staffId = `STAFF-${user.id.slice(0, 8).toUpperCase()}`;

  if (user.employeeId) {
    const supabase = createClient();
    const { data } = await supabase
      .from('employees')
      .select('employee_code')
      .eq('id', user.employeeId)
      .is('deleted_at', null)
      .maybeSingle();

    if (data?.employee_code) {
      staffId = data.employee_code;
    }
  }

  return {
    userId: user.id,
    fullName: user.fullName,
    staffId,
  };
}

export async function resolveEmployeeContext(user: Profile): Promise<EmployeeContext | null> {
  if (!user.employeeId) return null;
  const staff = await resolveStaffContext(user);
  return {
    ...staff,
    employeeId: user.employeeId,
  };
}
