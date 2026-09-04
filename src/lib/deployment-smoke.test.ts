import { describe, it, expect } from 'vitest';
import { taskFormSchema } from '@/lib/tasks/schema';
import { qcRecordFormSchema } from '@/lib/qc-records/schema';
import { MALARIA_QC_A_PARAMETER } from '@/lib/qc-records/malaria-qc';
import {
  computeDifference,
  deriveReagentResultInterpretation,
} from '@/lib/inventory/constants';
import { hasPermission } from '@/lib/permissions/roles';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

describe('Deployment smoke — task assignment', () => {
  it('accepts multiple employee assignees', () => {
    const parsed = taskFormSchema.safeParse({
      title: 'Smoke task',
      priority: 'medium',
      assigneeIds: [UUID_A, UUID_B],
      dueDate: '2026-09-10',
      taskType: 'team',
      recurrence: 'none',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects task form with no assignees', () => {
    const parsed = taskFormSchema.safeParse({
      title: 'Smoke task',
      priority: 'medium',
      assigneeIds: [],
      dueDate: '2026-09-10',
      taskType: 'team',
      recurrence: 'none',
    });
    expect(parsed.success).toBe(false);
  });

  it('lab_manager can manage tasks for assignment workflow', () => {
    expect(hasPermission('lab_manager', 'tasks.manage')).toBe(true);
  });
});

describe('Deployment smoke — Malaria QC lot gate', () => {
  const malariaBase = {
    instrumentId: UUID_A,
    instrumentName: 'Manual Test',
    parameter: MALARIA_QC_A_PARAMETER,
    level: '',
    recordedAt: '2026-09-05T10:00',
    qcFrequency: 'daily' as const,
    qcStatus: 'IN' as const,
    correctiveActions: [] as const,
    outParameters: [],
    markAllOut: false,
  };

  it('blocks Malaria QC save without active lot', () => {
    const parsed = qcRecordFormSchema.safeParse(malariaBase);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes('malariaLotUsageId'))).toBe(true);
    }
  });

  it('allows Malaria QC save when lot is selected', () => {
    const parsed = qcRecordFormSchema.safeParse({
      ...malariaBase,
      malariaLotUsageId: UUID_B,
      malariaLotNumber: 'MAL-2026-01',
      malariaLotExpiryDate: '2026-12-31',
      malariaControlLevel: 'Screening Kit',
    });
    expect(parsed.success).toBe(true);
  });
});

describe('Deployment smoke — Lot-to-Lot evaluation', () => {
  it('computes difference and percent', () => {
    const diff = computeDifference(100, 105);
    expect(diff.differenceUnits).toBe(5);
    expect(diff.differencePercent).toBe(5);
  });

  it('passes when within acceptance percent', () => {
    expect(deriveReagentResultInterpretation(true, 100, 105, 10)).toBe('acceptable');
  });

  it('fails when outside acceptance percent', () => {
    expect(deriveReagentResultInterpretation(true, 100, 120, 10)).toBe('not_acceptable');
  });

  it('requires configured criteria before pass/fail', () => {
    expect(deriveReagentResultInterpretation(false, 100, 105)).toBe('criteria_not_configured');
  });
});

describe('Deployment smoke — approval permissions', () => {
  it('inventory.manage required for lot-to-lot workflow is granted to inventory_officer', () => {
    expect(hasPermission('inventory_officer', 'inventory.manage')).toBe(true);
  });

  it('quality_officer has full inventory permissions after role update', () => {
    expect(hasPermission('quality_officer', 'inventory.view')).toBe(true);
    expect(hasPermission('quality_officer', 'inventory.manage')).toBe(true);
  });

  it('lab_manager can view inventory but not manage lot-to-lot approvals', () => {
    expect(hasPermission('lab_manager', 'inventory.view')).toBe(true);
    expect(hasPermission('lab_manager', 'inventory.manage')).toBe(false);
  });

  it('team_leader can manage tasks for multi-assignee workflow', () => {
    expect(hasPermission('team_leader', 'tasks.manage')).toBe(true);
  });
});
