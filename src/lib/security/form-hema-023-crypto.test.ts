import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  decryptFormHema023SampleReference,
  decryptSampleId,
  storeFormHema023SampleReference,
  storeSampleIdCiphertext,
} from '@/lib/security/sample-id-crypto';

describe('Form-Hema-023 sample reference encryption', () => {
  afterEach(() => {
    delete process.env.SAMPLE_ID_ENCRYPTION_KEY;
    delete process.env.SAMPLE_ID_ENCRYPTION_SYNTHETIC_ONLY;
  });

  it('does not store plaintext and separates Form-Hema-023 ciphertext from Form-Hema-022', () => {
    process.env.SAMPLE_ID_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
    process.env.SAMPLE_ID_ENCRYPTION_SYNTHETIC_ONLY = 'false';
    const sample = 'ACC-1001';
    const form023 = storeFormHema023SampleReference(sample);
    const form022 = storeSampleIdCiphertext(sample);
    expect(form023.ciphertext).not.toContain(sample);
    expect(form023.keyVersion).toBe('v1:form-hema-023');
    expect(decryptFormHema023SampleReference(form023.ciphertext, form023.keyVersion)).toBe(sample);
    expect(() => decryptSampleId(form023.ciphertext, form023.keyVersion)).toThrow();
    expect(() => decryptFormHema023SampleReference(form022.ciphertext, 'v1:form-hema-023')).toThrow();
  });

  it('does not fall back to plaintext when encryption is unavailable', () => {
    delete process.env.SAMPLE_ID_ENCRYPTION_KEY;
    const sample = 'ACC-1001';
    expect(() => storeFormHema023SampleReference(sample)).toThrow(/cannot be stored|not configured/i);
  });

  it('keeps a synthetic reference non-reversible and out of the stored value', () => {
    delete process.env.SAMPLE_ID_ENCRYPTION_KEY;
    const sample = 'SYNTH-ACC-1001';
    const stored = storeFormHema023SampleReference(sample);
    expect(stored.ciphertext.startsWith('synthetic:')).toBe(true);
    expect(stored.ciphertext).not.toContain(sample);
    expect(stored.keyVersion).toContain('form-hema-023');
    expect(() => decryptFormHema023SampleReference(stored.ciphertext, stored.keyVersion)).toThrow(/cannot be decrypted/i);
  });
});

describe('Form-Hema-023 client boundaries', () => {
  it('does not put encryption keys or ciphertext columns in the browser worksheet', () => {
    const worksheet = readFileSync('src/components/medical-reports/mixing-study-worksheet.tsx', 'utf8');
    const client = readFileSync('src/lib/clinical/mixing-studies.ts', 'utf8');
    const page = readFileSync('src/app/[locale]/(dashboard)/medical-reports/mixing-studies/[id]/page.tsx', 'utf8');
    for (const source of [worksheet, client, page]) {
      expect(source).not.toContain('SAMPLE_ID_ENCRYPTION_KEY');
      expect(source).not.toContain('sample_reference_ciphertext');
      expect(source).not.toContain('rrdedjnzqpgymoorvwio');
    }
  });
});
