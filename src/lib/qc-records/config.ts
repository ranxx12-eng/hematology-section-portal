export interface QCParameterConfig {
  name: string;
  levels: readonly string[];
  levelRequired: boolean;
  active: boolean;
  levelPending?: boolean;
}

export interface QCInstrumentConfig {
  name: string;
  parameters: QCParameterConfig[];
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
  { name: 'Malaria Kit QC', levels: ['Negative', 'Positive'], levelRequired: true, active: true },
  { name: 'Malaria External QC', levels: ['Negative', 'Positive'], levelRequired: true, active: true },
  { name: 'Malaria PH QC', levels: ['5', '6', '7', '8'], levelRequired: true, active: true },
  { name: 'Rabi Stain QC', levels: [], levelRequired: false, active: true, levelPending: true },
  { name: 'Giemsa Stain QC', levels: [], levelRequired: false, active: true, levelPending: true },
  { name: 'Manual ESR QC', levels: [], levelRequired: false, active: true, levelPending: true },
];

/** Canonical instrument names expected in the instruments master table. */
export const QC_INSTRUMENT_CONFIG: QCInstrumentConfig[] = [
  { name: 'Alinity HQ 1147', parameters: ALINITY_PARAMETERS },
  { name: 'Alinity HQ 1149', parameters: ALINITY_PARAMETERS },
  { name: 'Stago STA R MAX3', parameters: STAGO_PARAMETERS },
  { name: 'Alifax Test1', parameters: ALIFAX_PARAMETERS },
  { name: 'Manual Test', parameters: MANUAL_PARAMETERS },
];

export const QC_INSTRUMENT_NAMES = QC_INSTRUMENT_CONFIG.map((i) => i.name);

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
  const param = getParameterConfig(instrumentName, parameterName);
  if (!param || !param.active) return false;
  return !param.levelPending;
}
