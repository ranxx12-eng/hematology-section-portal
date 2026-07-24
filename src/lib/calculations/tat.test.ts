import { describe, it, expect } from 'vitest';
import { calculateTATMinutes, getTATStatus, getTATPercentage, getKPIStatus, maskPatientId } from '@/lib/calculations/tat';

describe('TAT Calculations', () => {
  it('calculates TAT in minutes', () => {
    const received = new Date('2026-01-01T10:00:00');
    const released = new Date('2026-01-01T12:30:00');
    expect(calculateTATMinutes(received, released)).toBe(150);
  });

  it('returns within_target when under 85% of target', () => {
    expect(getTATStatus(100, 240)).toBe('within_target');
  });

  it('returns near_breach when between 85% and 100% of target', () => {
    expect(getTATStatus(210, 240)).toBe('near_breach');
  });

  it('returns breached when over target', () => {
    expect(getTATStatus(250, 240)).toBe('breached');
  });

  it('calculates TAT percentage', () => {
    expect(getTATPercentage(120, 240)).toBe(50);
  });

  it('returns achieved KPI when within target', () => {
    expect(getKPIStatus(200, 240, true)).toBe('achieved');
  });

  it('masks patient ID correctly', () => {
    expect(maskPatientId('DEMO-PAT-12345')).toBe('DE**********45');
  });

  it('masks short patient IDs', () => {
    expect(maskPatientId('AB')).toBe('****');
  });
});
