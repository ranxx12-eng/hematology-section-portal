import { describe, it, expect } from 'vitest';
import {
  buildStaffIdIndex,
  formatPortalAccountLabel,
  formatPortalLoginLabel,
  hasUnlinkedAssigneeSelection,
  parseEmployeeDuplicateError,
  resolveEmployeePortalLink,
  unknownPortalLinkStatus,
  UNLINKED_ASSIGNEE_WARNING,
} from '@/lib/employees/portal-link';
import { attachPortalLinkFromProfiles } from '@/lib/clinical/employees-shared';
import { employeeFormSchema, emptyEmployeeForm } from '@/lib/employees/schema';
import { normalizeOptionalHireDate, formatHireDateDisplay, HIRE_DATE_NOT_RECORDED } from '@/lib/employees/hire-date';
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
  hireDate: null,
  employmentStatus: 'active',
  shift: 'morning',
  isActive: true,
  createdAt: '',
  updatedAt: '',
};

describe('Employee portal link resolution', () => {
  it('links Rawan employee to profile with matching Hospital Staff ID only', () => {
    const profiles = [
      { employeeId: null, staffId: '399894', isActive: true, portalRole: 'quality_officer' as const },
    ];
    const index = buildStaffIdIndex(profiles);
    const status = resolveEmployeePortalLink('399894', null, index);

    expect(status.linkState).toBe('not_linked');
    expect(status.portalLinked).toBe(false);
    expect(status.canLinkByStaffId).toBe(true);
  });

  it('marks employee as linked when profile.employee_id matches', () => {
    const profiles = [
      { employeeId: RAWAN_EMPLOYEE.id, staffId: '399894', isActive: true, portalRole: 'quality_officer' as const },
    ];
    const linked = attachPortalLinkFromProfiles([RAWAN_EMPLOYEE], profiles)[0];

    expect(linked.portalLink.portalLinked).toBe(true);
    expect(linked.portalLink.linkState).toBe('linked');
    expect(linked.portalLink.portalLoginActive).toBe(true);
    expect(linked.portalRole).toBe('quality_officer');
    expect(formatPortalAccountLabel(linked.portalLink)).toBe('Linked');
    expect(formatPortalLoginLabel(linked.portalLink)).toBe('Active');
  });

  it('does not guess links from similar names', () => {
    const profiles = [
      { employeeId: null, staffId: '111111', isActive: true, portalRole: null },
    ];
    const index = buildStaffIdIndex(profiles);
    const status = resolveEmployeePortalLink('399894', null, index);

    expect(status.canLinkByStaffId).toBe(false);
    expect(status.linkState).toBe('not_linked');
  });

  it('rejects ambiguous staff_id matches for manual link', () => {
    const profiles = [
      { employeeId: null, staffId: '399894', isActive: true, portalRole: null },
      { employeeId: null, staffId: '399894', isActive: true, portalRole: null },
    ];
    const index = buildStaffIdIndex(profiles);
    const status = resolveEmployeePortalLink('399894', null, index);

    expect(status.canLinkByStaffId).toBe(false);
  });

  it('surfaces unknown link state instead of not linked', () => {
    const status = unknownPortalLinkStatus();
    expect(status.linkState).toBe('unknown');
    expect(formatPortalAccountLabel(status)).toBe('Link status unavailable');
  });

  it('warns when unlinked employees are selected for assignment', () => {
    const employees = [
      { id: 'emp-1', linkState: 'not_linked' as const },
      { id: 'emp-2', linkState: 'linked' as const },
    ];
    expect(hasUnlinkedAssigneeSelection(['emp-1'], employees)).toBe(true);
    expect(hasUnlinkedAssigneeSelection(['emp-2'], employees)).toBe(false);
    expect(hasUnlinkedAssigneeSelection(['emp-1'], [{ id: 'emp-1', linkState: 'unknown' }])).toBe(false);
    expect(UNLINKED_ASSIGNEE_WARNING).toContain('My Tasks');
  });
});

describe('Employee hire date handling', () => {
  it('stores null when hire date is omitted', () => {
    expect(normalizeOptionalHireDate(undefined)).toBeNull();
    expect(normalizeOptionalHireDate('')).toBeNull();
    expect(normalizeOptionalHireDate('   ')).toBeNull();
  });

  it('preserves verified hire date when provided', () => {
    expect(normalizeOptionalHireDate('2024-03-15')).toBe('2024-03-15');
  });

  it('displays Not recorded for null hire dates', () => {
    expect(formatHireDateDisplay(null, 'en')).toBe(HIRE_DATE_NOT_RECORDED);
    expect(formatHireDateDisplay(undefined, 'en')).toBe(HIRE_DATE_NOT_RECORDED);
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

  it('accepts valid employee form without hire date', () => {
    const parsed = employeeFormSchema.safeParse({
      ...emptyEmployeeForm(),
      fullName: 'Test User',
      employeeCode: '123456',
      email: 'test@example.com',
      jobTitle: 'Technologist',
      isActive: true,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(normalizeOptionalHireDate(parsed.data.hireDate)).toBeNull();
    }
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

  it('does not grant employees.manage to lab technologist', () => {
    expect(hasPermission('lab_technologist', 'employees.manage')).toBe(false);
  });
});

describe('Inactive employee exclusion contract', () => {
  it('fetchEmployeeOptions returns structured result with link state fields', async () => {
    const { fetchEmployeeOptions } = await import('@/lib/clinical/tasks');
    const result = await fetchEmployeeOptions();
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('portalLinkError');
    expect(Array.isArray(result.data)).toBe(true);
    if (result.data.length > 0) {
      for (const employee of result.data) {
        expect(employee).toHaveProperty('portalLinkState');
        expect(employee).toHaveProperty('portalLoginActive');
        expect(employee).toHaveProperty('employeeCode');
      }
    }
  });
});
