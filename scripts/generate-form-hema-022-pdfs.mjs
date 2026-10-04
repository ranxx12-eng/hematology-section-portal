#!/usr/bin/env node
import { execFileSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'tmp/pdf-verify');

async function main() {
  mkdirSync(outDir, { recursive: true });
  const { createFormHema022Pdf } = await import(join(root, 'src/lib/print/form-hema-022-pdf.ts'));

  const base = {
    id: 'preview',
    studyNumber: 'RLT-2026-010',
    status: 'draft',
    schemaVersion: 2,
    studyYear: 2026,
    oldLotNumber: 'OLD-1',
    newLotNumber: 'NEW-1',
    studyDate: '2026-09-20',
    acceptanceCriteriaConfigured: true,
    createdAt: '2026-09-20T00:00:00Z',
    sampleIdentifiers: [{ sampleNumber: 1, maskedLabel: 'Synthetic Sample ID on file', isSynthetic: true }],
  };

  const stago = {
    ...base,
    formLayout: 'stago_sta_r_max',
    analyteTestGroup: 'Coagulation',
    reagentName: 'NeoPTimal',
    instrumentNameSnapshot: 'Stago STA-R MAX3',
    results: [{
      id: 'r1',
      comparisonId: 'preview',
      sampleNumber: 1,
      testLabel: 'PT Sec',
      oldResult: 12,
      newResult: 13,
      differenceUnits: 1,
      absoluteDifferenceUnits: 1,
      differencePercent: 8.3,
      interpretation: 'acceptable',
      recordedByStaffId: '399894',
    }],
  };

  const alinity = {
    ...base,
    id: 'preview2',
    studyNumber: 'RLT-2026-011',
    formLayout: 'alinity_hq',
    analyteTestGroup: 'CBC',
    reagentName: 'WBC reagent',
    instrumentNameSnapshot: 'Alinity HQ1147',
    sampleIdentifiers: [1, 2, 3].map((n) => ({
      sampleNumber: n,
      maskedLabel: 'Synthetic Sample ID on file',
      isSynthetic: true,
    })),
    results: [1, 2, 3].flatMap((sampleNumber) => (
      ['WBC x10^3/µL', 'RBC x10^6/µL', 'HGB g/dL', 'PLT x10^3/µL'].map((label, index) => ({
        id: `r-${sampleNumber}-${index}`,
        comparisonId: 'preview2',
        sampleNumber,
        testLabel: label,
        oldResult: 10 + index,
        newResult: 10.5 + index,
        differenceUnits: 0.5,
        absoluteDifferenceUnits: 0.5,
        differencePercent: 5,
        interpretation: 'acceptable',
        recordedByStaffId: '399894',
      }))
    )),
  };

  for (const [name, study] of [['stago-pt', stago], ['alinity-wbc-panel', alinity]]) {
    const blob = await createFormHema022Pdf(study);
    const pdfPath = join(outDir, `form-hema-022-${name}.pdf`);
    writeFileSync(pdfPath, Buffer.from(await blob.arrayBuffer()));
    try {
      execFileSync('qlmanage', ['-t', '-s', '1200', '-o', outDir, pdfPath], { stdio: 'ignore' });
    } catch {
      // qlmanage optional
    }
    console.log(`Wrote ${pdfPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
