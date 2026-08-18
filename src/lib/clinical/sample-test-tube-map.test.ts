import { describe, expect, it } from 'vitest';
import { getTubeForTest, getTubeForTests } from './sample-test-tube-map';

describe('sample-test-tube-map', () => {
  it('maps canonical tests case-insensitively', () => {
    expect(getTubeForTest('cbc')).toBe('EDTA');
    expect(getTubeForTest('INR')).toBe('Sodium Citrate');
    expect(getTubeForTest('d-dimer')).toBe('Sodium Citrate');
  });

  it('maps aliases used in module schemas', () => {
    expect(getTubeForTest('APTT')).toBe('Sodium Citrate');
    expect(getTubeForTest('PT/INR')).toBe('Sodium Citrate');
    expect(getTubeForTest('Blood Smear')).toBe('EDTA');
    expect(getTubeForTest('Platelet Count')).toBe('EDTA');
  });

  it('returns null for unknown tests', () => {
    expect(getTubeForTest('Flow Cytometry')).toBeNull();
    expect(getTubeForTest('')).toBeNull();
  });

  it('resolves tube for multiple tests only when consistent', () => {
    expect(getTubeForTests(['CBC', 'ESR'])).toBe('EDTA');
    expect(getTubeForTests(['CBC', 'INR'])).toBeNull();
    expect(getTubeForTests(['Flow Cytometry'])).toBeNull();
  });
});
