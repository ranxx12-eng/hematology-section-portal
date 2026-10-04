import type { LotInterpretation } from '@/types/inventory-module';
import type { FormHema022TestDefinition } from '@/lib/inventory/form-hema-022/constants';

export interface FormHema022Difference {
  signedDifferenceUnits?: number;
  absoluteDifferenceUnits?: number;
  differencePercent?: number;
}

export function computeFormHema022Difference(
  oldResult?: number | null,
  newResult?: number | null,
): FormHema022Difference {
  if (oldResult == null || newResult == null) return {};
  const signedDifferenceUnits = newResult - oldResult;
  const absoluteDifferenceUnits = Math.abs(signedDifferenceUnits);
  const differencePercent = oldResult === 0
    ? undefined
    : (absoluteDifferenceUnits / Math.abs(oldResult)) * 100;
  return { signedDifferenceUnits, absoluteDifferenceUnits, differencePercent };
}

export function deriveFormHema022Interpretation(
  test: Pick<FormHema022TestDefinition, 'autoInterpretationEnabled' | 'acceptanceLimitPercent'>,
  oldResult?: number | null,
  newResult?: number | null,
): LotInterpretation {
  if (!test.autoInterpretationEnabled || test.acceptanceLimitPercent == null) {
    return 'criteria_not_configured';
  }
  if (oldResult == null || newResult == null) return 'incomplete';
  if (oldResult === 0) return 'cannot_calculate';
  const { differencePercent } = computeFormHema022Difference(oldResult, newResult);
  if (differencePercent == null) return 'cannot_calculate';
  return differencePercent <= test.acceptanceLimitPercent ? 'acceptable' : 'not_acceptable';
}
