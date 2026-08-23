import { describe, expect, it } from 'vitest';
import {
  correctedResultFormSchema,
  correctedResultUpdateFormSchema,
  emptyCorrectedResultForm,
} from './schema';

describe('correctedResult schemas', () => {
  it('loads create and update schemas without throwing', () => {
    expect(correctedResultFormSchema).toBeDefined();
    expect(correctedResultUpdateFormSchema).toBeDefined();
  });

  it('validates create payloads with original result', () => {
    const parsed = correctedResultFormSchema.safeParse(emptyCorrectedResultForm());
    expect(parsed.success).toBe(false);
  });

  it('validates update payloads without original result field', () => {
    const { originalResult: _originalResult, ...updatePayload } = emptyCorrectedResultForm();
    const parsed = correctedResultUpdateFormSchema.safeParse({
      ...updatePayload,
      patientId: 'MRN123',
      test: 'CBC',
      correctedResult: '5.0',
      reason: 'Verified',
    });
    expect(parsed.success).toBe(true);
  });

  it('requires notification details when physician is notified', () => {
    const parsed = correctedResultUpdateFormSchema.safeParse({
      ...emptyCorrectedResultForm(),
      patientId: 'MRN123',
      test: 'CBC',
      correctedResult: '5.0',
      reason: 'Verified',
      physicianNotified: true,
      notifiedTo: '',
      notificationTime: '',
    });
    expect(parsed.success).toBe(false);
  });
});
