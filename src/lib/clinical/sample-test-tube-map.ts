/** Canonical sample test → collection tube mapping for hematology workflows. */
export const SAMPLE_TEST_TUBE_MAP: Record<string, string> = {
  CBC: 'EDTA',
  ESR: 'EDTA',
  'BLOOD FILM': 'EDTA',
  SICKLING: 'EDTA',
  MALARIA: 'EDTA',
  PTT: 'Sodium Citrate',
  PT: 'Sodium Citrate',
  INR: 'Sodium Citrate',
  'D-Dimer': 'Sodium Citrate',
};

/** Aliases for DB / UI test labels that differ from canonical map keys. */
const TEST_ALIASES: Record<string, string> = {
  APTT: 'PTT',
  'PT/INR': 'INR',
  'BLOOD SMEAR': 'BLOOD FILM',
  'PLATELET COUNT': 'CBC',
  HEMOGLOBIN: 'CBC',
  WBC: 'CBC',
  HCT: 'CBC',
  FIBRINOGEN: 'PTT',
};

function normalizeTestKey(test: string): string {
  return test.trim().toUpperCase();
}

function resolveCanonicalTest(test: string): string | null {
  const normalized = normalizeTestKey(test);
  if (!normalized) return null;

  const directKey = Object.keys(SAMPLE_TEST_TUBE_MAP).find(
    (key) => normalizeTestKey(key) === normalized,
  );
  if (directKey) return directKey;

  const alias = TEST_ALIASES[normalized];
  if (alias) {
    const aliasKey = Object.keys(SAMPLE_TEST_TUBE_MAP).find(
      (key) => normalizeTestKey(key) === normalizeTestKey(alias),
    );
    if (aliasKey) return aliasKey;
  }

  return null;
}

/** Returns the mapped tube for a test, or null when the test is unknown. */
export function getTubeForTest(test: string): string | null {
  const canonical = resolveCanonicalTest(test);
  if (!canonical) return null;
  return SAMPLE_TEST_TUBE_MAP[canonical] ?? null;
}

/** When multiple tests are selected, returns a tube only if all map to the same tube. */
export function getTubeForTests(tests: string[]): string | null {
  if (tests.length === 0) return null;

  const tubes = tests
    .map((test) => getTubeForTest(test))
    .filter((tube): tube is string => tube !== null);

  if (tubes.length !== tests.length) return null;
  const unique = new Set(tubes);
  return unique.size === 1 ? tubes[0] : null;
}
