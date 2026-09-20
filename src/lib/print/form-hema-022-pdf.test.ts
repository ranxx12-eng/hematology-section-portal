import { describe, expect, it } from 'vitest';
import { createFormHema022Pdf } from '@/lib/print/form-hema-022-pdf';
import type { ReagentLotComparison } from '@/types/inventory-module';

const stagoStudy: ReagentLotComparison = {
  id: 'study-stago',
  studyNumber: 'RLT-2026-010',
  status: 'draft',
  schemaVersion: 2,
  formCode: 'Form-Hema-022',
  studyYear: 2026,
  analyteTestGroup: 'Coagulation',
  reagentKey: 'neoptimal',
  formLayout: 'stago_sta_r_max',
  reagentName: 'NeoPTimal',
  oldLotNumber: 'OLD-1',
  newLotNumber: 'NEW-1',
  studyDate: '2026-09-20',
  instrumentNameSnapshot: 'Stago STA-R MAX3',
  acceptanceCriteriaConfigured: true,
  preparedByName: 'Tech One',
  reviewedByName: 'Reviewer One',
  results: [
    {
      id: 'r1', comparisonId: 'study-stago', sampleNumber: 1, testCode: 'PT', testLabel: 'PT', unit: 'seconds',
      acceptanceLimitPercent: 15, oldResult: 12, newResult: 13, differenceUnits: 1, absoluteDifferenceUnits: 1,
      differencePercent: 8.33, interpretation: 'acceptable',
    },
  ],
  createdAt: '2026-09-20T00:00:00Z',
};

const alinityStudy: ReagentLotComparison = {
  ...stagoStudy,
  id: 'study-alinity',
  studyNumber: 'RLT-2026-011',
  reagentKey: 'wbc_reagent',
  reagentName: 'WBC reagent',
  formLayout: 'alinity_hq',
  analyteTestGroup: 'CBC',
  instrumentNameSnapshot: 'Alinity HQ1147',
  results: [1, 2, 3].flatMap((sampleNumber) => ([
    { code: 'WBC', label: 'WBC', old: 7.1, new: 7.4 },
    { code: 'RBC', label: 'RBC', old: 4.5, new: 4.6 },
    { code: 'HGB', label: 'HGB', old: 13.2, new: 13.5 },
    { code: 'PLT', label: 'PLT', old: 250, new: 260 },
  ] as const).map((test, index) => ({
    id: `r-${sampleNumber}-${test.code}`,
    comparisonId: 'study-alinity',
    sampleNumber,
    testCode: test.code,
    testLabel: test.label,
    unit: 'unit',
    acceptanceLimitPercent: test.code === 'PLT' ? 25 : 15,
    oldResult: test.old,
    newResult: test.new,
    differenceUnits: test.new - test.old,
    absoluteDifferenceUnits: Math.abs(test.new - test.old),
    differencePercent: (Math.abs(test.new - test.old) / test.old) * 100,
    interpretation: 'acceptable' as const,
    displayOrder: index,
  }))),
};

describe('createFormHema022Pdf', () => {
  it('generates a non-empty Stago single-test PDF blob', async () => {
    const blob = await createFormHema022Pdf(stagoStudy, { 1: 'SYNTH-001' });
    expect(blob.size).toBeGreaterThan(1000);
  });

  it('generates a non-empty ALINITY four-test PDF blob', async () => {
    const blob = await createFormHema022Pdf(alinityStudy, {
      1: 'SYNTH-001',
      2: 'SYNTH-002',
      3: 'SYNTH-003',
    });
    expect(blob.size).toBeGreaterThan(1000);
  });
});
