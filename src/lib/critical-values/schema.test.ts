import { describe, it, expect } from 'vitest';
import {
  criticalValueFormSchema,
  emptyCriticalValueForm,
  formatReadBack,
  parseReadBack,
} from '@/lib/critical-values/schema';

describe('Critical Value Form Schema', () => {
  const validForm = emptyCriticalValueForm('Rawan Alfaifi');

  it('accepts a valid form', () => {
    const result = criticalValueFormSchema.safeParse({
      ...validForm,
      patientId: 'DEMO-P001',
      patientName: 'Test Patient',
      patientAccNumber: 'ACC-001',
      test: 'CBC',
      sampleTube: 'EDTA',
      criticalValue: '5.2',
      informedToDr: 'Dr. Smith',
      drId: 'DR-001',
      verifyTime: '10:30',
      informedTime: '10:45',
      escalationTo: 'ER Physician',
      readBack: 'Yes',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing required fields', () => {
    const result = criticalValueFormSchema.safeParse({
      ...validForm,
      patientId: '',
    });
    expect(result.success).toBe(false);
  });

  it('requires explicit Read Back selection', () => {
    const result = criticalValueFormSchema.safeParse({
      ...validForm,
      patientId: 'DEMO-P001',
      patientName: 'Test Patient',
      patientAccNumber: 'ACC-001',
      test: 'INR',
      sampleTube: 'Sodium Citrate',
      criticalValue: '5.8',
      informedToDr: 'Dr. Smith',
      drId: 'DR-001',
      verifyTime: '09:00',
      informedTime: '09:15',
      escalationTo: 'None',
    });
    expect(result.success).toBe(false);
  });

  it('allows optional comment', () => {
    const result = criticalValueFormSchema.safeParse({
      ...validForm,
      patientId: 'DEMO-P001',
      patientName: 'Test Patient',
      patientAccNumber: 'ACC-001',
      test: 'INR',
      sampleTube: 'Sodium Citrate',
      criticalValue: '5.8',
      informedToDr: 'Dr. Smith',
      drId: 'DR-001',
      verifyTime: '09:00',
      informedTime: '09:15',
      escalationTo: 'None',
      readBack: 'No',
      comment: '',
    });
    expect(result.success).toBe(true);
  });

  it('defaults escalation to None in empty form', () => {
    expect(emptyCriticalValueForm('Staff Name').escalationTo).toBe('None');
  });

  it('does not default Read Back in empty form', () => {
    expect(emptyCriticalValueForm('Staff Name').readBack).toBeUndefined();
  });

  it('maps Read Back labels to booleans', () => {
    expect(parseReadBack('Yes')).toBe(true);
    expect(parseReadBack('No')).toBe(false);
    expect(formatReadBack(true)).toBe('Yes');
    expect(formatReadBack(false)).toBe('No');
  });
});
