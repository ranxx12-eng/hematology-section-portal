import { describe, expect, it } from 'vitest';
import { buildQcCatalogCards, buildQcCatalogDefinitions, resolveCatalogDefaultParameter } from '@/lib/qc-records/qc-catalog';
import { RAPI_STAIN_QC_PARAMETER } from '@/lib/qc-records/rapi-stain-qc';
import { ALL_PARAMETERS } from '@/lib/qc-records/config';
import type { QCRecord } from '@/types';

describe('qc catalog', () => {
  it('derives cards from the shared QC configuration', () => {
    const definitions = buildQcCatalogDefinitions();
    expect(definitions.some((item) => item.name.includes('CBC'))).toBe(true);
    expect(definitions.some((item) => item.parameter === RAPI_STAIN_QC_PARAMETER)).toBe(true);
    expect(definitions.find((item) => item.name === 'Giemsa Stain QC')?.disabled).toBe(true);
  });

  it('preselects All Parameters for Alinity instrument cards', () => {
    const alinity = buildQcCatalogDefinitions().find((item) => item.instrumentName === 'Alinity HQ 1147');
    expect(resolveCatalogDefaultParameter(alinity!)).toBe(ALL_PARAMETERS);
  });

  it('marks RAPI cards as stain workflow without qc_records status coupling', () => {
    const cards = buildQcCatalogCards([], {});
    const rapi = cards.find((item) => item.kind === 'rapi_stain');
    expect(rapi?.status).toBe('Not Recorded');
    expect(rapi?.formCode).toBe('Form-Hema-021');
  });

  it('derives OUT status from latest matching qc record', () => {
    const record: QCRecord = {
      id: '1',
      instrumentId: 'inst-manual',
      parameter: 'Sickling',
      level: 'Negative',
      recordedAt: '2026-09-08T10:00:00.000Z',
      qcFrequency: 'daily',
      qcStatus: 'OUT',
      correctiveActions: [],
      reviewStatus: 'Reviewed',
      approvalStatus: 'Approved',
      createdAt: '2026-09-08T10:00:00.000Z',
      updatedAt: '2026-09-08T10:00:00.000Z',
    };
    const cards = buildQcCatalogCards([record], { 'inst-manual': 'Manual Test' });
    const sickling = cards.find((item) => item.parameter === 'Sickling');
    expect(sickling?.status).toBe('OUT');
  });
});
