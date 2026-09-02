/** Central sample test → collection tube configuration for hematology workflows. */
export interface SampleTestTubeMapping {
  testCode: string;
  testName: string;
  tubeCode: string;
  tubeName: string;
  isActive: boolean;
  displayOrder: number;
}

export const SAMPLE_TEST_TUBE_MAPPINGS: readonly SampleTestTubeMapping[] = [
  { testCode: 'CBC', testName: 'CBC', tubeCode: 'EDTA', tubeName: 'EDTA', isActive: true, displayOrder: 1 },
  { testCode: 'RETICULOCYTE', testName: 'Reticulocyte', tubeCode: 'EDTA', tubeName: 'EDTA', isActive: true, displayOrder: 2 },
  { testCode: 'ESR', testName: 'ESR', tubeCode: 'EDTA', tubeName: 'EDTA', isActive: true, displayOrder: 3 },
  { testCode: 'BLOOD_FILM', testName: 'Blood Smear', tubeCode: 'EDTA', tubeName: 'EDTA', isActive: true, displayOrder: 4 },
  { testCode: 'PT', testName: 'PT', tubeCode: 'SODIUM_CITRATE', tubeName: 'Sodium Citrate', isActive: true, displayOrder: 10 },
  { testCode: 'PTT', testName: 'PTT', tubeCode: 'SODIUM_CITRATE', tubeName: 'Sodium Citrate', isActive: true, displayOrder: 11 },
  { testCode: 'INR', testName: 'INR', tubeCode: 'SODIUM_CITRATE', tubeName: 'Sodium Citrate', isActive: true, displayOrder: 12 },
  { testCode: 'D_DIMER', testName: 'D-Dimer', tubeCode: 'SODIUM_CITRATE', tubeName: 'Sodium Citrate', isActive: true, displayOrder: 13 },
  { testCode: 'FIBRINOGEN', testName: 'Fibrinogen', tubeCode: 'SODIUM_CITRATE', tubeName: 'Sodium Citrate', isActive: true, displayOrder: 14 },
  { testCode: 'SICKLING', testName: 'Sickling', tubeCode: 'EDTA', tubeName: 'EDTA', isActive: true, displayOrder: 20 },
  { testCode: 'MALARIA', testName: 'Malaria', tubeCode: 'EDTA', tubeName: 'EDTA', isActive: true, displayOrder: 21 },
  { testCode: 'PLATELET_COUNT', testName: 'Platelet Count', tubeCode: 'EDTA', tubeName: 'EDTA', isActive: true, displayOrder: 22 },
  { testCode: 'HEMOGLOBIN', testName: 'Hemoglobin', tubeCode: 'EDTA', tubeName: 'EDTA', isActive: true, displayOrder: 23 },
  { testCode: 'WBC', testName: 'WBC', tubeCode: 'EDTA', tubeName: 'EDTA', isActive: true, displayOrder: 24 },
  { testCode: 'HCT', testName: 'HCT', tubeCode: 'EDTA', tubeName: 'EDTA', isActive: true, displayOrder: 25 },
  { testCode: 'NEUTROPHILS', testName: 'Neutrophils', tubeCode: 'EDTA', tubeName: 'EDTA', isActive: true, displayOrder: 26 },
  { testCode: 'BLAST', testName: 'BLAST', tubeCode: 'EDTA', tubeName: 'EDTA', isActive: true, displayOrder: 27 },
] as const;

const TUBE_DISPLAY_ORDER = ['EDTA', 'Sodium Citrate', 'Plain Tube', 'SST', 'Heparin', 'ESR Tube', 'Slide', 'Other'];

/** Aliases for module-specific test labels → canonical testCode. */
const TEST_ALIASES: Record<string, string> = {
  APTT: 'PTT',
  'PT/INR': 'INR',
  'BLOOD SMEAR': 'BLOOD_FILM',
  'RETICULOCYTE COUNT': 'RETICULOCYTE',
  RETICULOCYTE: 'RETICULOCYTE',
  'PLATELET COUNT': 'PLATELET_COUNT',
  HEMOGLOBIN: 'HEMOGLOBIN',
  WBC: 'WBC',
  HCT: 'HCT',
  FIBRINOGEN: 'FIBRINOGEN',
  NEUTROPHILS: 'NEUTROPHILS',
  BLAST: 'BLAST',
  'D-DIMER': 'D_DIMER',
};

const MAPPING_BY_CODE = Object.fromEntries(
  SAMPLE_TEST_TUBE_MAPPINGS.map((entry) => [entry.testCode, entry]),
) as Record<string, SampleTestTubeMapping>;

function normalizeTestKey(test: string): string {
  return test.trim().toUpperCase();
}

function resolveCanonicalTestCode(test: string): string | null {
  const normalized = normalizeTestKey(test);
  if (!normalized) return null;

  const direct = SAMPLE_TEST_TUBE_MAPPINGS.find(
    (entry) => normalizeTestKey(entry.testCode) === normalized
      || normalizeTestKey(entry.testName) === normalized,
  );
  if (direct) return direct.testCode;

  const alias = TEST_ALIASES[normalized];
  if (alias && MAPPING_BY_CODE[alias]) return alias;

  return null;
}

function sortTubes(tubes: string[]): string[] {
  return [...tubes].sort((a, b) => {
    const ai = TUBE_DISPLAY_ORDER.indexOf(a);
    const bi = TUBE_DISPLAY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

/** Returns the mapped tube for a test, or null when the test is unknown. */
export function getTubeForTest(test: string): string | null {
  const code = resolveCanonicalTestCode(test);
  if (!code) return null;
  const mapping = MAPPING_BY_CODE[code];
  if (!mapping?.isActive) return null;
  return mapping.tubeName;
}

/** When all tests map to the same tube, returns that tube; otherwise null. */
export function getTubeForTests(tests: string[]): string | null {
  const derived = deriveRequiredTubesForTests(tests);
  if (derived.unmappedTests.length > 0) return null;
  if (derived.tubes.length === 0) return null;
  return derived.tubes.length === 1 ? derived.tubes[0] : null;
}

/** Returns distinct mapped tube types for the selected tests (may be multiple). */
export function getTubesForTestsList(tests: string[]): string[] {
  return deriveRequiredTubesForTests(tests).tubes;
}

export interface DerivedRequiredTubes {
  tubes: string[];
  unmappedTests: string[];
  tubeSnapshot: string;
  hasUnmapped: boolean;
}

/** Union of required tubes for selected tests; flags tests without configured mapping. */
export function deriveRequiredTubesForTests(tests: string[]): DerivedRequiredTubes {
  const unmappedTests: string[] = [];
  const tubeSet = new Set<string>();

  for (const test of tests) {
    const tube = getTubeForTest(test);
    if (!tube) {
      unmappedTests.push(test);
      continue;
    }
    tubeSet.add(tube);
  }

  const tubes = sortTubes([...tubeSet]);
  return {
    tubes,
    unmappedTests,
    tubeSnapshot: formatRequiredTubesSnapshot(tubes),
    hasUnmapped: unmappedTests.length > 0,
  };
}

export function formatRequiredTubesSnapshot(tubes: string[]): string {
  return tubes.join(' + ');
}

export function formatUnmappedTestsMessage(unmappedTests: string[]): string {
  if (unmappedTests.length === 0) return '';
  return `Tube mapping is not configured for: ${unmappedTests.join(', ')}`;
}
