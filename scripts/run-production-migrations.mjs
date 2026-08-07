#!/usr/bin/env node
/**
 * Run production migrations 001-010 only (no seed).
 * Requires DATABASE_URL or SUPABASE_DB_PASSWORD + project ref.
 */
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const migrationsDir = join(root, 'supabase/migrations');

const PRODUCTION_MIGRATIONS = [
  '001_extensions_and_types.sql',
  '002_core_auth_rbac_schema.sql',
  '003_operational_schema.sql',
  '004_indexes_and_triggers.sql',
  '005_rls_helpers.sql',
  '006_rls_policies.sql',
  '007_cms_schema.sql',
  '008_storage_buckets_and_policies.sql',
  '009_security_hardening.sql',
  '010_reference_roles_permissions.sql',
];

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const password = process.env.SUPABASE_DB_PASSWORD;
  const ref = process.env.SUPABASE_PROJECT_ID || 'rrdedjnzqpgymoorvwio';
  if (!password) {
    throw new Error(
      'DATABASE_URL or SUPABASE_DB_PASSWORD is required to execute migrations against remote Supabase.'
    );
  }
  const host = process.env.SUPABASE_DB_HOST || `aws-0-eu-central-1.pooler.supabase.com`;
  return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${host}:6543/postgres`;
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS supabase_migrations;
    CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
      version text PRIMARY KEY,
      statements text[],
      name text
    );
  `);
}

async function isApplied(client, version) {
  const { rows } = await client.query(
    'SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = $1',
    [version]
  );
  return rows.length > 0;
}

async function markApplied(client, version, name) {
  await client.query(
    'INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [version, name]
  );
}

async function main() {
  const url = getDatabaseUrl();
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  const results = [];

  await client.connect();
  await ensureMigrationTable(client);

  for (const file of PRODUCTION_MIGRATIONS) {
    const version = file.replace('.sql', '');
    if (await isApplied(client, version)) {
      results.push({ file, status: 'skipped', message: 'Already applied' });
      continue;
    }

    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await markApplied(client, version, file);
      await client.query('COMMIT');
      results.push({ file, status: 'applied' });
      console.log(`✓ ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      results.push({ file, status: 'failed', message: err.message });
      console.error(`✗ ${file}: ${err.message}`);
      throw err;
    }
  }

  await client.end();
  return results;
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
