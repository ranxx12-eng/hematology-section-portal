/** Form-Hema-021 parameter in Manual Test Add QC Record. */
export const RAPI_STAIN_QC_PARAMETER = 'RAPI Stain QC';

/** Legacy misspelling retained for historical qc_records display only. */
export const RAPI_STAIN_QC_PARAMETER_LEGACY = 'Rabi Stain QC';

export const RAPI_STAIN_QC_PARAMETERS = [
  RAPI_STAIN_QC_PARAMETER,
  RAPI_STAIN_QC_PARAMETER_LEGACY,
] as const;

export function isRapiStainQcParameter(parameter?: string | null): boolean {
  if (!parameter) return false;
  return parameter === RAPI_STAIN_QC_PARAMETER;
}

export function isHistoricalRapiStainQcParameter(parameter?: string | null): boolean {
  if (!parameter) return false;
  return (RAPI_STAIN_QC_PARAMETERS as readonly string[]).includes(parameter);
}

export function isLegacyRabiStainQcParameter(parameter?: string | null): boolean {
  return parameter === RAPI_STAIN_QC_PARAMETER_LEGACY;
}
