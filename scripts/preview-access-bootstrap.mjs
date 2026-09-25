#!/usr/bin/env node
/**
 * Preview-only access bootstrap (kabfiqhnroxfpcevwtog).
 * - Rotates disposable E2E automation accounts with unique random passwords.
 * - Sends a Supabase invite / recovery link for the portal owner (password chosen by them).
 * Writes secrets only to gitignored local files — never commit output.
 */
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  DEFAULT_CREDENTIALS_PATH,
  PREVIEW_REF,
  PRODUCTION_REF,
  assertPreviewUrl,
} from './lib/preview-credentials.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INVITE_PATH = path.join(__dirname, '.preview-owner-invite.local.txt');
const CREDENTIALS_PATH = process.env.PREVIEW_E2E_CREDENTIALS_FILE ?? DEFAULT_CREDENTIALS_PATH;

const E2E_ACCOUNTS = [
  { key: 'preparer', email: 'e2e-preparer@preview-e2e.test', fullName: 'E2E Preparer', staffId: 'E2E-PREP' },
  { key: 'reviewer', email: 'e2e-reviewer@preview-e2e.test', fullName: 'E2E Reviewer', staffId: 'E2E-REV' },
  { key: 'approver', email: 'e2e-approver@preview-e2e.test', fullName: 'E2E Approver', staffId: 'E2E-APP' },
];

function randomPassword() {
  return crypto.randomBytes(24).toString('base64url');
}

async function ensureRole(admin) {
  const { data: role, error } = await admin.from('roles').select('id').eq('name', 'inventory_officer').single();
  if (error || !role?.id) throw new Error('inventory_officer role missing on preview project');
  return role.id;
}

async function upsertE2eUser(admin, roleId, spec, password) {
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  let user = list.data.users.find((u) => u.email === spec.email);
  if (!user) {
    const created = await admin.auth.admin.createUser({
      email: spec.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: spec.fullName },
    });
    if (created.error) throw created.error;
    user = created.data.user;
  } else {
    const updated = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    });
    if (updated.error) throw updated.error;
  }

  const { data: instrumentsView } = await admin.from('permissions').select('id').eq('code', 'instruments.view').single();
  if (instrumentsView?.id) {
    await admin.from('role_permissions').upsert(
      { role_id: roleId, permission_id: instrumentsView.id },
      { onConflict: 'role_id,permission_id' },
    );
  }

  await admin.from('profiles').upsert({
    id: user.id,
    email: spec.email,
    full_name: spec.fullName,
    staff_id: spec.staffId,
    primary_role_id: roleId,
    is_active: true,
  }, { onConflict: 'id' });

  return user;
}

async function inviteOwner(admin, roleId, ownerEmail, previewSiteUrl) {
  const redirectTo = previewSiteUrl ? `${previewSiteUrl.replace(/\/$/, '')}/en/login` : undefined;
  const link = await admin.auth.admin.generateLink({
    type: 'invite',
    email: ownerEmail,
    options: {
      data: { full_name: 'Preview Portal Owner' },
      redirectTo,
    },
  });
  if (link.error) throw link.error;
  const actionLink = link.data?.properties?.action_link ?? link.data?.action_link ?? null;
  void admin.auth.admin.inviteUserByEmail(ownerEmail, {
    data: { full_name: 'Preview Portal Owner' },
    redirectTo,
  });

  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const owner = list.data.users.find((u) => u.email?.toLowerCase() === ownerEmail.toLowerCase());
  if (owner) {
    await admin.from('profiles').upsert({
      id: owner.id,
      email: ownerEmail,
      full_name: 'Preview Portal Owner',
      staff_id: 'PREVIEW-OWNER',
      primary_role_id: roleId,
      is_active: true,
    }, { onConflict: 'id' });
  }

  return { actionLink, invitedEmail: ownerEmail };
}

async function main() {
  const url = process.env.PREVIEW_SUPABASE_URL;
  const serviceKey = process.env.PREVIEW_SUPABASE_SERVICE_ROLE_KEY;
  const ownerEmail = process.env.PREVIEW_OWNER_EMAIL;
  const previewSiteUrl = process.env.PREVIEW_SITE_URL;

  if (!url || !serviceKey) {
    throw new Error('Set PREVIEW_SUPABASE_URL and PREVIEW_SUPABASE_SERVICE_ROLE_KEY (preview project only)');
  }
  assertPreviewUrl(url);

  if (!ownerEmail) {
    throw new Error('Set PREVIEW_OWNER_EMAIL for your isolated Preview sign-in invite');
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const roleId = await ensureRole(admin);

  const accounts = {};
  for (const spec of E2E_ACCOUNTS) {
    const password = randomPassword();
    await upsertE2eUser(admin, roleId, spec, password);
    accounts[spec.key] = { email: spec.email, role: spec.key, password };
  }

  const ownerInvite = await inviteOwner(admin, roleId, ownerEmail, previewSiteUrl);

  const payload = {
    projectRef: PREVIEW_REF,
    rotatedAt: new Date().toISOString(),
    accounts,
    owner: { email: ownerEmail, inviteDispatched: true },
  };

  fs.writeFileSync(CREDENTIALS_PATH, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });

  const inviteLines = [
    `# Preview owner invite (${PREVIEW_REF}) — do not commit`,
    `email=${ownerEmail}`,
    `generatedAt=${payload.rotatedAt}`,
    ownerInvite.actionLink ? `actionLink=${ownerInvite.actionLink}` : 'actionLink=(check email inbox for Supabase invite)',
    previewSiteUrl ? `previewSiteUrl=${previewSiteUrl}` : '',
  ].filter(Boolean);

  fs.writeFileSync(INVITE_PATH, `${inviteLines.join('\n')}\n`, { mode: 0o600 });

  console.log(`Rotated ${E2E_ACCOUNTS.length} preview E2E automation accounts.`);
  console.log(`Credentials file: ${CREDENTIALS_PATH} (gitignored)`);
  console.log(`Owner invite metadata: ${INVITE_PATH} (gitignored; open actionLink locally — never paste in chat)`);
  console.log(`Owner email: ${ownerEmail}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
