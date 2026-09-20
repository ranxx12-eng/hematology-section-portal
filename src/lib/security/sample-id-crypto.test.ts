import { afterEach, describe, expect, it } from 'vitest';
import {
  assertSampleIdAllowedForStorage,
  decryptSampleId,
  encryptSampleId,
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

  it('encrypts and decrypts synthetic sample IDs when key is configured', () => {
    process.env.SAMPLE_ID_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    const sampleId = `${SYNTHETIC_SAMPLE_ID_PREFIX}001`;
    const encrypted = encryptSampleId(sampleId);
    expect(decryptSampleId(encrypted.ciphertext, encrypted.keyVersion)).toBe(sampleId);
  });
});
