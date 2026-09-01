import type { QCPrintTemplateKey } from '@/lib/print/qc-print-templates';
import type { QCRecord } from '@/types';

/** Form-Hema-011 parameter (Manual Test instrument). */
export const MALARIA_QC_A_PARAMETER = 'Malaria Screening Daily QC - A';

/** Form-Hema-012 parameter (Manual Test instrument). */
export const MALARIA_QC_B_PARAMETER = 'Positivia Malaria Ag External Control';

/** Legacy parameter names retained for existing records. */
export const MALARIA_QC_A_PARAMETER_LEGACY = 'Malaria Kit QC';
export const MALARIA_QC_B_PARAMETER_LEGACY = 'Malaria External QC';

export const MALARIA_QC_A_PARAMETERS = [MALARIA_QC_A_PARAMETER, MALARIA_QC_A_PARAMETER_LEGACY] as const;
export const MALARIA_QC_B_PARAMETERS = [MALARIA_QC_B_PARAMETER, MALARIA_QC_B_PARAMETER_LEGACY] as const;

export const MALARIA_QC_A_CONTROL_RESULTS = ['Valid', 'Not Valid'] as const;
export type MalariaQcAControlResult = (typeof MALARIA_QC_A_CONTROL_RESULTS)[number];

export const MALARIA_QC_B_CONTROL_RESULTS = [
  'Pf-HRP II Ag',
  'Pf-LDH Ag',
  'Pv-LDH Ag',
  'Negative',
] as const;
export type MalariaQcBControlResult = (typeof MALARIA_QC_B_CONTROL_RESULTS)[number];

export function isMalariaQcAParameter(parameter?: string): boolean {
  if (!parameter) return false;
  return (MALARIA_QC_A_PARAMETERS as readonly string[]).includes(parameter);
}

export function isMalariaQcBParameter(parameter?: string): boolean {
  if (!parameter) return false;
  return (MALARIA_QC_B_PARAMETERS as readonly string[]).includes(parameter);
}

export function isMalariaControlledQcParameter(parameter?: string): boolean {
  return isMalariaQcAParameter(parameter) || isMalariaQcBParameter(parameter);
}

export function resolveMalariaQcPrintTemplateKey(parameter: string): QCPrintTemplateKey | null {
  if (isMalariaQcAParameter(parameter)) return 'hema-011';
  if (isMalariaQcBParameter(parameter)) return 'hema-012';
  return null;
}

export function malariaQcAControlResultFromRecord(record: Pick<QCRecord, 'qcStatus'>): MalariaQcAControlResult {
  return record.qcStatus === 'OUT' ? 'Not Valid' : 'Valid';
}

export function malariaQcAStatusFromControlResult(result: MalariaQcAControlResult): QCRecord['qcStatus'] {
  return result === 'Not Valid' ? 'OUT' : 'IN';
}

export function isValidMalariaQcBControlResult(value?: string | null): value is MalariaQcBControlResult {
  if (!value) return false;
  return (MALARIA_QC_B_CONTROL_RESULTS as readonly string[]).includes(value);
}

export function malariaQcBPrintMarks(level?: string | null): {
  pfHrp: string;
  pfLdh: string;
  pvLdh: string;
  negative: string;
} {
  const blank = '';
  const mark = '✓';
  switch (level) {
    case 'Pf-HRP II Ag':
      return { pfHrp: mark, pfLdh: blank, pvLdh: blank, negative: blank };
    case 'Pf-LDH Ag':
      return { pfHrp: blank, pfLdh: mark, pvLdh: blank, negative: blank };
    case 'Pv-LDH Ag':
      return { pfHrp: blank, pfLdh: blank, pvLdh: mark, negative: blank };
    case 'Negative':
      return { pfHrp: blank, pfLdh: blank, pvLdh: blank, negative: mark };
    default:
      return { pfHrp: blank, pfLdh: blank, pvLdh: blank, negative: blank };
  }
}

export function materialConfigParameterForTemplate(
  templateKey: 'hema-011' | 'hema-012',
): string {
  return templateKey === 'hema-011' ? MALARIA_QC_A_PARAMETER : MALARIA_QC_B_PARAMETER;
}
