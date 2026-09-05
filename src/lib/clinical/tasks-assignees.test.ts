import { describe, it, expect } from 'vitest';
import {
  computeAssigneeDiff,
  exportTasksCsv,
  formatAssigneeNames,
  isTaskAssignee,
} from '@/lib/clinical/tasks';
import { taskToForm } from '@/lib/tasks/schema';
import { getRoleDisplayLabel, hasPermission } from '@/lib/permissions/roles';
import type { Task } from '@/types';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const UUID_C = '33333333-3333-4333-8333-333333333333';

describe('Task assignee sync helpers', () => {
  it('computes newly added and removed assignees without duplicates', () => {
    const diff = computeAssigneeDiff([UUID_A, UUID_B], [UUID_B, UUID_C]);
    expect(diff.toAdd).toEqual([UUID_C]);
    expect(diff.toRemove).toEqual([UUID_A]);
  });

  it('returns no changes when assignees are unchanged', () => {
    const diff = computeAssigneeDiff([UUID_A, UUID_B], [UUID_A, UUID_B]);
    expect(diff.toAdd).toEqual([]);
    expect(diff.toRemove).toEqual([]);
  });

  it('identifies task assignee membership', () => {
    const task = {
      assigneeIds: [UUID_A, UUID_B],
    } as Task;
    expect(isTaskAssignee(task, UUID_B)).toBe(true);
    expect(isTaskAssignee(task, UUID_C)).toBe(false);
  });

  it('exports all assignee names in CSV output', () => {
    const csv = exportTasksCsv([
      {
        id: 't1',
        title: 'Bench QC',
        status: 'in_progress',
        priority: 'high',
        assigneeIds: [UUID_A, UUID_B],
        assignedTo: UUID_A,
        assignedBy: 'user',
        startDate: '2026-09-01',
        dueDate: '2026-09-10',
        taskType: 'team',
        createdAt: '',
        updatedAt: '',
      },
    ], {
      [UUID_A]: 'Alice',
      [UUID_B]: 'Bob',
    });
    expect(csv).toContain('Alice, Bob');
  });

  it('round-trips task edit form assignees', () => {
    const task = {
      id: 't1',
      title: 'Review SOP',
      description: 'Monthly',
      priority: 'medium',
      status: 'not_started',
      assigneeIds: [UUID_A, UUID_B],
      assignedTo: UUID_A,
      assignedBy: 'user',
      dueDate: '2026-09-15',
      startDate: '2026-09-01',
      taskType: 'team',
      recurrence: 'monthly',
      createdAt: '',
      updatedAt: '',
    } as Task;
    const form = taskToForm(task);
    expect(form.assigneeIds).toEqual([UUID_A, UUID_B]);
    expect(formatAssigneeNames(form.assigneeIds, { [UUID_A]: 'Alice', [UUID_B]: 'Bob' })).toBe('Alice, Bob');
  });
});

describe('Quality role inventory permissions', () => {
  it('grants full inventory access to quality_officer', () => {
    expect(hasPermission('quality_officer', 'inventory.view')).toBe(true);
    expect(hasPermission('quality_officer', 'inventory.manage')).toBe(true);
  });

  it('grants full inventory access to legacy quality_link alias', () => {
    expect(hasPermission('quality_link', 'inventory.view')).toBe(true);
    expect(hasPermission('quality_link', 'inventory.manage')).toBe(true);
  });

  it('does not grant inventory.manage to lab technologist', () => {
    expect(hasPermission('lab_technologist', 'inventory.manage')).toBe(false);
  });
});

describe('Employee options loading contract', () => {
  it('fetchEmployeeOptions returns structured result with error field', async () => {
    const { fetchEmployeeOptions } = await import('@/lib/clinical/tasks');
    const result = await fetchEmployeeOptions();
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('portalLinkError');
    expect(Array.isArray(result.data)).toBe(true);
    if (result.data.length > 0) {
      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('fullName');
      expect(result.data[0]).toHaveProperty('portalLinkState');
    }
  });
});

describe('Role display labels', () => {
  it('shows Quality Link for legacy stored role', () => {
    expect(getRoleDisplayLabel('quality_officer', 'en', 'quality_link')).toBe('Quality Link');
  });

  it('shows Quality Officer for canonical role', () => {
    expect(getRoleDisplayLabel('quality_officer', 'en', 'quality_officer')).toBe('Quality Officer');
  });
});
