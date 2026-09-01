import { describe, expect, it } from 'vitest';
import {
  isMalariaQcAParameter,
  isMalariaQcBParameter,
  isValidMalariaQcBControlResult,
  malariaQcAControlResultFromRecord,
  malariaQcAStatusFromControlResult,
  malariaQcBPrintMarks,
  resolveMalariaQcPrintTemplateKey,
} from '@/lib/qc-records/malaria-qc';

describe('resolveMalariaQcPrintTemplateKey', () => {
  it('maps Form 011 parameters', () => {
    expect(resolveMalariaQcPrintTemplateKey('Malaria Screening Daily QC - A')).toBe('hema-011');
    expect(resolveMalariaQcPrintTemplateKey('Malaria Kit QC')).toBe('hema-011');
  });

  it('maps Form 012 parameters', () => {
    expect(resolveMalariaQcPrintTemplateKey('Positivia Malaria Ag External Control')).toBe('hema-012');
    expect(resolveMalariaQcPrintTemplateKey('Malaria External QC')).toBe('hema-012');
  });
});

describe('Form 011 control result', () => {
  it('prints Valid for IN records', () => {
    expect(malariaQcAControlResultFromRecord({ qcStatus: 'IN' })).toBe('Valid');
  });

  it('prints Not Valid for OUT records', () => {
    expect(malariaQcAControlResultFromRecord({ qcStatus: 'OUT' })).toBe('Not Valid');
  });

  it('maps control result to qc status', () => {
    expect(malariaQcAStatusFromControlResult('Valid')).toBe('IN');
    expect(malariaQcAStatusFromControlResult('Not Valid')).toBe('OUT');
  });
});

describe('Form 012 single-select control result', () => {
  it('accepts only one of four values', () => {
    expect(isValidMalariaQcBControlResult('Pf-HRP II Ag')).toBe(true);
    expect(isValidMalariaQcBControlResult('Pf-LDH Ag')).toBe(true);
    expect(isValidMalariaQcBControlResult('Pv-LDH Ag')).toBe(true);
    expect(isValidMalariaQcBControlResult('Negative')).toBe(true);
    expect(isValidMalariaQcBControlResult('Positive')).toBe(false);
  });

  it('prints exactly one mark per row', () => {
    const hrp = malariaQcBPrintMarks('Pf-HRP II Ag');
    expect(hrp.pfHrp).toBe('✓');
    expect(hrp.pfLdh).toBe('');
    expect(hrp.pvLdh).toBe('');
    expect(hrp.negative).toBe('');

    const ldh = malariaQcBPrintMarks('Pf-LDH Ag');
    expect(ldh.pfHrp).toBe('');
    expect(ldh.pfLdh).toBe('✓');

    const pv = malariaQcBPrintMarks('Pv-LDH Ag');
    expect(pv.pvLdh).toBe('✓');
    expect(pv.pfHrp).toBe('');
    expect(pv.pfLdh).toBe('');

    const negative = malariaQcBPrintMarks('Negative');
    expect(negative.negative).toBe('✓');
    expect(negative.pfHrp).toBe('');
    expect(negative.pfLdh).toBe('');
    expect(negative.pvLdh).toBe('');
  });
});

describe('parameter detection', () => {
  it('detects malaria QC A and B parameters', () => {
    expect(isMalariaQcAParameter('Malaria Screening Daily QC - A')).toBe(true);
    expect(isMalariaQcBParameter('Positivia Malaria Ag External Control')).toBe(true);
    expect(isMalariaQcAParameter('Sickling')).toBe(false);
  });
});
