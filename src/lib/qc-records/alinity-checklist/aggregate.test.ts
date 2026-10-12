import { describe, expect, it } from 'vitest';
import { daysInMonth } from '@/lib/qc-records/alinity-checklist/calendar';
import {
  ALINITY_RUN_AGGREGATION,
  alinityRequiredParameters,
  buildAlinityChecklist,
  type ChecklistQcResult,
} from '@/lib/qc-records/alinity-checklist/aggregate';

const REQUIRED = alinityRequiredParameters();

function result(overrides: Partial<ChecklistQcResult> & Pick<ChecklistQcResult, 'id' | 'parameter'>): ChecklistQcResult {
  return {
    instrumentId: '11111111-1111-4111-8111-111111111111',
    level: 'Normal',
    recordedAt: '2026-07-15T06:00:00.000Z',
    qcStatus: 'IN',
    qcBatchId: 'batch-1',
    correctiveActions: [],
    reviewStatus: 'Pending Review',
    performedByUserId: 'tech-1',
    performedByName: 'Lama Hassan',
    performedByStaffId: 'T-1001',
    ...overrides,
  };
}

function completeBatch(batchId: string, status: 'IN' | 'OUT' = 'IN'): ChecklistQcResult[] {
  return REQUIRED.map((parameter, index) => result({
    id: `${batchId}-${index}`,
    parameter,
    qcBatchId: batchId,
    qcStatus: status === 'OUT' && index === 0 ? 'OUT' : 'IN',
  }));
}

describe('Alinity checklist calendar', () => {
  it('uses real month lengths, including leap-year February', () => {
    expect(daysInMonth(2026, 7)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
  });
});

describe('Alinity checklist aggregation', () => {
  it('accepts a complete in-range batch and leaves the other instrument and slot blank', () => {
    const built = buildAlinityChecklist({
      year: 2026,
      month: 7,
      links: [{ day: 15, slot: 'run_1', qcBatchId: 'batch-1' }],
      records: completeBatch('batch-1'),
      attestations: [],
    });
    const day = built.days.find((entry) => entry.day === 15);
    expect(built.days).toHaveLength(31);
    expect(day?.run1.mark).toBe('accept');
    expect(day?.run2.mark).toBe('blank');
    expect(day?.run1.technicians.map((person) => person.fullName)).toEqual(['Lama Hassan']);
    expect(day?.qcCheck).toBe(false);
    expect(built.aggregation).toBe(ALINITY_RUN_AGGREGATION);
  });

  it('does not accept a batch while a required parameter is missing', () => {
    const built = buildAlinityChecklist({
      year: 2026,
      month: 7,
      links: [{ day: 15, slot: 'run_1', qcBatchId: 'batch-1' }],
      records: [result({ id: 'only-wbc', parameter: 'WBC' })],
      attestations: [],
    });
    expect(built.days[14]?.run1.mark).toBe('incomplete');
  });

  it('keeps the original reject after a resolved repeat', () => {
    const records = completeBatch('batch-1', 'OUT').map((entry) => (
      entry.qcStatus === 'OUT'
        ? {
          ...entry,
          correctiveActions: ['Repeat'],
          correctiveActionComment: 'Repeated the control',
          resolutionStatus: 'IN' as const,
        }
        : entry
    ));
    const built = buildAlinityChecklist({
      year: 2026,
      month: 7,
      links: [{ day: 15, slot: 'run_2', qcBatchId: 'batch-1' }],
      records,
      attestations: [],
    });
    expect(built.days[14]?.run2.mark).toBe('reject');
    expect(built.days[14]?.run2.correction).toBe('IN');
    expect(built.days[14]?.run1.mark).toBe('blank');
  });

  it('does not guess a run slot from chronological order', () => {
  const built = buildAlinityChecklist({
    year: 2026,
    month: 4,
    links: [],
    records: completeBatch('batch-early').map((entry) => ({
      ...entry,
      recordedAt: '2026-04-15T06:00:00.000Z',
    })).concat(completeBatch('batch-late').map((entry) => ({
      ...entry,
      recordedAt: '2026-04-15T12:00:00.000Z',
    }))),
    attestations: [],
  });
    expect(built.days).toHaveLength(30);
    expect(built.days.every((day) => day.run1.mark === 'blank' && day.run2.mark === 'blank')).toBe(true);
    expect(built.unassigned.map((run) => run.batchId).sort()).toEqual(['batch-early', 'batch-late']);
  });

  it('keeps every technician and requires an explicit review and CV attestation', () => {
    const records = completeBatch('batch-1').map((entry, index) => ({
      ...entry,
      performedByUserId: index === 0 ? 'tech-1' : 'tech-2',
      performedByName: index === 0 ? 'Lama Hassan' : 'Huda Ali',
      performedByStaffId: index === 0 ? 'T-1001' : 'T-1002',
      reviewStatus: 'Reviewed' as const,
      reviewedByUserId: 'senior-1',
      reviewedByName: 'Nora Saleh',
      reviewedByStaffId: 'S-2002',
    }));
    const withoutCv = buildAlinityChecklist({
      year: 2024,
      month: 2,
      links: [{ day: 29, slot: 'run_1', qcBatchId: 'batch-1' }],
      records: records.map((entry) => ({ ...entry, recordedAt: '2024-02-29T06:00:00.000Z' })),
      attestations: [],
    });
    expect(withoutCv.days).toHaveLength(29);
    const day = withoutCv.days[28];
    expect(day?.run1.technicians.map((person) => person.staffId).sort()).toEqual(['T-1001', 'T-1002']);
    expect(day?.qcCheck).toBe(true);
    expect(day?.seniors.map((person) => person.fullName)).toEqual(['Nora Saleh']);
    expect(day?.cvMonitoring).toBeNull();
    expect(withoutCv.legend.find((entry) => entry.fullName === 'Nora Saleh')?.code).toBeTruthy();
    expect(withoutCv.legend.some((entry) => entry.fullName.includes('senior-1'))).toBe(false);
  });

  it('uses CV attestation only when that review was recorded', () => {
    const built = buildAlinityChecklist({
      year: 2026,
      month: 2,
      links: [],
      records: [],
      attestations: [{
        day: 10,
        attestedByUserId: 'senior-1',
        attestedByName: 'Nora Saleh',
        attestedByStaffId: 'S-2002',
        attestedAt: '2026-02-10T12:00:00.000Z',
      }],
    });
    expect(built.days).toHaveLength(28);
    expect(built.days[9]?.cvMonitoring?.fullName).toBe('Nora Saleh');
    expect(built.days[9]?.qcCheck).toBe(false);
    expect(built.days[10]?.cvMonitoring).toBeNull();
  });

  it('does not treat a uuid as a person name', () => {
    const records = completeBatch('batch-1').map((entry) => ({
      ...entry,
      performedByName: '11111111-1111-4111-8111-111111111111',
      performedByStaffId: 'T-1001',
    }));
    const built = buildAlinityChecklist({
      year: 2026,
      month: 7,
      links: [{ day: 1, slot: 'run_1', qcBatchId: 'batch-1' }],
      records,
      attestations: [],
    });
    expect(built.days[0]?.run1.technicians[0]?.fullName).toBe('Name not recorded');
  });
});
