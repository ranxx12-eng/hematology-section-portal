import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PREVIEW_REF = 'kabfiqhnroxfpcevwtog';
export const PRODUCTION_REF = 'rrdedjnzqpgymoorvwio';

export const DEFAULT_CREDENTIALS_PATH = path.join(__dirname, '..', '.preview-secrets.local.json');

export function assertPreviewUrl(url) {
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  if (!url || !ref) throw new Error('Invalid PREVIEW_SUPABASE_URL');
  if (ref === PRODUCTION_REF) {
    throw new Error(`Refusing to use production project ${PRODUCTION_REF}`);
  }
  if (ref !== PREVIEW_REF) {
    throw new Error(`Unexpected project ref ${ref}; expected ${PREVIEW_REF}`);
  }
  return ref;
}

/** @returns {{ accounts: Record<string, { email: string, password: string, role: string }>, rotatedAt?: string }} */
export function loadPreviewCredentials(filePath = process.env.PREVIEW_E2E_CREDENTIALS_FILE ?? DEFAULT_CREDENTIALS_PATH) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing preview credentials file (${filePath}). Run: node scripts/preview-access-bootstrap.mjs`,
    );
  }
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!parsed?.accounts?.preparer?.password) {
    throw new Error('Invalid preview credentials file shape');
  }
  return parsed;
}

export function passwordForAccount(credentials, key) {
  const entry = credentials.accounts[key];
  if (!entry?.password) throw new Error(`No credentials for account "${key}"`);
  return entry.password;
}
