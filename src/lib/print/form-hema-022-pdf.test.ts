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
  sampleIdentifiers: [
    { sampleNumber: 1, maskedLabel: 'Synthetic Sample ID on file', isSynthetic: true },
  ],
  results: [
    {
      id: 'r1', comparisonId: 'study-stago', sampleNumber: 1, testCode: 'PT', testLabel: 'PT Sec', unit: 'Sec',
      acceptanceLimitPercent: 15, oldResult: 12, newResult: 13, differenceUnits: 1, absoluteDifferenceUnits: 1,
      differencePercent: 8.33, interpretation: 'acceptable', recordedByStaffId: '399894',
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
  sampleIdentifiers: [
    { sampleNumber: 1, maskedLabel: 'Synthetic Sample ID on file', isSynthetic: true },
    { sampleNumber: 2, maskedLabel: 'Synthetic Sample ID on file', isSynthetic: true },
    { sampleNumber: 3, maskedLabel: 'Synthetic Sample ID on file', isSynthetic: true },
  ],
  results: [1, 2, 3].flatMap((sampleNumber) => ([
    { code: 'WBC', label: 'WBC x10^3/µL', old: 7.1, new: 7.4, limit: 15 },
    { code: 'RBC', label: 'RBC x10^6/µL', old: 4.5, new: 4.6, limit: 6 },
    { code: 'HGB', label: 'HGB g/dL', old: 13.2, new: 13.5, limit: 7 },
    { code: 'PLT', label: 'PLT x10^3/µL', old: 250, new: 260, limit: 25 },
  ] as const).map((test) => ({
    id: `r-${sampleNumber}-${test.code}`,
    comparisonId: 'study-alinity',
    sampleNumber,
    testCode: test.code,
    testLabel: test.label,
    unit: 'unit',
    acceptanceLimitPercent: test.limit,
    oldResult: test.old,
    newResult: test.new,
    differenceUnits: test.new - test.old,
    absoluteDifferenceUnits: Math.abs(test.new - test.old),
    differencePercent: (Math.abs(test.new - test.old) / test.old) * 100,
    interpretation: 'acceptable' as const,
    recordedByStaffId: '399894',
  }))),
};

const reticStudy: ReagentLotComparison = {
  ...stagoStudy,
  id: 'study-retic',
  studyNumber: 'RLT-2026-012',
  reagentKey: 'retic_reagent',
  reagentName: 'RETIC reagent',
  formLayout: 'alinity_hq',
  analyteTestGroup: 'CBC / Reticulocyte',
  instrumentNameSnapshot: 'Alinity HQ1147',
  sampleIdentifiers: [1, 2, 3].map((sampleNumber) => ({
    sampleNumber,
    maskedLabel: 'Synthetic Sample ID on file',
    isSynthetic: true,
  })),
  results: [1, 2, 3].flatMap((sampleNumber) => [
    {
      id: `r-${sampleNumber}-RETIC`,
      comparisonId: 'study-retic',
      sampleNumber,
      testCode: 'RETIC',
      testLabel: 'RETIC',
      acceptanceLimitPercent: 25,
      oldResult: 100,
      newResult: 125,
      differenceUnits: 25,
      absoluteDifferenceUnits: 25,
      differencePercent: 25,
      interpretation: 'acceptable' as const,
      recordedByStaffId: '399894',
    },
    {
      id: `r-${sampleNumber}-R_PERCENT`,
      comparisonId: 'study-retic',
      sampleNumber,
      testCode: 'R_PERCENT',
      testLabel: 'R%',
      acceptanceLimitPercent: 25,
      oldResult: 0,
      newResult: 1,
      differenceUnits: 1,
      absoluteDifferenceUnits: 1,
      differencePercent: undefined,
      interpretation: 'cannot_calculate' as const,
      recordedByStaffId: '399894',
    },
  ]),
};

describe('createFormHema022Pdf', () => {
  it('generates a non-empty Stago single-test PDF blob', async () => {
    const blob = await createFormHema022Pdf(stagoStudy);
    expect(blob.size).toBeGreaterThan(1000);
  });

  it('generates a non-empty ALINITY four-test PDF blob', async () => {
    const blob = await createFormHema022Pdf(alinityStudy);
    expect(blob.size).toBeGreaterThan(1000);
  });

  it('generates a non-empty RETIC two-test PDF blob', async () => {
    const blob = await createFormHema022Pdf(reticStudy);
    expect(blob.size).toBeGreaterThan(1000);
  });
});
