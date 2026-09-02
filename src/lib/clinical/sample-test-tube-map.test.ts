import { describe, expect, it } from 'vitest';
import {
  deriveRequiredTubesForTests,
  formatRequiredTubesSnapshot,
  getTubeForTest,
  getTubeForTests,
  getTubesForTestsList,
} from './sample-test-tube-map';

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
    expect(getTubeForTest('Reticulocyte Count')).toBe('EDTA');
    expect(getTubeForTest('Fibrinogen')).toBe('Sodium Citrate');
  });

  it('maps ESR to EDTA', () => {
    expect(getTubeForTest('ESR')).toBe('EDTA');
  });

  it('returns null for unknown tests', () => {
    expect(getTubeForTest('Flow Cytometry')).toBeNull();
    expect(getTubeForTest('')).toBeNull();
  });

  it('derives single tube for CBC + ESR', () => {
    const derived = deriveRequiredTubesForTests(['CBC', 'ESR']);
    expect(derived.tubes).toEqual(['EDTA']);
    expect(derived.unmappedTests).toEqual([]);
    expect(formatRequiredTubesSnapshot(derived.tubes)).toBe('EDTA');
  });

  it('derives EDTA + Sodium Citrate for CBC + PT', () => {
    const derived = deriveRequiredTubesForTests(['CBC', 'PT/INR']);
    expect(derived.tubes).toEqual(['EDTA', 'Sodium Citrate']);
    expect(derived.unmappedTests).toEqual([]);
  });

  it('derives Sodium Citrate only for coag panel', () => {
    const derived = deriveRequiredTubesForTests(['PT', 'PTT', 'Fibrinogen', 'D-Dimer']);
    expect(derived.tubes).toEqual(['Sodium Citrate']);
  });

  it('deduplicates tubes for CBC + Reticulocyte Count', () => {
    expect(getTubesForTestsList(['CBC', 'Reticulocyte Count'])).toEqual(['EDTA']);
  });

  it('returns null from legacy helper when tubes differ', () => {
    expect(getTubeForTests(['CBC', 'INR'])).toBeNull();
    expect(getTubeForTests(['CBC', 'ESR'])).toBe('EDTA');
  });

  it('flags unmapped tests instead of guessing', () => {
    const derived = deriveRequiredTubesForTests(['CBC', 'Flow Cytometry']);
    expect(derived.hasUnmapped).toBe(true);
    expect(derived.unmappedTests).toEqual(['Flow Cytometry']);
    expect(derived.tubes).toEqual(['EDTA']);
  });
});
