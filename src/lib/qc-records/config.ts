export interface QCParameterConfig {
  name: string;
  levels: readonly string[];
  levelRequired: boolean;
  active: boolean;
  levelPending?: boolean;
}

export const ALL_PARAMETERS = 'All Parameters' as const;

export interface QCInstrumentConfig {
  name: string;
  parameters: QCParameterConfig[];
  supportsAllParameters: boolean;
}

const ALINITY_PARAMETERS: QCParameterConfig[] = [
  'WBC', 'RBC', 'HGB', 'HCT', 'MCV', 'MCH', 'MCHC', 'RDW', 'PLT', 'MPV',
  'NEUT', 'LYMPH', 'MONO', 'EOS', 'BASO',
].map((name) => ({
  name,
  levels: ['Low', 'Normal', 'High'] as const,
  levelRequired: true,
  active: true,
}));

const STAGO_PARAMETERS: QCParameterConfig[] = [
  'PT', 'APTT', 'D-Dimer', 'Fibrinogen',
].map((name) => ({
  name,
  levels: ['Normal', 'Path'] as const,
  levelRequired: true,
  active: true,
}));

const ALIFAX_PARAMETERS: QCParameterConfig[] = [{
  name: 'ESR',
  levels: ['2', '3', '4'] as const,
  levelRequired: true,
  active: true,
}];

const MANUAL_PARAMETERS: QCParameterConfig[] = [
  { name: 'Sickling', levels: ['Negative', 'Positive'], levelRequired: true, active: true },
  { name: 'Malaria Screening Daily QC - A', levels: [], levelRequired: false, active: true },
  { name: 'Positivia Malaria Ag External Control', levels: ['Pf-HRP II Ag', 'Pf-LDH Ag', 'Pv-LDH Ag', 'Negative'], levelRequired: true, active: true },
  { name: 'Malaria PH QC', levels: ['5', '6', '7', '8'], levelRequired: true, active: true },
  { name: 'Rabi Stain QC', levels: [], levelRequired: false, active: true, levelPending: true },
  { name: 'Giemsa Stain QC', levels: [], levelRequired: false, active: true, levelPending: true },
  { name: 'Manual ESR QC', levels: [], levelRequired: false, active: true, levelPending: true },
];

/** Canonical instrument names expected in the instruments master table. */
export const QC_INSTRUMENT_CONFIG: QCInstrumentConfig[] = [
  { name: 'Alinity HQ 1147', parameters: ALINITY_PARAMETERS, supportsAllParameters: true },
  { name: 'Alinity HQ 1149', parameters: ALINITY_PARAMETERS, supportsAllParameters: true },
  { name: 'Stago STA R MAX3', parameters: STAGO_PARAMETERS, supportsAllParameters: true },
  { name: 'Alifax Test1', parameters: ALIFAX_PARAMETERS, supportsAllParameters: false },
  { name: 'Manual Test', parameters: MANUAL_PARAMETERS, supportsAllParameters: false },
];

export const MANUAL_TEST_QC_SOURCE_NAME = 'Manual Test';

export const QC_INSTRUMENT_NAMES = QC_INSTRUMENT_CONFIG.map((i) => i.name);

/** Physical analyzers/equipment — Manual Test is appended separately as a virtual source. */
export const PHYSICAL_QC_INSTRUMENT_NAMES = QC_INSTRUMENT_NAMES.filter(
  (name) => name !== MANUAL_TEST_QC_SOURCE_NAME,
);

/** Known DB name variants (e.g. migration 051 official seed names) mapped to canonical QC config names. */
const QC_INSTRUMENT_NAME_ALIASES: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /^Alinity HQ\s*1147$/i, canonical: 'Alinity HQ 1147' },
  { pattern: /^Alinity HQ\s*1149$/i, canonical: 'Alinity HQ 1149' },
  { pattern: /^Stago STA[-\s]?R MAX3$/i, canonical: 'Stago STA R MAX3' },
  { pattern: /^Alifax(?: Test1)?$/i, canonical: 'Alifax Test1' },
  { pattern: /^Manual Test$/i, canonical: 'Manual Test' },
];

/** Expanded exact names for a bounded Supabase `.in('name', …)` filter (physical QC instruments). */
export const QC_INSTRUMENT_DB_NAME_CANDIDATES = [
  ...PHYSICAL_QC_INSTRUMENT_NAMES,
  'Alinity HQ1147',
  'Alinity HQ1149',
  'Stago STA-R MAX3',
  'Alifax',
  MANUAL_TEST_QC_SOURCE_NAME,
] as const;

/**
 * Resolve a database instrument name to the canonical QC config name used for
 * parameter/level mappings. Returns undefined if not a QC instrument.
 */
export function resolveCanonicalQCInstrumentName(dbName: string): string | undefined {
  const trimmed = dbName.trim();
  if ((QC_INSTRUMENT_NAMES as readonly string[]).includes(trimmed)) return trimmed;
  for (const { pattern, canonical } of QC_INSTRUMENT_NAME_ALIASES) {
    if (pattern.test(trimmed)) return canonical;
  }
  return undefined;
}

export function getInstrumentConfig(name: string): QCInstrumentConfig | undefined {
  return QC_INSTRUMENT_CONFIG.find((i) => i.name === name);
}

export function getInstrumentConfigById(
  instrumentId: string,
  nameById: Record<string, string>,
): QCInstrumentConfig | undefined {
  const name = nameById[instrumentId];
  return name ? getInstrumentConfig(name) : undefined;
}

export function getParameterConfig(
  instrumentName: string,
  parameterName: string,
): QCParameterConfig | undefined {
  return getInstrumentConfig(instrumentName)?.parameters.find((p) => p.name === parameterName);
}

export function getParametersForInstrument(instrumentName: string): QCParameterConfig[] {
  return getInstrumentConfig(instrumentName)?.parameters.filter((p) => p.active) ?? [];
}

export function getLevelsForParameter(
  instrumentName: string,
  parameterName: string,
): readonly string[] {
  const param = getParameterConfig(instrumentName, parameterName);
  if (!param || param.levelPending) return [];
  return param.levels;
}

export function isLevelSelectionBlocked(
  instrumentName: string,
  parameterName: string,
): boolean {
  const param = getParameterConfig(instrumentName, parameterName);
  return Boolean(param?.levelPending);
}

export function isValidInstrumentParameterLevel(
  instrumentName: string,
  parameterName: string,
  level: string,
): boolean {
  const param = getParameterConfig(instrumentName, parameterName);
  if (!param || !param.active) return false;
  if (param.levelPending) return false;
  if (!param.levelRequired) return true;
  return param.levels.includes(level);
}

export function canSaveParameter(
  instrumentName: string,
  parameterName: string,
): boolean {
  if (parameterName === ALL_PARAMETERS) {
    return instrumentSupportsAllParameters(instrumentName);
  }
  const param = getParameterConfig(instrumentName, parameterName);
  if (!param || !param.active) return false;
  return !param.levelPending;
}

export function instrumentSupportsAllParameters(instrumentName: string): boolean {
  return getInstrumentConfig(instrumentName)?.supportsAllParameters ?? false;
}

export function isAllParametersSelection(parameterName: string): boolean {
  return parameterName === ALL_PARAMETERS;
}

/** Levels shared by every active, non-pending parameter on the instrument. */
export function getSharedLevelsForInstrument(instrumentName: string): readonly string[] {
  const params = getParametersForInstrument(instrumentName).filter((p) => !p.levelPending);
  if (params.length === 0) return [];
  const firstLevels = params[0].levels;
  const allSame = params.every(
    (p) => p.levels.length === firstLevels.length
      && p.levels.every((level, index) => level === firstLevels[index]),
  );
  return allSame ? firstLevels : [];
}

export function isValidAllParametersLevel(
  instrumentName: string,
  level: string,
): boolean {
  return getSharedLevelsForInstrument(instrumentName).includes(level);
}
