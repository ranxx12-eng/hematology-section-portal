import type { QCRecord } from '@/types';
import { resolveMalariaQcPrintTemplateKey } from '@/lib/qc-records/malaria-qc';

export type QCPrintTemplateKey =
  | 'hema-005'
  | 'hema-006'
  | 'hema-007'
  | 'hema-008b'
  | 'hema-008a'
  | 'hema-011'
  | 'hema-012'
  | 'generic';

export interface QCPrintTemplateConfig {
  key: QCPrintTemplateKey;
  formNumber: string;
  title: string;
  subtitle?: string;
  footerLeft: string;
  qid: string;
  tableHeaders: readonly string[];
  referenceRanges?: readonly string[];
  headerMeta?: readonly string[];
  monthlyReviewTitle?: string;
  monthlyApprovalTitle?: string;
}

export const QC_PRINT_DEPARTMENT = 'Laboratory Department';
export const QC_PRINT_SECTION = 'Hematology Section';
export const QC_PRINT_HOSPITAL = 'AL SAHAFA HOSPITAL';

export const ALIFAX_ESR_INSTRUMENT = 'Alifax Test1';

export const QC_PRINT_TEMPLATES: Record<Exclude<QCPrintTemplateKey, 'generic'>, QCPrintTemplateConfig> = {
  'hema-005': {
    key: 'hema-005',
    formNumber: 'Form-Hema-005',
    title: 'Sickle Cell QC Log Sheet',
    footerLeft: 'Form-Hema-005-Sickle Cell QC Log Sheet',
    qid: 'HMG/SAH/QID/9156',
    tableHeaders: [
      'DATE',
      'POS',
      'NEG',
      'INITIALS',
      'CORRECTIVE ACTION',
      'DAILY REVIEW',
      'DAILY APPROVAL',
    ],
    headerMeta: ['Year', 'Month', 'Expiration Date'],
  },
  'hema-006': {
    key: 'hema-006',
    formNumber: 'Form-Hema-006',
    title: 'Manual ESR Quality Control',
    footerLeft: 'Form-Hema-006-Manual ESR Quality Control',
    qid: 'HMG/SAH/QID/9157',
    tableHeaders: [
      'DATE',
      'LEVEL 1',
      'LEVEL 2',
      'INITIALS',
      'CORRECTIVE ACTION',
      'DAILY REVIEW',
      'DAILY APPROVAL',
    ],
    referenceRanges: ['Level 1 N.V. 1–9', 'Level 2 N.V. 38–72'],
    headerMeta: ['Year', 'Month', 'LOT QC 1#', 'LOT QC 2#', 'Expiration Date'],
  },
  'hema-007': {
    key: 'hema-007',
    formNumber: 'Form-Hema-007',
    title: 'PH OF DISTILLED WATER LOG SHEET',
    subtitle: '(MALARIA MANUAL METHOD)',
    footerLeft: 'Form-Hema-007 PH OF DISTILLED WATER LOG SHEET (MALARIA MANUAL METHOD)',
    qid: 'HMG/SAH/QID/9159',
    tableHeaders: [
      'DATE OF CHECK',
      'PH READING',
      'PERFORMED BY',
      'CORRECTIVE ACTION',
      'DAILY REVIEW',
      'DAILY APPROVAL',
    ],
    referenceRanges: ['Normal Range: 6.8–7.2'],
    headerMeta: ['Year', 'Month'],
  },
  'hema-008b': {
    key: 'hema-008b',
    formNumber: 'Form-Hema-008B',
    title: 'ESR Analyzer QC Log',
    footerLeft: 'Form-Hema-008B',
    qid: 'HMG/SAH/QID/9160',
    tableHeaders: [
      'DATE',
      'LEVEL 2',
      'LEVEL 3',
      'LEVEL 4',
      'INITIALS',
      'CORRECTIVE ACTION',
      'DAILY REVIEW',
      'DAILY APPROVAL',
    ],
    referenceRanges: ['Level 2: 6–11', 'Level 3: 15–22', 'Level 4: 56–74'],
    headerMeta: ['Instrument', 'Serial #', 'Month', 'Year'],
  },
  'hema-008a': {
    key: 'hema-008a',
    formNumber: 'Form-Hema-008A',
    title: 'Daily Maintenance Log - ESR Analyzer',
    footerLeft: 'Form-Hema-008A',
    qid: 'HMG/SAH/QID/9160',
    tableHeaders: [
      'DAY',
      'SURFACE CLEANING',
      'WASH 5 TUBES',
      'EMPTY THE WASTE',
      'FILL D. WATER TANK',
      'INITIALS',
    ],
    headerMeta: ['Instrument', 'Serial #', 'Brand #', 'Month', 'Year'],
  },
  'hema-011': {
    key: 'hema-011',
    formNumber: 'Form-Hema-011',
    title: 'Malaria Screening Daily QC',
    footerLeft: 'Form-Hema-011-Malaria Screening Daily Qc -A',
    qid: 'HMG/SAH/QID/9164',
    tableHeaders: [
      'DATE',
      'CONTROL RESULT VALID/NOT VALID',
      'PERFORMED BY',
      'DAILY REVIEW',
      'DAILY APPROVAL',
    ],
    headerMeta: ['Lot #', 'Expiry', 'Month/Year'],
    monthlyReviewTitle: 'MONTHLY REVIEW',
    monthlyApprovalTitle: 'MONTHLY SUPERVISOR / HEAD SECTION APPROVAL',
  },
  'hema-012': {
    key: 'hema-012',
    formNumber: 'Form-Hema-012',
    title: 'Positivia® Malaria Ag Rapid Test External Control Kit',
    footerLeft: 'Form-Hema-012-Malaria Screening Daily Qc-B',
    qid: 'HMG/SAH/QID/9436',
    tableHeaders: [
      'DATE',
      'Pf-HRP II Ag',
      'Pf-LDH Ag',
      'Pv-LDH Ag',
      'NEGATIVE',
      'PERFORMED BY',
      'DAILY REVIEW',
      'DAILY APPROVAL',
    ],
    headerMeta: ['Lot #', 'Expiry', 'Month/Year'],
    monthlyReviewTitle: 'MONTHLY REVIEW',
    monthlyApprovalTitle: 'MONTHLY SUPERVISOR / HEAD SECTION APPROVAL',
  },
};

export const ALIFAX_MAINTENANCE_CHECKLIST_ITEMS = [
  'Surface Cleaning',
  'Wash 5 Tubes',
  'Empty The Waste',
  'Fill D. Water Tank',
] as const;

export function resolveQCPrintTemplateKey(
  record: Pick<QCRecord, 'parameter' | 'instrumentId'>,
  instrumentName?: string,
): QCPrintTemplateKey {
  if (record.parameter === 'Sickling') return 'hema-005';
  if (record.parameter === 'Manual ESR QC') return 'hema-006';
  if (record.parameter === 'Malaria PH QC') return 'hema-007';
  const malariaTemplate = resolveMalariaQcPrintTemplateKey(record.parameter);
  if (malariaTemplate) return malariaTemplate;
  if (instrumentName === ALIFAX_ESR_INSTRUMENT && record.parameter === 'ESR') return 'hema-008b';
  return 'generic';
}

export function isControlledQCPrintTemplate(key: QCPrintTemplateKey): key is Exclude<QCPrintTemplateKey, 'generic'> {
  return key !== 'generic';
}

export function getQCPrintTemplateConfig(key: Exclude<QCPrintTemplateKey, 'generic'>): QCPrintTemplateConfig {
  return QC_PRINT_TEMPLATES[key];
}

export function resolveMaintenancePrintTemplateKey(instrumentName?: string): QCPrintTemplateKey {
  if (instrumentName === ALIFAX_ESR_INSTRUMENT) return 'hema-008a';
  return 'generic';
}
