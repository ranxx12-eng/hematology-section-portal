import { describe, it, expect } from 'vitest';
import { hasPermission, canViewEvaluations, ROLE_PERMISSIONS } from '@/lib/permissions/roles';

describe('Permission System', () => {
  it('system_admin has all permissions', () => {
    expect(hasPermission('system_admin', 'users.manage')).toBe(true);
    expect(hasPermission('system_admin', 'audit.view')).toBe(true);
    expect(hasPermission('system_admin', 'settings.manage')).toBe(true);
  });

  it('read_only has limited permissions', () => {
    expect(hasPermission('read_only', 'employees.view')).toBe(true);
    expect(hasPermission('read_only', 'employees.manage')).toBe(false);
    expect(hasPermission('read_only', 'settings.manage')).toBe(false);
  });

  it('quality_officer can manage QC and critical values', () => {
    expect(hasPermission('quality_officer', 'qc.manage')).toBe(true);
    expect(hasPermission('quality_officer', 'critical_values.manage')).toBe(true);
    expect(hasPermission('quality_officer', 'employees.manage')).toBe(false);
  });

  it('legacy quality_link maps to quality_officer permissions', () => {
    expect(hasPermission('quality_link', 'qc.manage')).toBe(true);
  });

  it('lab_technologist cannot manage employees', () => {
    expect(hasPermission('lab_technologist', 'tasks.view')).toBe(true);
    expect(hasPermission('lab_technologist', 'employees.manage')).toBe(false);
  });

  it('lab_technologist can operate critical values, rejections, and QC', () => {
    expect(hasPermission('lab_technologist', 'critical_values.view')).toBe(true);
    expect(hasPermission('lab_technologist', 'critical_values.manage')).toBe(true);
    expect(hasPermission('lab_technologist', 'sample_rejections.view')).toBe(true);
    expect(hasPermission('lab_technologist', 'sample_rejections.manage')).toBe(true);
    expect(hasPermission('lab_technologist', 'qc.view')).toBe(true);
    expect(hasPermission('lab_technologist', 'qc.manage')).toBe(true);
    expect(hasPermission('lab_technologist', 'maintenance.view')).toBe(false);
    expect(hasPermission('lab_technologist', 'users.manage')).toBe(false);
    expect(hasPermission('lab_technologist', 'settings.manage')).toBe(false);
  });

  it('senior_lab_technologist has manage permissions plus maintenance hierarchy', () => {
    expect(hasPermission('senior_lab_technologist', 'critical_values.manage')).toBe(true);
    expect(hasPermission('senior_lab_technologist', 'sample_rejections.manage')).toBe(true);
    expect(hasPermission('senior_lab_technologist', 'qc.manage')).toBe(true);
    expect(hasPermission('senior_lab_technologist', 'maintenance.manage')).toBe(true);
    expect(hasPermission('senior_lab_technologist', 'users.manage')).toBe(false);
  });

  it('trainee has minimal permissions', () => {
    expect(hasPermission('trainee', 'training.view')).toBe(true);
    expect(hasPermission('trainee', 'qc.view')).toBe(false);
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
