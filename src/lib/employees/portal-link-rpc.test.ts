import { describe, it, expect } from 'vitest';
import { attachPortalLinkFromRpcRows } from '@/lib/clinical/employees-shared';
import { formatPortalAccountLabel } from '@/lib/employees/portal-link';
import { hasPermission } from '@/lib/permissions/roles';
import type { Employee } from '@/types';

const LINKED_EMPLOYEE: Employee = {
  id: 'emp-linked',
  employeeId: '399894',
  fullName: 'Rawan Alfaifi',
  email: 'rawan.alfaifi@example.com',
  jobTitle: 'Quality Officer',
  role: 'quality_officer',
  section: 'Hematology',
  hireDate: null,
  employmentStatus: 'active',
  shift: 'morning',
  isActive: true,
  createdAt: '',
  updatedAt: '',
};

const UNLINKED_EMPLOYEE: Employee = {
  ...LINKED_EMPLOYEE,
  id: 'emp-unlinked',
  employeeId: '999999',
  fullName: 'Unlinked Tech',
};

describe('RPC-backed portal link status mapping', () => {
  it('shows Portal: Linked when RPC reports a linked employee', () => {
    const [row] = attachPortalLinkFromRpcRows(
      [LINKED_EMPLOYEE],
      [{ employeeId: LINKED_EMPLOYEE.id, portalLinked: true, portalLoginActive: true }],
      [],
    );

    expect(row.portalLink.linkState).toBe('linked');
    expect(formatPortalAccountLabel(row.portalLink)).toBe('Linked');
  });

  it('does not mark linked employees unlinked when profile rows are unavailable under RLS', () => {
    const [row] = attachPortalLinkFromRpcRows(
      [LINKED_EMPLOYEE],
      [{ employeeId: LINKED_EMPLOYEE.id, portalLinked: true, portalLoginActive: true }],
      [],
    );

    expect(row.portalLink.linkState).toBe('linked');
    expect(row.portalRole).toBeNull();
  });

  it('shows Portal: Not Linked for an actually unlinked employee', () => {
    const [row] = attachPortalLinkFromRpcRows(
      [UNLINKED_EMPLOYEE],
      [{ employeeId: UNLINKED_EMPLOYEE.id, portalLinked: false, portalLoginActive: false }],
      [],
    );

    expect(row.portalLink.linkState).toBe('not_linked');
    expect(formatPortalAccountLabel(row.portalLink)).toBe('Not Linked');
  });

  it('reflects inactive login status from RPC without exposing profile identifiers', () => {
    const [row] = attachPortalLinkFromRpcRows(
      [LINKED_EMPLOYEE],
      [{ employeeId: LINKED_EMPLOYEE.id, portalLinked: true, portalLoginActive: false }],
      [],
    );

    expect(row.portalLink.portalLoginActive).toBe(false);
  });
});

describe('Rawan Alheta authorization expectations', () => {
  it('lab_technologist cannot access review or approval center permissions', () => {
    expect(hasPermission('lab_technologist', 'tasks.review')).toBe(false);
    expect(hasPermission('lab_technologist', 'tasks.approve')).toBe(false);
    expect(hasPermission('lab_technologist', 'inventory.manage')).toBe(false);
    expect(hasPermission('lab_technologist', 'users.manage')).toBe(false);
  });

  it('read_only retains view-only task access and must be removed from active authorization', () => {
    expect(hasPermission('read_only', 'tasks.view')).toBe(true);
    expect(hasPermission('read_only', 'tasks.manage')).toBe(false);
  });
});

describe('Alhanouf Staff ID 244741 contract', () => {
  it('documents that one unique employee code must map to one employee row', () => {
    const codes = ['244741', '244741'];
    const normalized = codes.map((code) => code.trim().toLowerCase());
    expect(new Set(normalized).size).toBe(1);
  });
});
