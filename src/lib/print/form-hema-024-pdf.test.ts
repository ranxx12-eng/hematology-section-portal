import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { buildAlinityChecklist, alinityRequiredParameters, type ChecklistQcResult } from '@/lib/qc-records/alinity-checklist/aggregate';
import { FORM_HEMA_024_FOOTER, FORM_HEMA_024_QID } from '@/lib/qc-records/alinity-checklist/constants';
import { composeMonthlyQcReportPdf, createFormHema024CoverPdf } from '@/lib/print/form-hema-024-pdf';

const REQUIRED = alinityRequiredParameters();

function complete(monthStamp: string): ChecklistQcResult[] {
  return REQUIRED.map((parameter, index) => ({
    id: `row-${index}`,
    instrumentId: '11111111-1111-4111-8111-111111111111',
    parameter,
    level: 'Normal',
    recordedAt: monthStamp,
    qcStatus: index === 0 ? 'OUT' : 'IN',
    qcBatchId: 'batch-1',
    correctiveActions: index === 0 ? ['Repeat'] : [],
    correctiveActionComment: index === 0 ? 'Repeated after the original reject' : undefined,
    resolutionStatus: index === 0 ? 'IN' : undefined,
    reviewStatus: 'Reviewed',
    reviewedByUserId: 'senior-1',
    reviewedByName: 'Nora Saleh',
    reviewedByStaffId: 'S-2002',
    performedByUserId: 'tech-1',
    performedByName: 'Lama Hassan with a long displayed name for the legend',
    performedByStaffId: 'T-1001',
  }));
}

async function coverBytes(year: number, month: number, comment = ''): Promise<Uint8Array> {
  const checklist = buildAlinityChecklist({
    year,
    month,
    links: [{ day: 1, slot: 'run_1', qcBatchId: 'batch-1' }],
    records: complete(`${year}-${String(month).padStart(2, '0')}-01T06:00:00.000Z`),
    attestations: [],
  });
  const doc = await createFormHema024CoverPdf({
    instrumentName: 'Alinity HQ 1147',
    year,
    month,
    comment,
    checklist,
    reviewedBy: {
      fullName: 'Quality Officer With A Long Name',
      staffId: 'Q-3003',
      signedAt: '2026-07-31T12:00:00.000Z',
    },
  });
  return new Uint8Array(doc.output('arraybuffer'));
}

describe('Form-Hema-024 cover PDF', () => {
  it('keeps one landscape page, the controlled footer, and vector symbols', async () => {
    const bytes = await coverBytes(2026, 7, 'A'.repeat(800));
    const text = Buffer.from(bytes).toString('latin1');
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(text).toContain(FORM_HEMA_024_FOOTER);
    expect(text).toContain(FORM_HEMA_024_QID);
    expect(text).toContain('Alinity HQ 1147');
    expect(text).toContain('July 2026');
    expect(text).not.toContain('✓');
    expect(text).not.toContain('✕');
    expect(text).not.toContain('N/A');
  });

  it('builds a 30-day month, February, and leap-year February on one page', async () => {
    for (const [year, month] of [[2026, 4], [2026, 2], [2024, 2]] as const) {
      const bytes = await coverBytes(year, month);
      const pdf = await PDFDocument.load(bytes);
      expect(pdf.getPageCount()).toBe(1);
      expect(Buffer.from(bytes).toString('latin1')).toContain(FORM_HEMA_024_FOOTER);
    }
  });

  it('prepends the cover and does not add a blank detail page when no runs are printed', async () => {
    const checklist = buildAlinityChecklist({
      year: 2026,
      month: 7,
      links: [],
      records: [],
      attestations: [],
    });
    const bytes = await composeMonthlyQcReportPdf({
      cover: { instrumentName: 'Alinity HQ 1149', year: 2026, month: 7, checklist },
      records: [],
      instrumentNames: {},
      reportingPeriod: 'July 2026',
    });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    const text = Buffer.from(bytes).toString('latin1');
    expect(text).toContain('Alinity HQ 1149');
  });
});
