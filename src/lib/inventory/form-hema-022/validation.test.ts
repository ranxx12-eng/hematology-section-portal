import { describe, expect, it } from 'vitest';
import { validateFormHema022Submission } from '@/lib/inventory/form-hema-022/validation';
import type { ReagentLotComparison, ReagentLotComparisonResult } from '@/types/inventory-module';

function baseStudy(overrides: Partial<ReagentLotComparison>): ReagentLotComparison {
  return {
    id: 'study-1',
    studyNumber: 'RLT-2026-001',
    status: 'draft',
    schemaVersion: 2,
    reagentName: 'NeoPTimal',
    reagentKey: 'neoptimal',
    oldLotNumber: 'A',
    newLotNumber: 'B',
    acceptanceCriteriaConfigured: true,
    studyYear: 2026,
    studyDate: '2026-09-20',
    instrumentNameSnapshot: 'Stago STA-R MAX3',
    results: [],
    createdAt: '2026-09-20T00:00:00Z',
    ...overrides,
  };
}

function reticResult(overrides: Partial<ReagentLotComparisonResult>): ReagentLotComparisonResult {
  return {
    id: 'r1',
    comparisonId: 'study-1',
    sampleNumber: 1,
    testCode: 'RETIC',
    testLabel: 'RETIC',
    acceptanceLimitPercent: 25,
    interpretation: 'acceptable',
    ...overrides,
  };
}

describe('validateFormHema022Submission', () => {
  it('allows RETIC studies when both tests have configured 25% criteria', () => {
    const issues = validateFormHema022Submission(baseStudy({
      reagentKey: 'retic_reagent',
      reagentName: 'RETIC reagent',
      acceptanceCriteriaConfigured: true,
      results: [
        reticResult({ id: 'r1', testCode: 'RETIC', testLabel: 'RETIC' }),
        reticResult({ id: 'r2', testCode: 'R_PERCENT', testLabel: 'R%' }),
      ],
    }));
    expect(issues.some((issue) => issue.code === 'retic_criteria_missing')).toBe(false);
    expect(issues).toHaveLength(0);
  });

  it('requires resolution comments for failed results', () => {
    const issues = validateFormHema022Submission(baseStudy({
      results: [{
        id: 'r1',
        comparisonId: 'study-1',
        sampleNumber: 1,
        testCode: 'PT',
        testLabel: 'PT',
        interpretation: 'not_acceptable',
        comment: '',
      }],
    }));
    expect(issues.some((issue) => issue.code === 'resolution_required')).toBe(true);
  });

  it('requires documented resolution when RETIC previous result is zero', () => {
    const issues = validateFormHema022Submission(baseStudy({
      reagentKey: 'retic_reagent',
      reagentName: 'RETIC reagent',
      results: [
        reticResult({ interpretation: 'cannot_calculate', comment: '' }),
      ],
    }));
    expect(issues.some((issue) => issue.code === 'resolution_required')).toBe(true);
  });
});
