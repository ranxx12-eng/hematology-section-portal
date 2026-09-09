import { describe, expect, it } from 'vitest';
import { buildQcCatalogCards, buildQcCatalogDefinitions, resolveCatalogDefaultParameter } from '@/lib/qc-records/qc-catalog';
import { RAPI_STAIN_QC_PARAMETER } from '@/lib/qc-records/rapi-stain-qc';
import { ALL_PARAMETERS } from '@/lib/qc-records/config';
import { FORM_HEMA_021_CODE } from '@/lib/stain-qc/constants';
import type { QCRecord } from '@/types';
import type { RapiStainCatalogSnapshot } from '@/lib/qc-records/rapi-catalog-status';

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

  it('derives RAPI card status from stain_qc snapshot rather than qc_records', () => {
    const snapshot: RapiStainCatalogSnapshot = {
      sheet: {
        id: 'sheet-1',
        status: 'submitted',
        lotNumber: '244741',
        expiryDate: '2026-12-31',
        sheetMonth: 9,
        sheetYear: 2026,
      },
      criteria: [{
        id: '1',
        formCode: FORM_HEMA_021_CODE,
        criterionKey: 'pbf_spreading',
        sectionKey: 'pbf',
        sectionLabel: 'PBF',
        rowLabel: 'Spreading',
        displayOrder: 1,
      }],
      dailyResults: [{
        id: 'result-1',
        sheetId: 'sheet-1',
        formCode: FORM_HEMA_021_CODE,
        criterionKey: 'pbf_spreading',
        dayOfMonth: 9,
        resultStatus: 'acceptable',
        lotNumberSnapshot: '244741',
        recordedBy: 'user-1',
        recordedByName: 'Rawan Alfaifi',
        recordedByStaffId: '399894',
        recordedByInitials: 'RA',
        recordedAt: '2026-09-09T10:00:00.000Z',
      }],
      correctiveActions: [],
    };
    const cards = buildQcCatalogCards([], {}, snapshot);
    const rapi = cards.find((item) => item.kind === 'rapi_stain');
    expect(rapi?.status).toBe('Pending Review');
    expect(rapi?.sheetId).toBe('sheet-1');
    expect(rapi?.lotNumber).toBe('244741');
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
