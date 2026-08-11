import { describe, expect, it } from 'vitest';
import { computeLiveOverallStatus } from '@/lib/qc-records/live-status';
import type { QCLiveRecord } from '@/types';

function makeRecord(overrides: Partial<QCLiveRecord> = {}): QCLiveRecord {
  return {
    id: '1',
    instrumentId: 'inst-1',
    instrumentName: 'Alinity HQ 1147',
    liveViewSlug: 'alinity-hq-1147',
    parameter: 'WBC',
    level: 'Normal',
    recordedAt: '2026-08-11T10:00:00Z',
    qcStatus: 'IN',
    correctiveActions: [],
    updatedAt: '2026-08-11T10:00:00Z',
    ...overrides,
  };
}

describe('computeLiveOverallStatus', () => {
  it('returns NO QC RECORD AVAILABLE when empty', () => {
    const result = computeLiveOverallStatus([]);
    expect(result.status).toBe('NO QC RECORD AVAILABLE');
    expect(result.unresolvedOut).toBe(0);
  });

  it('returns ATTENTION when unresolved OUT exists', () => {
    const records = [
      makeRecord({ qcStatus: 'OUT', resolutionStatus: 'Pending' }),
      makeRecord({ id: '2', qcStatus: 'IN' }),
    ];
    const result = computeLiveOverallStatus(records);
    expect(result.status).toBe('ATTENTION — UNRESOLVED OUT QC');
    expect(result.unresolvedOut).toBe(1);
  });

  it('returns IN when all OUT are resolved', () => {
    const records = [
      makeRecord({ qcStatus: 'OUT', resolutionStatus: 'IN', resolvedAt: '2026-08-11T11:00:00Z' }),
      makeRecord({ id: '2', qcStatus: 'IN' }),
    ];
    const result = computeLiveOverallStatus(records);
    expect(result.status).toBe('QC STATUS — IN');
    expect(result.unresolvedOut).toBe(0);
  });
});
