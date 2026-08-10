#!/usr/bin/env node
/**
 * One-time production bootstrap: confirm auth user, set password, assign system_admin.
 *
 * Requires service-role credentials (never run in the browser).
 * Password is read from BOOTSTRAP_PASSWORD or a secure stdin prompt — never from source code.
 *
 * Usage:
 *   node scripts/bootstrap-system-admin.mjs [--email user@example.com]
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DEFAULT_EMAIL = 'admin@hematology.local';

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

/** Optionally load .env.local without adding dotenv dependency. */
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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  let email = DEFAULT_EMAIL;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--email' && argv[i + 1]) {
      email = argv[i + 1].trim().toLowerCase();
      i += 1;
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log(`Usage: node scripts/bootstrap-system-admin.mjs [--email ${DEFAULT_EMAIL}]`);
      console.log('');
      console.log('Environment:');
      console.log('  NEXT_PUBLIC_SUPABASE_URL       Supabase project URL');
      console.log('  SUPABASE_SECRET_KEY            Service role key (preferred)');
      console.log('  SUPABASE_SERVICE_ROLE_KEY      Legacy service role key name');
      console.log('  BOOTSTRAP_PASSWORD             One-time password (optional if using stdin)');
      process.exit(0);
    }
  }
  return { email };
}

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || isPlaceholder(url)) {
    fail('config', 'NEXT_PUBLIC_SUPABASE_URL is missing or still a placeholder.');
  }
  return url.replace(/\/+$/, '');
}

function getServiceRoleKey() {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || isPlaceholder(key)) {
    fail(
      'config',
      'SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is missing or still a placeholder.',
    );
  }
  return key;
}

function createAdminClient() {
  return createClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function readPasswordHidden(prompt = 'Bootstrap password (input hidden): ') {
  if (process.env.BOOTSTRAP_PASSWORD) {
    return process.env.BOOTSTRAP_PASSWORD;
  }

  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const value = Buffer.concat(chunks).toString('utf8').trim();
    if (!value) {
      fail(
        'password',
        'No password provided. Set BOOTSTRAP_PASSWORD or pipe a password on stdin.',
      );
    }
    return value;
  }

  process.stdout.write(prompt);
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  return new Promise((resolve, reject) => {
    let password = '';
    const onData = (char) => {
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        if (!password) {
          reject(new Error('Password cannot be empty.'));
          return;
        }
        resolve(password);
      } else if (char === '\u0003') {
        process.exit(130);
      } else if (char === '\u007f' || char === '\b') {
        if (password.length > 0) password = password.slice(0, -1);
      } else {
        password += char;
      }
    };
    stdin.on('data', onData);
  });
}

async function findAuthUserByEmail(admin, email) {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      fail('1-auth-user', `Failed to list auth users: ${error.message}`);
    }

    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
    );
    if (user) return user;

    if (data.users.length < perPage) break;
    page += 1;
  }

  return null;
}

async function verifyProfile(admin, userId, email) {
  const { data, error } = await admin
    .from('profiles')
    .select('id, email, is_active, deleted_at, primary_role_id, roles!primary_role_id ( name )')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    fail('4-profile', `Failed to query profiles: ${error.message}`);
  }

  if (!data) {
    fail(
      '4-profile',
      [
        `No profile row for auth user ${userId} (${email}).`,
        'Create the user in Supabase Dashboard → Authentication → Users, then wait for handle_new_user() to insert a read_only profile.',
        'If the user was created before migrations 009/010, insert the profile manually or recreate the auth user.',
      ].join(' '),
    );
  }

  return data;
}

async function assignSystemAdmin(admin, userId) {
  const { error: rpcError } = await admin.rpc('bootstrap_system_admin', { p_user_id: userId });

  if (!rpcError) {
    log('5-role', 'Assigned system_admin via bootstrap_system_admin RPC.');
    return 'rpc';
  }

  const rpcUnavailable =
    rpcError.code === 'PGRST202' ||
    rpcError.message?.includes('Could not find the function') ||
    rpcError.message?.includes('function public.bootstrap_system_admin');

  if (!rpcUnavailable) {
    fail('5-role', `bootstrap_system_admin RPC failed: ${rpcError.message}`);
  }

  log(
    '5-role',
    'bootstrap_system_admin RPC unavailable; falling back to direct primary_role_id update.',
  );

  const { data: role, error: roleError } = await admin
    .from('roles')
    .select('id')
    .eq('name', 'system_admin')
    .maybeSingle();

  if (roleError || !role?.id) {
    fail(
      '5-role',
      roleError?.message ??
        'system_admin role not found in roles table. Apply migration 010_reference_roles_permissions.sql.',
    );
  }

  const { error: updateError } = await admin
    .from('profiles')
    .update({ primary_role_id: role.id, is_active: true, deleted_at: null })
    .eq('id', userId);

  if (updateError) {
    fail('5-role', `Direct profile update failed: ${updateError.message}`);
  }

  log('5-role', 'Updated profiles.primary_role_id to system_admin (fallback path).');
  return 'fallback';
}

async function verifySystemAdminRole(admin, userId) {
  const { data, error } = await admin
    .from('profiles')
    .select('id, email, is_active, primary_role_id, roles!primary_role_id ( name )')
    .eq('id', userId)
    .single();

  if (error) {
    fail('verify', `Could not verify role assignment: ${error.message}`);
  }

  const roleName = Array.isArray(data.roles) ? data.roles[0]?.name : data.roles?.name;
  if (roleName !== 'system_admin') {
    fail('verify', `Expected system_admin role but found "${roleName ?? 'unknown'}".`);
  }

  log('verify', `Confirmed profile role: system_admin (user ${data.id}, active=${data.is_active}).`);
}

async function main() {
  loadEnvLocal();
  const { email } = parseArgs(process.argv.slice(2));

  log('config', `Target email: ${email}`);
  log('config', `Supabase URL: ${getSupabaseUrl()}`);

  let password;
  try {
    password = await readPasswordHidden();
  } catch (err) {
    fail('password', err.message ?? 'Failed to read password.');
  }

  if (password.length < 12) {
    fail('password', 'Password must be at least 12 characters.');
  }

  const admin = createAdminClient();

  log('1-auth-user', `Searching auth.users for ${email}...`);
  const authUser = await findAuthUserByEmail(admin, email);
  if (!authUser) {
    fail(
      '1-auth-user',
      `Auth user not found for ${email}. Create the user in Supabase Dashboard → Authentication → Users first.`,
    );
  }
  log('1-auth-user', `Found auth user ${authUser.id}.`);

  const emailConfirmed = Boolean(authUser.email_confirmed_at);
  if (!emailConfirmed) {
    log('2-email-confirm', 'email_confirmed_at is null — confirming email...');
    const { error } = await admin.auth.admin.updateUserById(authUser.id, { email_confirm: true });
    if (error) {
      fail('2-email-confirm', `Failed to confirm email: ${error.message}`);
    }
    log('2-email-confirm', 'Email confirmed.');
  } else {
    log('2-email-confirm', 'Email already confirmed — skipped.');
  }

  log('3-password', 'Setting password via admin.updateUserById (value not logged)...');
  const { error: passwordError } = await admin.auth.admin.updateUserById(authUser.id, {
    password,
  });
  if (passwordError) {
    fail('3-password', `Failed to set password: ${passwordError.message}`);
  }
  log('3-password', 'Password updated successfully.');

  const profile = await verifyProfile(admin, authUser.id, email);
  const currentRole = Array.isArray(profile.roles) ? profile.roles[0]?.name : profile.roles?.name;
  log('4-profile', `Profile exists (${profile.id}). Current primary role: ${currentRole ?? 'unknown'}.`);

  const assignmentPath = await assignSystemAdmin(admin, authUser.id);
  await verifySystemAdminRole(admin, authUser.id);

  log(
    'done',
    [
      'Bootstrap complete.',
      `User: ${email}`,
      `Role path: ${assignmentPath === 'rpc' ? 'bootstrap_system_admin RPC' : 'direct primary_role_id fallback'}`,
      'Sign in with the password you supplied (not stored by this script).',
    ].join(' '),
  );
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
