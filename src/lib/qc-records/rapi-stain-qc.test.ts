import { describe, expect, it } from 'vitest';
import {
  isHistoricalRapiStainQcParameter,
  isLegacyRabiStainQcParameter,
  isRapiStainQcParameter,
  RAPI_STAIN_QC_PARAMETER,
  RAPI_STAIN_QC_PARAMETER_LEGACY,
} from './rapi-stain-qc';

describe('rapi-stain-qc helpers', () => {
  it('recognizes the current RAPI Stain QC parameter only for active workflow', () => {
    expect(isRapiStainQcParameter(RAPI_STAIN_QC_PARAMETER)).toBe(true);
    expect(isRapiStainQcParameter(RAPI_STAIN_QC_PARAMETER_LEGACY)).toBe(false);
  });

  it('retains legacy Rabi spelling for historical display', () => {
    expect(isHistoricalRapiStainQcParameter(RAPI_STAIN_QC_PARAMETER)).toBe(true);
    expect(isHistoricalRapiStainQcParameter(RAPI_STAIN_QC_PARAMETER_LEGACY)).toBe(true);
    expect(isLegacyRabiStainQcParameter(RAPI_STAIN_QC_PARAMETER_LEGACY)).toBe(true);
  });
});
