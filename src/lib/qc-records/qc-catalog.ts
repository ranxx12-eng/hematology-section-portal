import {
  ALL_PARAMETERS,
  MANUAL_TEST_QC_SOURCE_NAME,
  PHYSICAL_QC_INSTRUMENT_NAMES,
  QC_INSTRUMENT_CONFIG,
  type QCParameterConfig,
} from '@/lib/qc-records/config';
import {
  MALARIA_QC_A_PARAMETER,
  MALARIA_QC_B_PARAMETER,
} from '@/lib/qc-records/malaria-qc';
import { RAPI_STAIN_QC_PARAMETER } from '@/lib/qc-records/rapi-stain-qc';
import {
  deriveRapiStainCatalogStatus,
  type RapiStainCatalogSnapshot,
} from '@/lib/qc-records/rapi-catalog-status';
import { FORM_HEMA_021_CODE, FORM_HEMA_039_CODE } from '@/lib/stain-qc/constants';
import type { QCRecord } from '@/types';

export type QcCatalogWorkflowKind =
  | 'instrument_qc_records'
  | 'manual_qc_records'
  | 'rapi_stain'
  | 'coming_soon';

export type QcCatalogStatusLabel =
  | 'Due'
  | 'Completed'
  | 'OUT'
  | 'Pending Change Stain'
  | 'Pending Review'
  | 'Reviewed / Pending Approval'
  | 'Approved'
  | 'Not Recorded'
  | 'Coming Soon';

export interface QcCatalogDefinition {
  id: string;
  name: string;
  subtitle: string;
  instrumentName: string;
  parameter?: string;
  formCode?: string;
  frequency: 'Daily' | 'Monthly' | 'Per Run';
  kind: QcCatalogWorkflowKind;
  disabled: boolean;
}

export interface QcCatalogCardViewModel extends QcCatalogDefinition {
  status: QcCatalogStatusLabel;
  lastRecordedAt?: string;
  lotNumber?: string;
  expiryDate?: string;
  sheetId?: string;
  sheetMonth?: number;
  sheetYear?: number;
}

const INSTRUMENT_SUBTITLES: Record<string, string> = {
  'Alinity HQ 1147': 'CBC QC · Alinity HQ 1147',
  'Alinity HQ 1149': 'CBC QC · Alinity HQ 1149',
  'Stago STA R MAX3': 'Coagulation QC · STA-R Max',
  'Alifax Test1': 'ESR QC · Alifax Test-1',
};

function manualCatalogEntry(param: QCParameterConfig): QcCatalogDefinition {
  const formCodes: Record<string, string> = {
    [MALARIA_QC_A_PARAMETER]: 'Form-Hema-011',
    [MALARIA_QC_B_PARAMETER]: 'Form-Hema-012',
    [RAPI_STAIN_QC_PARAMETER]: FORM_HEMA_021_CODE,
    'Giemsa Stain QC': FORM_HEMA_039_CODE,
  };

  if (param.name === RAPI_STAIN_QC_PARAMETER) {
    return {
      id: 'rapi-stain-qc',
      name: 'RAPI Stain QC',
      subtitle: `${FORM_HEMA_021_CODE} · Manual Test`,
      instrumentName: MANUAL_TEST_QC_SOURCE_NAME,
      parameter: param.name,
      formCode: FORM_HEMA_021_CODE,
      frequency: 'Daily',
      kind: 'rapi_stain',
      disabled: false,
    };
  }

  if (param.levelPending || param.name === 'Giemsa Stain QC') {
    return {
      id: `manual-${param.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: param.name === 'Giemsa Stain QC' ? 'Giemsa Stain QC' : param.name,
      subtitle: param.name === 'Giemsa Stain QC' ? `${FORM_HEMA_039_CODE} · Coming Soon` : `${MANUAL_TEST_QC_SOURCE_NAME} · Pending`,
      instrumentName: MANUAL_TEST_QC_SOURCE_NAME,
      parameter: param.name,
      formCode: param.name === 'Giemsa Stain QC' ? FORM_HEMA_039_CODE : undefined,
      frequency: 'Daily',
      kind: 'coming_soon',
      disabled: true,
    };
  }

  return {
    id: `manual-${param.name.toLowerCase().replace(/\s+/g, '-')}`,
    name: param.name,
    subtitle: `${formCodes[param.name] ?? 'Manual Test'} · ${MANUAL_TEST_QC_SOURCE_NAME}`,
    instrumentName: MANUAL_TEST_QC_SOURCE_NAME,
    parameter: param.name,
    formCode: formCodes[param.name],
    frequency: 'Daily',
    kind: 'manual_qc_records',
    disabled: false,
  };
}

export function buildQcCatalogDefinitions(): QcCatalogDefinition[] {
  const instrumentEntries: QcCatalogDefinition[] = PHYSICAL_QC_INSTRUMENT_NAMES.map((instrumentName) => ({
    id: `instrument-${instrumentName.toLowerCase().replace(/\s+/g, '-')}`,
    name: INSTRUMENT_SUBTITLES[instrumentName]?.split(' · ')[0] ?? `${instrumentName} QC`,
    subtitle: INSTRUMENT_SUBTITLES[instrumentName] ?? instrumentName,
    instrumentName,
    parameter: undefined,
    frequency: 'Daily' as const,
    kind: 'instrument_qc_records' as const,
    disabled: false,
  }));

  const manualConfig = QC_INSTRUMENT_CONFIG.find((item) => item.name === MANUAL_TEST_QC_SOURCE_NAME);
  const manualEntries = (manualConfig?.parameters ?? [])
    .filter((param) => param.active)
    .map(manualCatalogEntry);

  return [...instrumentEntries, ...manualEntries];
}

export function resolveCatalogDefaultParameter(definition: QcCatalogDefinition): string | undefined {
  if (definition.parameter) return definition.parameter;
  if (definition.kind !== 'instrument_qc_records') return undefined;
  const config = QC_INSTRUMENT_CONFIG.find((item) => item.name === definition.instrumentName);
  if (!config) return undefined;
  if (config.supportsAllParameters) return ALL_PARAMETERS;
  return config.parameters.find((param) => param.active && !param.levelPending)?.name;
}

function matchesCatalogRecord(definition: QcCatalogDefinition, record: QCRecord, instrumentNames: Record<string, string>): boolean {
  const instrumentName = instrumentNames[record.instrumentId];
  if (instrumentName !== definition.instrumentName) return false;
  if (definition.kind === 'instrument_qc_records') return true;
  if (!definition.parameter) return true;
  return record.parameter === definition.parameter;
}

function enrichRapiStainCatalogCard(
  definition: QcCatalogDefinition,
  snapshot: RapiStainCatalogSnapshot | null | undefined,
): QcCatalogCardViewModel {
  const derived = deriveRapiStainCatalogStatus(snapshot ?? {
    sheet: null,
    criteria: [],
    dailyResults: [],
    correctiveActions: [],
  });
  return {
    ...definition,
    status: derived.status,
    lastRecordedAt: derived.lastRecordedAt,
    lotNumber: derived.lotNumber,
    expiryDate: derived.expiryDate,
    sheetId: derived.sheetId,
    sheetMonth: derived.sheetMonth,
    sheetYear: derived.sheetYear,
  };
}

export function enrichQcCatalogCard(
  definition: QcCatalogDefinition,
  records: QCRecord[],
  instrumentNames: Record<string, string>,
  rapiSnapshot?: RapiStainCatalogSnapshot | null,
): QcCatalogCardViewModel {
  if (definition.disabled) {
    return { ...definition, status: 'Coming Soon' };
  }

  if (definition.kind === 'rapi_stain') {
    return enrichRapiStainCatalogCard(definition, rapiSnapshot);
  }

  const related = records
    .filter((record) => matchesCatalogRecord(definition, record, instrumentNames))
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));

  const latest = related[0];
  if (!latest) {
    return { ...definition, status: 'Not Recorded' };
  }

  let status: QcCatalogStatusLabel = 'Completed';
  if (latest.reviewStatus === 'Pending Review') status = 'Pending Review';
  else if (latest.qcStatus === 'OUT') status = 'OUT';

  return {
    ...definition,
    status,
    lastRecordedAt: latest.recordedAt,
    lotNumber: latest.lotNumber,
    expiryDate: latest.expiryDate,
  };
}

export function buildQcCatalogCards(
  records: QCRecord[],
  instrumentNames: Record<string, string>,
  rapiSnapshot?: RapiStainCatalogSnapshot | null,
): QcCatalogCardViewModel[] {
  return buildQcCatalogDefinitions().map((definition) => enrichQcCatalogCard(
    definition,
    records,
    instrumentNames,
    rapiSnapshot,
  ));
}
