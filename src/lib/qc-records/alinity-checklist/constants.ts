import { resolveCanonicalQCInstrumentName } from '@/lib/qc-records/config';

export const FORM_HEMA_024_FOOTER = 'Form-Hema-024-Alinity QC checklist';
export const FORM_HEMA_024_QID = 'HMG/SAH/QID/9397';
export const ALINITY_CHECKLIST_TIME_ZONE = 'Asia/Riyadh';

export const ALINITY_CHECKLIST_INSTRUMENT_NAMES = ['Alinity HQ 1147', 'Alinity HQ 1149'] as const;

export type AlinityChecklistInstrumentName = (typeof ALINITY_CHECKLIST_INSTRUMENT_NAMES)[number];

export const HEMA_024_ACCEPT_MARKER = '@@HEMA024_ACCEPT@@';
export const HEMA_024_REJECT_MARKER = '@@HEMA024_REJECT@@';

export function isAlinityChecklistInstrumentName(name: string | null | undefined): boolean {
  if (!name) return false;
  const canonical = resolveCanonicalQCInstrumentName(name);
  return canonical === 'Alinity HQ 1147' || canonical === 'Alinity HQ 1149';
}

export function alinityChecklistInstrumentLabel(name: string): AlinityChecklistInstrumentName | null {
  const canonical = resolveCanonicalQCInstrumentName(name);
  if (canonical === 'Alinity HQ 1147' || canonical === 'Alinity HQ 1149') return canonical;
  return null;
}
