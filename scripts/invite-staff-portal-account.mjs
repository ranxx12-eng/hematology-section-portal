#!/usr/bin/env node
/**
 * Invite a staff portal account via Supabase Admin API (server-side only).
 * Sends a secure invitation email — no password is set by this script.
 *
 * Usage:
 *   node scripts/invite-staff-portal-account.mjs \
 *     --email alhanouf.fulayhani@drsulaimanalhabib.com \
 *     --full-name "Alhanouf Khalaf" \
 *     --staff-id 244741 \
 *     --role senior_lab_technologist
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const PLACEHOLDER_PATTERNS = [
  'your-project',
  'your-anon-key',
  'your-publishable-key',
  'your-service-role-key',
  'your-secret-key',
];

function log(step, message) {
  console.log(`[${step}] ${message}`);
}

function fail(step, message) {
  console.error(`[${step}] ERROR: ${message}`);
  process.exit(1);
}

function isPlaceholder(value) {
  if (!value) return true;
  return PLACEHOLDER_PATTERNS.some((p) => value.includes(p));
}

function loadEnvLocal() {
  const envPath = join(ROOT, '.env.local');
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const args = {
    email: '',
    fullName: '',
    staffId: '',
    role: 'senior_lab_technologist',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = argv[i + 1];
    if (flag === '--email' && next) { args.email = next.trim().toLowerCase(); i += 1; }
    else if (flag === '--full-name' && next) { args.fullName = next.trim(); i += 1; }
    else if (flag === '--staff-id' && next) { args.staffId = next.trim(); i += 1; }
    else if (flag === '--role' && next) { args.role = next.trim(); i += 1; }
    else if (flag === '--help' || flag === '-h') {
      console.log('Usage: node scripts/invite-staff-portal-account.mjs --email ... --full-name ... --staff-id ... [--role senior_lab_technologist]');
      process.exit(0);
    }
  }
  if (!args.email || !args.fullName || !args.staffId) {
    fail('args', 'Required: --email, --full-name, --staff-id');
  }
  return args;
}

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || isPlaceholder(url)) fail('config', 'NEXT_PUBLIC_SUPABASE_URL is missing or placeholder.');
  return url.replace(/\/+$/, '');
}

function getServiceRoleKey() {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || isPlaceholder(key)) {
    fail('config', 'SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is missing. Configure server-side only.');
  }
  return key;
}

function getAppUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return url.replace(/\/+$/, '');
}

async function findAuthUserByEmail(admin, email) {
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) fail('auth', `listUsers failed: ${error.message}`);
    const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 1000) break;
    page += 1;
  }
  return null;
}

async function waitForProfile(admin, userId, attempts = 10) {
  for (let i = 0; i < attempts; i += 1) {
    const { data, error } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (error) fail('profile', error.message);
    if (data) return data;
    await new Promise((r) => setTimeout(r, 500));
  }
  fail('profile', `Profile not created for user ${userId} after handle_new_user trigger wait.`);
}

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv.slice(2));
  const admin = createClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  log('precheck', `Checking collisions for ${args.email} / Staff ID ${args.staffId}...`);
  const existingAuth = await findAuthUserByEmail(admin, args.email);
  const { count: profByEmail } = await admin.from('profiles').select('*', { count: 'exact', head: true }).ilike('email', args.email);
  const { count: profByStaff } = await admin.from('profiles').select('*', { count: 'exact', head: true }).eq('staff_id', args.staffId).is('deleted_at', null);
  const { count: empByCode } = await admin.from('employees').select('*', { count: 'exact', head: true }).eq('employee_code', args.staffId).is('deleted_at', null);

  if (existingAuth || (profByEmail ?? 0) > 0 || (profByStaff ?? 0) > 0 || (empByCode ?? 0) > 0) {
    fail('precheck', `Collision detected auth=${existingAuth ? 1 : 0} profileEmail=${profByEmail ?? 0} staff=${profByStaff ?? 0} employee=${empByCode ?? 0}`);
  }

  let user = await findAuthUserByEmail(admin, args.email);
  if (!user) {
    log('invite', `Sending invitation to ${args.email}...`);
    const { data, error } = await admin.auth.admin.inviteUserByEmail(args.email, {
      data: { full_name: args.fullName },
      redirectTo: `${getAppUrl()}/en/login`,
    });
    if (error) fail('invite', error.message);
    user = data.user;
    log('invite', `Invitation sent. Auth user ${user.id} created.`);
  } else {
    log('invite', `Auth user already exists (${user.id}) — skipping invite.`);
  }

  await waitForProfile(admin, user.id);

  const { data: role, error: roleError } = await admin.from('roles').select('id').eq('name', args.role).maybeSingle();
  if (roleError || !role?.id) fail('role', `Role ${args.role} not found.`);

  log('profile', 'Updating profile with verified Staff ID and portal role...');
  const { error: profileError } = await admin
    .from('profiles')
    .update({
      full_name: args.fullName,
      staff_id: args.staffId,
      primary_role_id: role.id,
      is_active: true,
      deleted_at: null,
    })
    .eq('id', user.id);
  if (profileError) fail('profile', profileError.message);

  log('user_roles', 'Ensuring active role assignment...');
  const { error: urError } = await admin.from('user_roles').upsert(
    {
      user_id: user.id,
      role_id: role.id,
      assigned_by: user.id,
      is_active: true,
    },
    { onConflict: 'user_id,role_id' },
  );
  if (urError) fail('user_roles', urError.message);

  const { data: readOnlyRole } = await admin.from('roles').select('id').eq('name', 'read_only').maybeSingle();
  if (readOnlyRole?.id) {
    await admin.from('user_roles').update({ is_active: false }).eq('user_id', user.id).eq('role_id', readOnlyRole.id);
  }

  log('sync', 'Staff ID update triggers employee sync via Migration 068 profile trigger.');
  await new Promise((r) => setTimeout(r, 1000));

  const { data: verifyProfile, error: verifyError } = await admin
    .from('profiles')
    .select('id, staff_id, employee_id, is_active, roles!primary_role_id(name)')
    .eq('id', user.id)
    .single();
  if (verifyError) fail('verify', verifyError.message);
  if (!verifyProfile.employee_id) {
    fail('verify', 'Employee link missing after staff_id assignment — check sync trigger and email uniqueness.');
  }

  const roleName = Array.isArray(verifyProfile.roles) ? verifyProfile.roles[0]?.name : verifyProfile.roles?.name;
  log('done', JSON.stringify({
    authUserId: user.id,
    email: args.email,
    staffId: verifyProfile.staff_id,
    employeeId: verifyProfile.employee_id,
    primaryRole: roleName,
    invitationSent: true,
  }));
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
