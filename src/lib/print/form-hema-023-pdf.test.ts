import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FORM_HEMA_023_DOCUMENT_NUMBER,
  FORM_HEMA_023_QID,
  FORM_HEMA_023_TITLE,
  ROSNER_FORMULA,
  formHema023PdfFilename,
} from '@/lib/medical-reports/form-hema-023/constants';
import { buildFormHema023Pdf } from '@/lib/print/form-hema-023-pdf';

function pdfLiteralText(raw: string): string {
  return [...raw.matchAll(/\((?:\\.|[^\\)])*\)/g)]
    .map((match) => match[0].slice(1, -1).replace(/\\([()\\])/g, '$1'))
    .join('\n');
}

describe('Form-Hema-023 PDF', () => {
  it('uses a study-number filename and rejects identifiers in the name', () => {
    expect(formHema023PdfFilename('H023-000123')).toBe('H023-000123-Form-Hema-023.pdf');
    expect(() => formHema023PdfFilename('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')).toThrow(/Invalid study number/);
    expect(() => formHema023PdfFilename('ACC-1001')).toThrow(/Invalid study number/);
  });

  it('prints the controlled identifiers, formula, both signatures, and one page', async () => {
    const doc = await buildFormHema023Pdf({
      studyNumber: 'H023-000123',
      studyDate: '2026-10-04',
      testSelection: 'both',
      performedByName: 'Lama Hassan',
      performedByStaffId: '4421',
      reviewedByName: 'Nora Saleh',
      reviewedByStaffId: '7788',
      sections: [
        {
          testType: 'aptt',
          patientClottingTime: '40',
          nppClottingTime: '30',
          targetValue: '32',
          immediateMixClottingTime: '33',
          immediateRosnerIndex: '7.5',
          immediateInterpretation: 'Does not exceed the Form-Hema-023 inhibitor threshold.',
          incubatedMixClottingTime: '39',
          incubatedRosnerIndex: '22.5',
          incubatedInterpretation: 'Suggests presence of an inhibitor',
          conclusion: 'APTT conclusion recorded by the performer.',
        },
        {
          testType: 'pt',
          patientClottingTime: '18',
          nppClottingTime: '12',
          targetValue: '13',
          immediateMixClottingTime: '13',
          immediateRosnerIndex: '5.555555555555555',
          immediateInterpretation: 'Does not exceed the Form-Hema-023 inhibitor threshold.',
          incubatedMixClottingTime: '16',
          incubatedRosnerIndex: '22.22222222222222',
          incubatedInterpretation: 'Suggests presence of an inhibitor',
          conclusion: 'PT conclusion recorded by the performer.',
        },
      ],
    }, { compress: false });

    expect(doc.getNumberOfPages()).toBe(1);
    const raw = pdfLiteralText(Buffer.from(doc.output('arraybuffer')).toString('latin1'));
    expect(raw).toContain(FORM_HEMA_023_TITLE);
    expect(raw).toContain(FORM_HEMA_023_DOCUMENT_NUMBER);
    expect(raw).toContain(FORM_HEMA_023_QID);
    expect(raw).toContain(ROSNER_FORMULA);
    expect(raw).toContain('Performed By: Lama Hassan');
    expect(raw).toContain('Reviewed By: Nora Saleh');
    expect(raw).toContain('Staff ID: 4421');
    expect(raw).toContain('Staff ID: 7788');
    expect(raw).toContain('Page 1 of 1');
    expect(raw).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
    expect(raw).not.toContain('TEST: PT MIXING STUDY'.replace('PT', 'PTT'));
  });

  it('does not draw an unselected section', async () => {
    const doc = await buildFormHema023Pdf({
      studyNumber: 'H023-000124',
      studyDate: '2026-10-04',
      testSelection: 'aptt',
      performedByName: 'Lama Hassan',
      performedByStaffId: '4421',
      reviewedByName: null,
      reviewedByStaffId: null,
      sections: [
        {
          testType: 'aptt',
          patientClottingTime: '40',
          nppClottingTime: '30',
          targetValue: '32',
          immediateMixClottingTime: '33',
          immediateRosnerIndex: '7.5',
          immediateInterpretation: 'Does not exceed the Form-Hema-023 inhibitor threshold.',
          incubatedMixClottingTime: '39',
          incubatedRosnerIndex: '22.5',
          incubatedInterpretation: 'Suggests presence of an inhibitor',
          conclusion: 'APTT only.',
        },
        {
          testType: 'pt',
          patientClottingTime: '99',
          nppClottingTime: '99',
          targetValue: '99',
          immediateMixClottingTime: '99',
          immediateRosnerIndex: '99',
          immediateInterpretation: 'Should not print',
          incubatedMixClottingTime: '99',
          incubatedRosnerIndex: '99',
          incubatedInterpretation: 'Should not print',
          conclusion: 'PT should not print',
        },
      ],
    }, { compress: false });
    const raw = pdfLiteralText(Buffer.from(doc.output('arraybuffer')).toString('latin1'));
    expect(doc.getNumberOfPages()).toBe(1);
    expect(raw).toContain('TEST: APTT MIXING STUDY');
    expect(raw).not.toContain('TEST: PT MIXING STUDY');
    expect(raw).not.toContain('PT should not print');
    expect(raw).toContain('Reviewed By:');
  });
});

describe('Form-Hema-023 migration safety', () => {
  const sql = readFileSync('supabase/migrations/077_form_hema_023_mixing_study.sql', 'utf8');

  it('is additive and does not rewrite earlier modules', () => {
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/\b(insert into|update|alter table|delete from)\s+public\.(reagent_lot|inventory_items|qc_records|stain_qc)/i);
    expect(sql).toContain('The reviewer must not be the performer');
    expect(sql).toContain('Workflow stage cannot be skipped');
    expect(sql).toContain('Reviewed mixing studies are locked');
    expect(sql).not.toMatch(/patient_name|accession_number|national_id/);
  });
});
