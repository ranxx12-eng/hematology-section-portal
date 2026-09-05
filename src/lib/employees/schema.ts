import { z } from 'zod';
import type { Employee } from '@/types';
import { ROLES, type Role } from '@/lib/permissions/roles';

export const EMPLOYMENT_STATUSES = ['active', 'inactive', 'on_leave'] as const;
export const SHIFTS = ['morning', 'evening', 'night'] as const;

export const employeeFormSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  employeeCode: z.string().min(1, 'Hospital Staff ID is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  jobTitle: z.string().min(1, 'Job title is required'),
  role: z.enum(ROLES as unknown as [Role, ...Role[]]),
  section: z.string().min(1).default('Hematology'),
  employmentStatus: z.enum(EMPLOYMENT_STATUSES).default('active'),
  isActive: z.boolean().default(true),
  shift: z.enum(SHIFTS).default('morning'),
  hireDate: z.string().optional(),
});

export type EmployeeFormData = z.infer<typeof employeeFormSchema>;

export function emptyEmployeeForm(): EmployeeFormData {
  return {
    fullName: '',
    employeeCode: '',
    email: '',
    phone: '',
    jobTitle: 'Lab Technologist',
    role: 'lab_technologist',
    section: 'Hematology',
    employmentStatus: 'active',
    isActive: true,
    shift: 'morning',
  };
}

export function employeeToForm(employee: Employee): EmployeeFormData {
  return {
    fullName: employee.fullName,
    employeeCode: employee.employeeId,
    email: employee.email,
    phone: employee.phone,
    jobTitle: employee.jobTitle,
    role: employee.role,
    section: employee.section,
    employmentStatus: employee.employmentStatus,
    isActive: employee.isActive,
    shift: employee.shift,
    hireDate: employee.hireDate.slice(0, 10),
  };
}
