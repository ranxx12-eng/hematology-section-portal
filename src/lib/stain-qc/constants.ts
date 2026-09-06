import type { StainQcFormCode } from '@/types/stain-qc';

export const FORM_HEMA_021_CODE = 'Form-Hema-021' as const satisfies StainQcFormCode;
export const FORM_HEMA_021_TITLE = 'Quality Control RAPI Stain';
export const FORM_HEMA_021_STAIN_NAME = 'RAPI Stain';
export const FORM_HEMA_021_FOOTER = 'Form-Hema-021-Quality-Control-RAPI-Stain';

export const FORM_HEMA_039_CODE = 'Form-Hema-039' as const satisfies StainQcFormCode;
export const FORM_HEMA_039_TITLE = 'Quality Control Giemsa Stain';
export const FORM_HEMA_039_STAIN_NAME = 'Giemsa Stain';

export const STAIN_QC_WORKFLOW_STATUSES = ['draft', 'submitted', 'reviewed', 'approved'] as const;

export const STAIN_QC_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted for Review',
  reviewed: 'Reviewed',
  approved: 'Approved',
};

export const STAIN_QC_CELL_STATUS_LABELS: Record<string, string> = {
  acceptable: 'Acceptable',
  not_acceptable: 'Not Acceptable',
  na: 'N/A',
};

export const STAIN_QC_CELL_SYMBOLS: Record<string, string> = {
  acceptable: '✓',
  not_acceptable: '✕',
  na: 'N/A',
};

/** Official visible result-symbol legend (Form-Hema-021 paper form). Not a QID/document number. */
export const STAIN_QC_RESULT_SYMBOL_LEGEND = [
  { symbol: '✓', label: 'ACCEPTABLE' },
  { symbol: '✕', label: 'NOT ACCEPTABLE' },
  { symbol: 'N/A', label: 'NOT APPLICABLE' },
] as const;

export function formatStainQcLegendLine(symbol: string, label: string): string {
  return `${symbol} : ${label}`;
}

export const STAIN_QC_RESULT_SYMBOL_LEGEND_LINES = STAIN_QC_RESULT_SYMBOL_LEGEND.map((entry) =>
  formatStainQcLegendLine(entry.symbol, entry.label),
);

export function stainQcResultLegendText(): string[] {
  return STAIN_QC_RESULT_SYMBOL_LEGEND_LINES;
}

export function stainQcPdfLegendBlock(): string {
  return stainQcResultLegendText().join('    ');
}

export const STAIN_QC_RESULT_SYMBOL_ARIA_LABELS: Record<string, string> = {
  acceptable: 'ACCEPTABLE',
  not_acceptable: 'NOT ACCEPTABLE',
  na: 'NOT APPLICABLE',
};

export const STAIN_QC_OVERALL_EVALUATION_LABELS: Record<string, string> = {
  acceptable: 'Acceptable',
  not_acceptable: 'Not Acceptable',
  na: 'N/A',
};

export const STAIN_QC_RESPONSIBILITY_LABELS: Record<string, string> = {
  slide_prepared: 'Prepared By',
  slide_checked: 'Checked By',
  qc_correction_change_stain: 'QC Correction / Change Stain',
};

/** Controlled corrective action for Form-Hema-021 Not Acceptable results. */
export const STAIN_QC_CONTROLLED_CORRECTIVE_ACTION = 'Change Stain';
export const STAIN_QC_CONTROLLED_CORRECTIVE_ACTION_CODE = 'change_stain' as const;

export interface StainQcFormDefinition {
  formCode: StainQcFormCode;
  formTitle: string;
  stainName: string;
  footer: string;
}

export const STAIN_QC_FORM_DEFINITIONS: Record<StainQcFormCode, StainQcFormDefinition> = {
  [FORM_HEMA_021_CODE]: {
    formCode: FORM_HEMA_021_CODE,
    formTitle: FORM_HEMA_021_TITLE,
    stainName: FORM_HEMA_021_STAIN_NAME,
    footer: FORM_HEMA_021_FOOTER,
  },
  [FORM_HEMA_039_CODE]: {
    formCode: FORM_HEMA_039_CODE,
    formTitle: FORM_HEMA_039_TITLE,
    stainName: FORM_HEMA_039_STAIN_NAME,
    footer: 'Form-Hema-039-Quality-Control-Giemsa-Stain',
  },
};

export function getStainQcFormDefinition(formCode: StainQcFormCode): StainQcFormDefinition {
  return STAIN_QC_FORM_DEFINITIONS[formCode];
}

export function isFormHema021Title(title: string): boolean {
  return title.includes(FORM_HEMA_021_CODE) || title.includes(FORM_HEMA_021_TITLE);
}

export function titleIncludesGiemsaFor021(title: string, formCode: StainQcFormCode): boolean {
  return formCode === FORM_HEMA_021_CODE && /giemsa/i.test(title);
}
