import { describe, expect, it } from 'vitest';
import {
  computeFormHema022Difference,
  deriveFormHema022Interpretation,
} from '@/lib/inventory/form-hema-022/calculation';

describe('computeFormHema022Difference', () => {
  it('computes signed, absolute, and percent difference', () => {
    expect(computeFormHema022Difference(100, 115)).toEqual({
      signedDifferenceUnits: 15,
      absoluteDifferenceUnits: 15,
      differencePercent: 15,
    });
  });

  it('treats exact limit as pass boundary', () => {
    const interpretation = deriveFormHema022Interpretation(
      { autoInterpretationEnabled: true, acceptanceLimitPercent: 25 },
      100,
      125,
    );
    expect(interpretation).toBe('acceptable');
  });

  it('returns cannot_calculate when previous result is zero', () => {
    expect(deriveFormHema022Interpretation(
      { autoInterpretationEnabled: true, acceptanceLimitPercent: 15 },
      0,
      5,
    )).toBe('cannot_calculate');
  });

  it('returns incomplete when either result is blank', () => {
    expect(deriveFormHema022Interpretation(
      { autoInterpretationEnabled: true, acceptanceLimitPercent: 15 },
      null,
      5,
    )).toBe('incomplete');
  });

  it('does not treat PLT limit as decimal fraction', () => {
    const interpretation = deriveFormHema022Interpretation(
      { autoInterpretationEnabled: true, acceptanceLimitPercent: 25 },
      200,
      251,
    );
    expect(interpretation).toBe('not_acceptable');
  });
});
