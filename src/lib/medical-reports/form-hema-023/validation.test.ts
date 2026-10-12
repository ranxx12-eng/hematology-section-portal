import { describe, expect, it } from 'vitest';
import { buildMixingStudyPayload, emptyMixingSection, validateMixingStudy } from '@/lib/medical-reports/form-hema-023/validation';

const complete = {
  patientClottingTime: '40',
  nppClottingTime: '30',
  targetValue: '32',
  immediateMixClottingTime: '33',
  incubatedMixClottingTime: '39',
  conclusion: 'Recorded conclusion for this test.',
};

describe('Form-Hema-023 submission rules', () => {
  it('accepts an APTT-only submission without PT results', () => {
    const errors = validateMixingStudy({
      testSelection: 'aptt',
      studyDate: '2026-10-04',
      aptt: complete,
      pt: emptyMixingSection(),
    }, 'submit');
    expect(errors).toEqual({});
  });

  it('accepts a PT-only submission without APTT results', () => {
    const errors = validateMixingStudy({
      testSelection: 'pt',
      studyDate: '2026-10-04',
      aptt: emptyMixingSection(),
      pt: complete,
    }, 'submit');
    expect(errors).toEqual({});
  });

  it('requires both performed sections and their conclusions', () => {
    const missing = validateMixingStudy({
      testSelection: 'both',
      studyDate: '2026-10-04',
      aptt: complete,
      pt: { ...complete, conclusion: '   ' },
    }, 'submit');
    expect(missing.pt).toMatch(/Conclusion is required/);
    expect(missing.aptt).toBeUndefined();
  });

  it('does not require the unperformed test', () => {
    const payload = buildMixingStudyPayload({
      testSelection: 'aptt',
      studyDate: '2026-10-04',
      aptt: complete,
      pt: { ...complete, patientClottingTime: '-1', conclusion: '' },
    });
    expect(payload.results.map((row) => row.testType)).toEqual(['aptt']);
    expect(JSON.stringify(payload)).not.toMatch(/sample|mrn|accession|rosner/i);
  });

  it('rejects a negative clotting time on the performed test', () => {
    const errors = validateMixingStudy({
      testSelection: 'pt',
      studyDate: '2026-10-04',
      aptt: emptyMixingSection(),
      pt: { ...complete, nppClottingTime: '-5' },
    }, 'draft');
    expect(errors.pt).toMatch(/positive number/);
  });
});
