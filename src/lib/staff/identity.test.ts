import { describe, it, expect } from 'vitest';
import {
  formatStaffIdLabel,
  formatStaffOptionLabel,
  normalizeStaffId,
  resolveVisibleStaffId,
} from '@/lib/staff/identity';

describe('staff identity helpers', () => {
  it('normalizes blank staff IDs to null', () => {
    expect(normalizeStaffId('  123456  ')).toBe('123456');
    expect(normalizeStaffId('')).toBeNull();
    expect(normalizeStaffId(null)).toBeNull();
  });

  it('formats staff ID labels', () => {
    expect(formatStaffIdLabel('123456')).toBe('Staff ID: 123456');
    expect(formatStaffIdLabel(null)).toBe('Staff ID: Not assigned');
  });

  it('formats dropdown labels', () => {
    expect(formatStaffOptionLabel('Rawan Alfaifi', '123456')).toBe('Rawan Alfaifi — 123456');
  });

  it('prefers profile staff ID over employee code', () => {
    expect(resolveVisibleStaffId('123456', '999999')).toBe('123456');
    expect(resolveVisibleStaffId(null, '999999')).toBe('999999');
  });
});
