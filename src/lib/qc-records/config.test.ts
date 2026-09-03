import { describe, expect, it } from 'vitest';
import {
  QC_INSTRUMENT_NAMES,
  resolveCanonicalQCInstrumentName,
} from './config';

describe('resolveCanonicalQCInstrumentName', () => {
  it('returns canonical names unchanged', () => {
    for (const name of QC_INSTRUMENT_NAMES) {
      expect(resolveCanonicalQCInstrumentName(name)).toBe(name);
    }
  });

  it('maps migration 051 Alinity HQ name variants', () => {
    expect(resolveCanonicalQCInstrumentName('Alinity HQ1147')).toBe('Alinity HQ 1147');
    expect(resolveCanonicalQCInstrumentName('Alinity HQ1149')).toBe('Alinity HQ 1149');
  });

  it('maps Stago and Alifax official seed names', () => {
    expect(resolveCanonicalQCInstrumentName('Stago STA-R MAX3')).toBe('Stago STA R MAX3');
    expect(resolveCanonicalQCInstrumentName('Alifax')).toBe('Alifax Test1');
  });

  it('maps Manual Test', () => {
    expect(resolveCanonicalQCInstrumentName('Manual Test')).toBe('Manual Test');
  });

  it('returns undefined for non-QC instruments', () => {
    expect(resolveCanonicalQCInstrumentName('Abbott Alinity HQ')).toBeUndefined();
    expect(resolveCanonicalQCInstrumentName('Centrifuge A')).toBeUndefined();
  });
});

describe('buildQCInstrumentLookup integration', () => {
  it('uses canonical names for parameter cascade', async () => {
    const { buildQCInstrumentLookup } = await import('@/lib/clinical/qc-records');
    const lookup = buildQCInstrumentLookup([
      { id: 'id-1147', name: 'Alinity HQ 1147' },
      { id: 'id-manual', name: 'Manual Test' },
    ]);

    expect(lookup.instrumentOptions).toHaveLength(2);
    expect(lookup.instrumentNames['id-1147']).toBe('Alinity HQ 1147');
    expect(lookup.instrumentNames['id-manual']).toBe('Manual Test');
  });
});
