import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

export const SAMPLE_ID_KEY_VERSION = 'v1';
export const SAMPLE_ID_SYNTHETIC_KEY_VERSION = 'synthetic-v1';
export const SYNTHETIC_SAMPLE_ID_PREFIX = 'SYNTH-';

export interface SampleIdCryptoConfig {
  enabled: boolean;
  syntheticOnly: boolean;
  keyVersion: string;
}

export function getSampleIdCryptoConfig(): SampleIdCryptoConfig {
  const rawKey = process.env.SAMPLE_ID_ENCRYPTION_KEY?.trim();
  const syntheticOnly = process.env.SAMPLE_ID_ENCRYPTION_SYNTHETIC_ONLY === 'true' || !rawKey;
  return {
    enabled: Boolean(rawKey) && process.env.SAMPLE_ID_ENCRYPTION_SYNTHETIC_ONLY !== 'true',
    syntheticOnly,
    keyVersion: SAMPLE_ID_KEY_VERSION,
  };
}

function deriveKey(rawKey: string): Buffer {
  const trimmed = rawKey.trim();
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length >= 43) {
    const decoded = Buffer.from(trimmed, 'base64');
    if (decoded.length === 32) return decoded;
  }
  return createHash('sha256').update(trimmed).digest();
}

function getEncryptionKey(): Buffer | null {
  const rawKey = process.env.SAMPLE_ID_ENCRYPTION_KEY?.trim();
  if (!rawKey) return null;
  return deriveKey(rawKey);
}

export function isSyntheticSampleId(value: string): boolean {
  return value.startsWith(SYNTHETIC_SAMPLE_ID_PREFIX);
}

export function assertSampleIdAllowedForStorage(value: string): void {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Sample ID is required.');
  }
  const config = getSampleIdCryptoConfig();
  if (config.syntheticOnly && !isSyntheticSampleId(trimmed)) {
    throw new Error(
      'Real Sample IDs cannot be stored until SAMPLE_ID_ENCRYPTION_KEY is configured in a trusted server environment.',
    );
  }
}

function hashSyntheticSampleId(plaintext: string): string {
  return createHash('sha256').update(`sample-id-synthetic:${plaintext}`).digest('base64url');
}

export function storeSampleIdCiphertext(plaintext: string): {
  ciphertext: string;
  keyVersion: string;
  isSynthetic: boolean;
} {
  assertSampleIdAllowedForStorage(plaintext);
  const config = getSampleIdCryptoConfig();
  if (config.syntheticOnly) {
    return {
      ciphertext: `synthetic:${hashSyntheticSampleId(plaintext)}`,
      keyVersion: SAMPLE_ID_SYNTHETIC_KEY_VERSION,
      isSynthetic: true,
    };
  }
  const key = getEncryptionKey();
  if (!key) {
    throw new Error('Sample ID encryption key is not configured.');
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]).toString('base64url');
  return {
    ciphertext: payload,
    keyVersion: SAMPLE_ID_KEY_VERSION,
    isSynthetic: isSyntheticSampleId(plaintext),
  };
}

export function decryptSampleId(ciphertext: string, keyVersion: string): string {
  if (keyVersion === SAMPLE_ID_SYNTHETIC_KEY_VERSION) {
    throw new Error('Synthetic Sample IDs are stored as non-reversible references and cannot be decrypted.');
  }
  if (keyVersion !== SAMPLE_ID_KEY_VERSION) {
    throw new Error(`Unsupported Sample ID key version: ${keyVersion}`);
  }
  const key = getEncryptionKey();
  if (!key) {
    throw new Error('Sample ID encryption key is not configured.');
  }
  const payload = Buffer.from(ciphertext, 'base64url');
  if (payload.length < 29) {
    throw new Error('Invalid Sample ID ciphertext.');
  }
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

export function maskSampleIdLabel(isSynthetic: boolean): string {
  return isSynthetic ? 'Synthetic Sample ID on file' : 'Sample ID on file (encrypted)';
}

export function pdfSampleIdDisplay(sampleNumber: number, isSynthetic: boolean): string {
  return `[Sample ${sampleNumber} · ${maskSampleIdLabel(isSynthetic)}]`;
}
