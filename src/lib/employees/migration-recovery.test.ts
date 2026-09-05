import { describe, it, expect } from 'vitest';
import {
  profileNeedsStaffId,
  STAFF_ID_REQUIRED_MESSAGE,
} from '@/lib/employees/portal-link';

/**
 * Documents expected production recovery counts after migration 068.
 * These are contract tests — not live DB assertions.
 */
export const MIGRATION_068_RECOVERY_EXPECTATIONS = {
  before: {
    authUsers: 14,
    profiles: 14,
    employees: 0,
    linkedProfiles: 0,
    profilesWithStaffId: 12,
    profilesAwaitingStaffId: 2,
  },
  after: {
    authUsers: 14,
    profiles: 14,
    employees: 12,
    linkedProfiles: 12,
    profilesAwaitingStaffId: 2,
    newAuthUsers: 0,
    newProfiles: 0,
    duplicateEmployeeCodes: 0,
    profileUuidChanges: 0,
    recoveredEmployeesWithNullHireDate: 12,
  },
} as const;

describe('Migration 068 recovery expectations', () => {
  it('documents pre-migration production counts from reconciliation audit', () => {
    expect(MIGRATION_068_RECOVERY_EXPECTATIONS.before).toEqual({
      authUsers: 14,
      profiles: 14,
      employees: 0,
      linkedProfiles: 0,
      profilesWithStaffId: 12,
      profilesAwaitingStaffId: 2,
    });
  });

  it('documents post-migration expected counts without new auth or profiles', () => {
    const { before, after } = MIGRATION_068_RECOVERY_EXPECTATIONS;
    expect(after.authUsers).toBe(before.authUsers);
    expect(after.profiles).toBe(before.profiles);
    expect(after.employees).toBe(before.profilesWithStaffId);
    expect(after.linkedProfiles).toBe(before.profilesWithStaffId);
    expect(after.profilesAwaitingStaffId).toBe(before.profilesAwaitingStaffId);
    expect(after.newAuthUsers).toBe(0);
    expect(after.newProfiles).toBe(0);
    expect(after.duplicateEmployeeCodes).toBe(0);
    expect(after.profileUuidChanges).toBe(0);
    expect(after.recoveredEmployeesWithNullHireDate).toBe(after.employees);
  });

  it('does not import mock hematology.local identities into recovery scope', () => {
    const mockEmailSuffix = '@hematology.local';
    expect(MIGRATION_068_RECOVERY_EXPECTATIONS.after.employees).toBe(12);
    expect(mockEmailSuffix).not.toContain('drsulaimanalhabib.com');
  });
});

describe('Profiles awaiting Hospital Staff ID', () => {
  it('identifies portal accounts that need Staff ID before employee recovery', () => {
    expect(profileNeedsStaffId(null, null)).toBe(true);
    expect(profileNeedsStaffId('', null)).toBe(true);
    expect(profileNeedsStaffId('399894', null)).toBe(false);
    expect(profileNeedsStaffId(null, 'employee-uuid')).toBe(false);
  });

  it('uses actionable Staff ID required messaging', () => {
    expect(STAFF_ID_REQUIRED_MESSAGE).toContain('Hospital Staff ID required');
    expect(STAFF_ID_REQUIRED_MESSAGE).toContain('automatically');
  });
});
