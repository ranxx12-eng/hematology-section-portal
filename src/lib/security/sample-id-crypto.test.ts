import { afterEach, describe, expect, it } from 'vitest';
import {
  assertSampleIdAllowedForStorage,
  decryptSampleId,
  storeSampleIdCiphertext,
  SYNTHETIC_SAMPLE_ID_PREFIX,
} from '@/lib/security/sample-id-crypto';

describe('sample-id-crypto', () => {
  afterEach(() => {
    delete process.env.SAMPLE_ID_ENCRYPTION_KEY;
    delete process.env.SAMPLE_ID_ENCRYPTION_SYNTHETIC_ONLY;
  });

  it('blocks real sample IDs when only synthetic mode is available', () => {
    delete process.env.SAMPLE_ID_ENCRYPTION_KEY;
    expect(() => assertSampleIdAllowedForStorage('1234567')).toThrow(/cannot be stored/i);
    expect(() => assertSampleIdAllowedForStorage(`${SYNTHETIC_SAMPLE_ID_PREFIX}001`)).not.toThrow();
  });

  it('stores synthetic sample IDs without a key using non-reversible references', () => {
    delete process.env.SAMPLE_ID_ENCRYPTION_KEY;
    const sampleId = `${SYNTHETIC_SAMPLE_ID_PREFIX}001`;
    const stored = storeSampleIdCiphertext(sampleId);
    expect(stored.isSynthetic).toBe(true);
    expect(stored.ciphertext.startsWith('synthetic:')).toBe(true);
  });

  it('encrypts and decrypts sample IDs when key is configured', () => {
    process.env.SAMPLE_ID_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    process.env.SAMPLE_ID_ENCRYPTION_SYNTHETIC_ONLY = 'false';
    const sampleId = `${SYNTHETIC_SAMPLE_ID_PREFIX}001`;
    const stored = storeSampleIdCiphertext(sampleId);
    expect(decryptSampleId(stored.ciphertext, stored.keyVersion)).toBe(sampleId);
  });
});
