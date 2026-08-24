import type { Profile } from '@/types';
import { resolveVisibleStaffId } from '@/lib/staff/identity';

export interface StaffContext {
  userId: string;
  fullName: string;
  staffId: string | null;
}

export interface EmployeeContext extends StaffContext {
  employeeId: string;
}

export async function resolveStaffContext(user: Profile): Promise<StaffContext> {
  let linkedEmployeeCode: string | null = null;

  if (user.employeeId) {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    const { data } = await supabase
      .from('employees')
      .select('employee_code')
      .eq('id', user.employeeId)
      .is('deleted_at', null)
      .maybeSingle();

    linkedEmployeeCode = data?.employee_code ?? null;
  }

  return {
    userId: user.id,
    fullName: user.fullName,
    staffId: resolveVisibleStaffId(user.staffId, linkedEmployeeCode),
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
