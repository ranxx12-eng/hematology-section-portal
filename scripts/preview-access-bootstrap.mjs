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

async function ensurePreviewOwnerPermissions(admin, roleId) {
  const codes = ['inventory.view', 'inventory.manage', 'instruments.view'];
  const { data: perms } = await admin.from('permissions').select('id, code').in('code', codes);
  for (const perm of perms ?? []) {
    await admin.from('role_permissions').upsert(
      { role_id: roleId, permission_id: perm.id },
      { onConflict: 'role_id,permission_id' },
    );
  }
}

async function revokePreviewOwner(admin, email) {
  const normalized = email.trim().toLowerCase();
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
  const user = list.data.users.find((u) => u.email?.toLowerCase() === normalized);
  if (!user) return { revoked: false, reason: 'not_found' };
  await admin.from('profiles').update({
    is_active: false,
    email: `revoked+${user.id.slice(0, 8)}@preview-revoked.local`,
    full_name: 'Revoked Preview User',
  }).eq('id', user.id);
  await admin.auth.admin.updateUserById(user.id, {
    ban_duration: '876000h',
    email: `revoked+${user.id.slice(0, 8)}@preview-revoked.local`,
  });
  const deleted = await admin.auth.admin.deleteUser(user.id);
  if (deleted.error) {
    return { revoked: true, reason: 'banned_and_profile_deactivated', deleteAuthFailed: true };
  }
  await admin.from('profiles').delete().eq('id', user.id);
  return { revoked: true };
}

async function inviteOwner(admin, roleId, ownerEmail, ownerFullName, previewSiteUrl) {
  const redirectTo = previewSiteUrl ? `${previewSiteUrl.replace(/\/$/, '')}/en/login` : undefined;
  const invited = await admin.auth.admin.inviteUserByEmail(ownerEmail, {
    data: { full_name: ownerFullName },
    redirectTo,
  });
  if (invited.error) throw invited.error;

  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
  const owner = list.data.users.find((u) => u.email?.toLowerCase() === ownerEmail.toLowerCase());
  if (owner) {
    await admin.from('profiles').upsert({
      id: owner.id,
      email: ownerEmail,
      full_name: ownerFullName,
      staff_id: 'PREVIEW-OWNER',
      primary_role_id: roleId,
      is_active: true,
    }, { onConflict: 'id' });
  }

  return { invitedEmail: ownerEmail };
}

async function main() {
  const url = process.env.PREVIEW_SUPABASE_URL;
  const serviceKey = process.env.PREVIEW_SUPABASE_SERVICE_ROLE_KEY;
  const ownerEmail = process.env.PREVIEW_OWNER_EMAIL;
  const ownerFullName = process.env.PREVIEW_OWNER_FULL_NAME ?? 'Preview Portal Owner';
  const previewSiteUrl = process.env.PREVIEW_SITE_URL;
  const revokeOwnerEmail = process.env.PREVIEW_REVOKE_OWNER_EMAIL;

  if (!url || !serviceKey) {
    throw new Error('Set PREVIEW_SUPABASE_URL and PREVIEW_SUPABASE_SERVICE_ROLE_KEY (preview project only)');
  }
  assertPreviewUrl(url);

  if (!ownerEmail) {
    throw new Error('Set PREVIEW_OWNER_EMAIL for your isolated Preview sign-in invite');
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const roleId = await ensureRole(admin);
  await ensurePreviewOwnerPermissions(admin, roleId);

  if (revokeOwnerEmail?.trim()) {
    const revokeResult = await revokePreviewOwner(admin, revokeOwnerEmail);
    console.log(
      revokeResult.revoked
        ? `Revoked preview-only owner ${revokeOwnerEmail.trim()} (sessions cleared, auth user removed).`
        : `No preview auth user to revoke for ${revokeOwnerEmail.trim()}.`,
    );
  }

  const accounts = {};
  for (const spec of E2E_ACCOUNTS) {
    const password = randomPassword();
    await upsertE2eUser(admin, roleId, spec, password);
    accounts[spec.key] = { email: spec.email, role: spec.key, password };
  }

  await inviteOwner(admin, roleId, ownerEmail, ownerFullName, previewSiteUrl);

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
    `fullName=${ownerFullName}`,
    `generatedAt=${payload.rotatedAt}`,
    `delivery=supabase_email_invite`,
    previewSiteUrl ? `previewSiteUrl=${previewSiteUrl}` : '',
  ].filter(Boolean);

  fs.writeFileSync(INVITE_PATH, `${inviteLines.join('\n')}\n`, { mode: 0o600 });

  console.log(`Rotated ${E2E_ACCOUNTS.length} preview E2E automation accounts.`);
  console.log(`Credentials file: ${CREDENTIALS_PATH} (gitignored)`);
  console.log(`Owner invite metadata: ${INVITE_PATH} (gitignored; complete setup via Supabase email — no link logged here)`);
  console.log(`Owner email: ${ownerEmail}`);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : JSON.stringify(err);
  console.error(message || 'Bootstrap failed');
  process.exit(1);
});
