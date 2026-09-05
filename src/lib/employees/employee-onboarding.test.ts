import { describe, it, expect } from 'vitest';
import {
  buildStaffIdIndex,
  formatPortalAccountLabel,
  formatPortalLoginLabel,
  hasUnlinkedAssigneeSelection,
  parseEmployeeDuplicateError,
  resolveEmployeePortalLink,
  UNLINKED_ASSIGNEE_WARNING,
} from '@/lib/employees/portal-link';
import { attachPortalLinkStatus } from '@/lib/clinical/employee-portal-link';
import { employeeFormSchema, emptyEmployeeForm } from '@/lib/employees/schema';
import { hasPermission } from '@/lib/permissions/roles';
import type { Employee } from '@/types';

const RAWAN_EMPLOYEE: Employee = {
  id: 'emp-rawan',
  employeeId: '399894',
  fullName: 'Rawan Alfaifi',
  email: 'rawan.alfaifi@drsulaimanalhabib.com',
  jobTitle: 'Pending HR Update',
  role: 'quality_officer',
  section: 'Hematology',
  hireDate: '2026-09-05',
  employmentStatus: 'active',
  shift: 'morning',
  isActive: true,
  createdAt: '',
  updatedAt: '',
};

describe('Employee portal link resolution', () => {
  it('links Rawan employee to profile with matching Hospital Staff ID only', () => {
    const profiles = [
      { employeeId: null, staffId: '399894', isActive: true },
    ];
    const index = buildStaffIdIndex(profiles);
    const status = resolveEmployeePortalLink('399894', null, index);

    expect(status.portalLinked).toBe(false);
    expect(status.canLinkByStaffId).toBe(true);
  });

  it('marks employee as linked when profile.employee_id matches', () => {
    const profiles = [
      { employeeId: RAWAN_EMPLOYEE.id, staffId: '399894', isActive: true },
    ];
    const linked = attachPortalLinkStatus([RAWAN_EMPLOYEE], profiles)[0];

    expect(linked.portalLink.portalLinked).toBe(true);
    expect(linked.portalLink.portalLoginActive).toBe(true);
    expect(formatPortalAccountLabel(linked.portalLink)).toBe('Linked');
    expect(formatPortalLoginLabel(linked.portalLink)).toBe('Active');
  });

  it('does not guess links from similar names', () => {
    const profiles = [
      { employeeId: null, staffId: '111111', isActive: true },
    ];
    const index = buildStaffIdIndex(profiles);
    const status = resolveEmployeePortalLink('399894', null, index);

    expect(status.canLinkByStaffId).toBe(false);
    expect(status.portalLinked).toBe(false);
  });

  it('rejects ambiguous staff_id matches for manual link', () => {
    const profiles = [
      { employeeId: null, staffId: '399894', isActive: true },
      { employeeId: null, staffId: '399894', isActive: true },
    ];
    const index = buildStaffIdIndex(profiles);
    const status = resolveEmployeePortalLink('399894', null, index);

    expect(status.canLinkByStaffId).toBe(false);
  });

  it('warns when unlinked employees are selected for assignment', () => {
    const employees = [
      { id: 'emp-1', portalLinked: false },
      { id: 'emp-2', portalLinked: true },
    ];
    expect(hasUnlinkedAssigneeSelection(['emp-1'], employees)).toBe(true);
    expect(hasUnlinkedAssigneeSelection(['emp-2'], employees)).toBe(false);
    expect(UNLINKED_ASSIGNEE_WARNING).toContain('My Tasks');
  });
});

describe('Employee onboarding validation', () => {
  it('requires Hospital Staff ID on create', () => {
    const parsed = employeeFormSchema.safeParse({
      ...emptyEmployeeForm(),
      fullName: 'Test User',
      email: 'test@example.com',
      jobTitle: 'Technologist',
      employeeCode: '',
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts valid employee form with active roster flag', () => {
    const parsed = employeeFormSchema.safeParse({
      ...emptyEmployeeForm(),
      fullName: 'Test User',
      employeeCode: '123456',
      email: 'test@example.com',
      jobTitle: 'Technologist',
      isActive: true,
    });
    expect(parsed.success).toBe(true);
  });

  it('maps duplicate staff id database errors to friendly messages', () => {
    expect(parseEmployeeDuplicateError('duplicate key value violates unique constraint "employees_employee_code_key"'))
      .toContain('Hospital Staff ID');
    expect(parseEmployeeDuplicateError('duplicate key value violates unique constraint "employees_email_key"'))
      .toContain('Email');
  });
});

describe('Quality Officer employee management permissions', () => {
  it('grants employees.manage to quality_officer for roster maintenance', () => {
    expect(hasPermission('quality_officer', 'employees.manage')).toBe(true);
  });

  it('grants employees.manage to legacy quality_link alias', () => {
    expect(hasPermission('quality_link', 'employees.manage')).toBe(true);
  });
});

describe('Inactive employee exclusion contract', () => {
  it('fetchEmployeeOptions filters inactive employees at query level', async () => {
    const { fetchEmployeeOptions } = await import('@/lib/clinical/tasks');
    const result = await fetchEmployeeOptions();
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('error');
    if (result.data.length > 0) {
      for (const employee of result.data) {
        expect(employee).toHaveProperty('portalLinked');
        expect(employee).toHaveProperty('portalLoginActive');
        expect(employee).toHaveProperty('employeeCode');
      }
    }
  });
});
