import { describe, it, expect } from 'vitest';
import { hasPermission, canViewEvaluations, ROLE_PERMISSIONS } from '@/lib/permissions/roles';

describe('Permission System', () => {
  it('system_admin has all permissions', () => {
    expect(hasPermission('system_admin', 'users.manage')).toBe(true);
    expect(hasPermission('system_admin', 'audit.view')).toBe(true);
    expect(hasPermission('system_admin', 'settings.manage')).toBe(true);
  });

  it('viewer has limited permissions', () => {
    expect(hasPermission('viewer', 'employees.view')).toBe(true);
    expect(hasPermission('viewer', 'employees.manage')).toBe(false);
    expect(hasPermission('viewer', 'settings.manage')).toBe(false);
  });

  it('lab_technologist cannot manage employees', () => {
    expect(hasPermission('lab_technologist', 'tasks.view')).toBe(true);
    expect(hasPermission('lab_technologist', 'employees.manage')).toBe(false);
  });

  it('quality_link can manage QC and critical values', () => {
    expect(hasPermission('quality_link', 'qc.manage')).toBe(true);
    expect(hasPermission('quality_link', 'critical_values.manage')).toBe(true);
    expect(hasPermission('quality_link', 'employees.manage')).toBe(false);
  });

  it('canViewEvaluations returns true for management roles', () => {
    expect(canViewEvaluations('lab_director')).toBe(true);
    expect(canViewEvaluations('lab_technologist')).toBe(false);
  });

  it('all roles have at least one permission', () => {
    Object.values(ROLE_PERMISSIONS).forEach((perms) => {
      expect(perms.length).toBeGreaterThan(0);
    });
  });
});
