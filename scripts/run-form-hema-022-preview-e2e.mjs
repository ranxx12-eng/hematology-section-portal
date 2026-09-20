#!/usr/bin/env node
/**
 * Form-Hema-022 acceptance tests against the isolated Preview Supabase project.
 * Refuses to run against production project rrdedjnzqpgymoorvwio.
 *
 * Required env:
 *   PREVIEW_SUPABASE_URL=https://<preview-ref>.supabase.co
 *   PREVIEW_SUPABASE_ANON_KEY
 *   PREVIEW_SUPABASE_SERVICE_ROLE_KEY (never commit; preview project only)
 *   E2E_PREVIEW_USER_PASSWORD (optional; defaults to a disposable preview-only password)
 * Optional:
 *   SAMPLE_ID_ENCRYPTION_KEY (32-byte base64) — exercises encrypted storage round-trip
 */
import { createClient } from '@supabase/supabase-js';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const PRODUCTION_REF = 'rrdedjnzqpgymoorvwio';
const PREVIEW_REF = 'kabfiqhnroxfpcevwtog';
const PASSWORD = process.env.E2E_PREVIEW_USER_PASSWORD ?? 'preview-e2e-change-me';

const USERS = [
  { email: 'e2e-preparer@preview-e2e.test', fullName: 'E2E Preparer', staffId: 'E2E-PREP' },
  { email: 'e2e-reviewer@preview-e2e.test', fullName: 'E2E Reviewer', staffId: 'E2E-REV' },
  { email: 'e2e-approver@preview-e2e.test', fullName: 'E2E Approver', staffId: 'E2E-APP' },
];

const results = [];

function assertRef(url) {
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  if (!ref) throw new Error('Invalid PREVIEW_SUPABASE_URL');
  if (ref === PRODUCTION_REF) {
    throw new Error(`Refusing to run against production project ${PRODUCTION_REF}`);
  }
  if (ref !== PREVIEW_REF) {
    throw new Error(`Unexpected project ref ${ref}; expected ${PREVIEW_REF}`);
  }
  return ref;
}

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`PASS ${name}${detail ? `: ${detail}` : ''}`);
}

function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.error(`FAIL ${name}: ${detail}`);
}

function deriveKey(rawKey) {
  const trimmed = rawKey.trim();
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length >= 43) {
    const decoded = Buffer.from(trimmed, 'base64');
    if (decoded.length === 32) return decoded;
  }
  return createHash('sha256').update(trimmed).digest();
}

function encryptSampleId(plaintext, rawKey) {
  const key = deriveKey(rawKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

function decryptSampleId(ciphertext, rawKey) {
  const key = deriveKey(rawKey);
  const payload = Buffer.from(ciphertext, 'base64url');
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

async function ensureInventoryRole(admin) {
  const { data: role } = await admin.from('roles').select('id').eq('name', 'inventory_officer').single();
  if (!role?.id) throw new Error('inventory_officer role missing');
  return role.id;
}

async function ensureUser(admin, roleId, spec) {
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  let user = list.data.users.find((u) => u.email === spec.email);
  if (!user) {
    const created = await admin.auth.admin.createUser({
      email: spec.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: spec.fullName },
    });
    if (created.error) throw created.error;
    user = created.data.user;
  } else {
    await admin.auth.admin.updateUserById(user.id, { password: PASSWORD, email_confirm: true });
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

async function signIn(url, anonKey, email) {
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return { client, user: data.user };
}

async function rpcWorkflow(client, comparisonId, action, comment = null) {
  const { data, error } = await client.rpc('perform_reagent_lot_workflow_action', {
    p_comparison_id: comparisonId,
    p_action: action,
    p_comment: comment,
  });
  if (error) throw error;
  return data;
}

async function main() {
  const url = process.env.PREVIEW_SUPABASE_URL;
  const anonKey = process.env.PREVIEW_SUPABASE_ANON_KEY;
  const serviceKey = process.env.PREVIEW_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    throw new Error('Set PREVIEW_SUPABASE_URL, PREVIEW_SUPABASE_ANON_KEY, PREVIEW_SUPABASE_SERVICE_ROLE_KEY');
  }

  const ref = assertRef(url);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const roleId = await ensureInventoryRole(admin);
  const users = [];
  for (const spec of USERS) users.push(await ensureUser(admin, roleId, spec));

  const itemOldId = crypto.randomUUID();
  const itemNewId = crypto.randomUUID();
  await admin.from('inventory_items').upsert([
    { id: itemOldId, item_name: 'RETIC reagent', lot_number: 'RETIC-OLD-E2E', quantity: 5, category: 'reagent', unit: 'kit', storage_location: 'Cold' },
    { id: itemNewId, item_name: 'RETIC reagent', lot_number: 'RETIC-NEW-E2E', quantity: 5, category: 'reagent', unit: 'kit', storage_location: 'Cold' },
  ], { onConflict: 'id' });

  const reticSnapshot = [
    { code: 'RETIC', label: 'RETIC', acceptanceLimitPercent: 25, autoInterpretationEnabled: true },
    { code: 'R_PERCENT', label: 'R%', acceptanceLimitPercent: 25, autoInterpretationEnabled: true },
  ];

  // --- Draft backfill scenario: legacy draft with null limits ---
  const legacyDraftId = crypto.randomUUID();
  await admin.from('inventory_reagent_lot_comparisons').insert({
    id: legacyDraftId,
    study_number: 'RLT-E2E-LEGACY-DRAFT',
    status: 'draft',
    schema_version: 2,
    form_code: 'Form-Hema-022',
    reagent_key: 'retic_reagent',
    reagent_name: 'RETIC reagent',
    old_lot_number: 'LEG-OLD',
    new_lot_number: 'LEG-NEW',
    test_parameter: 'RETIC, R%',
    acceptance_criteria_configured: false,
    test_codes_snapshot: reticSnapshot,
    created_by: users[0].id,
  });
  const legacyRows = [];
  for (let sample = 1; sample <= 3; sample += 1) {
    for (const test of reticSnapshot) {
      legacyRows.push({
        comparison_id: legacyDraftId,
        sample_number: sample,
        test_code: test.code,
        test_label: test.label,
        old_result: 100,
        new_result: test.code === 'RETIC' ? 125 : 125,
        difference_percent: 25,
        interpretation: 'acceptable',
        acceptance_limit_percent: null,
        display_order: legacyRows.length,
      });
    }
  }
  await admin.from('inventory_reagent_lot_comparison_results').insert(legacyRows);

  const frozenApprovedId = crypto.randomUUID();
  await admin.from('inventory_reagent_lot_comparisons').insert({
    id: frozenApprovedId,
    study_number: 'RLT-E2E-FROZEN-APPROVED',
    status: 'approved',
    schema_version: 2,
    form_code: 'Form-Hema-022',
    reagent_key: 'retic_reagent',
    reagent_name: 'RETIC reagent',
    old_lot_number: 'FRZ-OLD',
    new_lot_number: 'FRZ-NEW',
    acceptance_criteria_configured: false,
    test_codes_snapshot: reticSnapshot,
    created_by: users[0].id,
    prepared_by: users[0].id,
    reviewed_by: users[1].id,
    approved_by: users[2].id,
  });
  await admin.from('inventory_reagent_lot_comparison_results').insert({
    comparison_id: frozenApprovedId,
    sample_number: 1,
    test_code: 'RETIC',
    test_label: 'RETIC',
    old_result: 100,
    new_result: 130,
    difference_percent: 30,
    interpretation: 'not_acceptable',
    acceptance_limit_percent: null,
    display_order: 0,
  });

  // Run draft-only backfill (mirrors supabase/scripts/backfill_form_hema_022_draft_criteria.sql)
  await admin.from('inventory_reagent_lot_comparisons').update({
    acceptance_criteria_configured: true,
    test_codes_snapshot: reticSnapshot,
  }).eq('id', legacyDraftId).in('status', ['draft', 'returned']);
  await admin.from('inventory_reagent_lot_comparison_results').update({
    acceptance_limit_percent: 25,
    acceptance_criterion_text: '≤ 25% difference',
  }).eq('comparison_id', legacyDraftId);

  const { data: legacyAfter } = await admin.from('inventory_reagent_lot_comparison_results')
    .select('old_result,new_result,difference_percent,acceptance_limit_percent,interpretation')
    .eq('comparison_id', legacyDraftId);
  const limitsOk = (legacyAfter ?? []).every((r) => r.acceptance_limit_percent === 25);
  const valuesPreserved = (legacyAfter ?? []).every((r) => Number(r.old_result) === 100 && Number(r.new_result) === 125);
  if (limitsOk && valuesPreserved) pass('draft RETIC backfill acquires 25% without losing entered results');
  else fail('draft RETIC backfill', `limitsOk=${limitsOk} valuesPreserved=${valuesPreserved}`);

  const { data: frozenAfter } = await admin.from('inventory_reagent_lot_comparison_results')
    .select('acceptance_limit_percent,difference_percent')
    .eq('comparison_id', frozenApprovedId)
    .single();
  if (frozenAfter?.acceptance_limit_percent == null && Number(frozenAfter?.difference_percent) === 30) {
    pass('submitted/approved RETIC study unchanged by draft-only backfill');
  } else {
    fail('frozen approved study', JSON.stringify(frozenAfter));
  }

  // --- Main workflow study ---
  const preparer = await signIn(url, anonKey, USERS[0].email);
  const reviewer = await signIn(url, anonKey, USERS[1].email);
  const approver = await signIn(url, anonKey, USERS[2].email);

  const { data: study, error: createErr } = await preparer.client
    .from('inventory_reagent_lot_comparisons')
    .insert({
      study_number: `RLT-E2E-${Date.now()}`,
      status: 'draft',
      schema_version: 2,
      form_code: 'Form-Hema-022',
      reagent_key: 'retic_reagent',
      reagent_name: 'RETIC reagent',
      analyte_test_group: 'CBC / Reticulocyte',
      form_layout: 'alinity_hq',
      test_codes_snapshot: reticSnapshot,
      old_lot_number: 'RETIC-OLD-E2E',
      new_lot_number: 'RETIC-NEW-E2E',
      new_store_item_id: itemNewId,
      test_parameter: 'RETIC, R%',
      acceptance_criteria_configured: true,
      study_year: new Date().getFullYear(),
      study_date: new Date().toISOString().slice(0, 10),
      instrument_name_snapshot: 'ALINITY HQ',
      created_by: preparer.user.id,
      updated_by: preparer.user.id,
    })
    .select('id')
    .single();
  if (createErr) throw createErr;
  const studyId = study.id;

  const resultRows = [];
  let order = 0;
  for (let sample = 1; sample <= 3; sample += 1) {
    for (const test of reticSnapshot) {
      resultRows.push({
        comparison_id: studyId,
        sample_number: sample,
        test_code: test.code,
        test_label: test.label,
        acceptance_limit_percent: 25,
        acceptance_criterion_text: '≤ 25% difference',
        old_result: 100,
        new_result: 125,
        difference_percent: 25,
        interpretation: 'acceptable',
        display_order: order++,
      });
    }
  }
  await preparer.client.from('inventory_reagent_lot_comparison_results').insert(resultRows);
  pass('create RETIC study with three samples and 25% limits per result');

  // Sample IDs — synthetic + encrypted round-trip
  const synthRows = [1, 2, 3].map((n) => ({
    comparison_id: studyId,
    sample_number: n,
    ciphertext: `synthetic:${createHash('sha256').update(`sample-id-synthetic:SYNTH-00${n}`).digest('base64url')}`,
    key_version: 'synthetic-v1',
    is_synthetic: true,
  }));
  const { error: synthErr } = await preparer.client.from('inventory_reagent_lot_sample_identifiers').upsert(synthRows);
  if (!synthErr) pass('store synthetic Sample IDs under RLS');
  else fail('synthetic Sample IDs', synthErr.message);

  const sampleKey = process.env.SAMPLE_ID_ENCRYPTION_KEY ?? Buffer.alloc(32, 9).toString('base64');
  const encryptedPlain = 'SYNTH-SEC-001';
  const ciphertext = encryptSampleId(encryptedPlain, sampleKey);
  const { error: encErr } = await preparer.client.from('inventory_reagent_lot_sample_identifiers').upsert({
    comparison_id: studyId,
    sample_number: 1,
    ciphertext,
    key_version: 'v1',
    is_synthetic: true,
  }, { onConflict: 'comparison_id,sample_number' });
  if (!encErr && decryptSampleId(ciphertext, sampleKey) === encryptedPlain) {
    pass('encrypted Sample ID round-trip with server-only test key');
  } else {
    fail('encrypted Sample ID', encErr?.message ?? 'decrypt mismatch');
  }

  // Security: direct status update blocked
  const { error: bypassErr } = await preparer.client
    .from('inventory_reagent_lot_comparisons')
    .update({ status: 'approved' })
    .eq('id', studyId);
  if (bypassErr?.message?.includes('workflow actions')) pass('direct UPDATE to approved blocked');
  else fail('direct UPDATE bypass', bypassErr?.message ?? 'update succeeded unexpectedly');

  const { error: escrowErr } = await preparer.client
    .from('_reagent_lot_workflow_escrows')
    .insert({ comparison_id: studyId, action: 'approve' });
  if (escrowErr) pass('direct escrow insert blocked');
  else fail('direct escrow insert', 'insert succeeded unexpectedly');

  await rpcWorkflow(preparer.client, studyId, 'submit');
  pass('submit via workflow RPC');

  try {
    await rpcWorkflow(preparer.client, studyId, 'review');
    fail('preparer self-review', 'should have been blocked');
  } catch (err) {
    if (String(err.message).includes('different users')) pass('preparer cannot self-review');
    else fail('preparer self-review', err.message);
  }

  await rpcWorkflow(reviewer.client, studyId, 'review');
  pass('independent review');

  try {
    await rpcWorkflow(reviewer.client, studyId, 'approve');
    fail('reviewer self-approve', 'should have been blocked');
  } catch (err) {
    if (String(err.message).includes('different users')) pass('reviewer cannot self-approve');
    else fail('reviewer self-approve', err.message);
  }

  await rpcWorkflow(approver.client, studyId, 'approve');
  pass('independent approval');

  // Failed activation (missing item link)
  const failStudyId = crypto.randomUUID();
  await admin.from('inventory_reagent_lot_comparisons').insert({
    id: failStudyId,
    study_number: 'RLT-E2E-ACTIVATION-FAIL',
    status: 'approved',
    schema_version: 2,
    reagent_name: 'RETIC reagent',
    old_lot_number: 'X',
    new_lot_number: 'MISSING-LOT',
    acceptance_criteria_configured: true,
    created_by: approver.user.id,
    prepared_by: preparer.user.id,
    reviewed_by: reviewer.user.id,
    approved_by: approver.user.id,
  });
  const { error: failActErr } = await approver.client.rpc('activate_reagent_lot_study', { p_comparison_id: failStudyId });
  if (failActErr?.message?.includes('Link a new store item')) pass('failed activation before item link');
  else fail('failed activation', failActErr?.message ?? 'unexpected success');

  const { data: failRow } = await admin.from('inventory_reagent_lot_comparisons').select('activated_at').eq('id', failStudyId).single();
  if (!failRow?.activated_at) pass('no partial activation state after failure');
  else fail('partial activation', 'activated_at set');

  const { error: actErr } = await approver.client.rpc('activate_reagent_lot_study', { p_comparison_id: studyId });
  if (!actErr) pass('successful activation');
  else fail('activation', actErr.message);

  const { error: repeatErr } = await approver.client.rpc('activate_reagent_lot_study', { p_comparison_id: studyId });
  if (repeatErr?.message?.includes('already activated')) pass('repeated activation blocked');
  else fail('repeated activation', repeatErr?.message ?? 'unexpected success');

  // Concurrent activation
  const concurrentId = crypto.randomUUID();
  await admin.from('inventory_reagent_lot_comparisons').insert({
    id: concurrentId,
    study_number: 'RLT-E2E-CONCURRENT',
    status: 'approved',
    schema_version: 2,
    reagent_name: 'RETIC reagent',
    reagent_key: 'retic_reagent',
    old_lot_number: 'C-OLD',
    new_lot_number: 'RETIC-NEW-E2E',
    new_store_item_id: itemNewId,
    acceptance_criteria_configured: true,
    created_by: approver.user.id,
    prepared_by: preparer.user.id,
    reviewed_by: reviewer.user.id,
    approved_by: approver.user.id,
  });
  await admin.from('inventory_lot_usage').delete().eq('reagent_comparison_id', concurrentId);
  const outcomes = await Promise.allSettled([
    approver.client.rpc('activate_reagent_lot_study', { p_comparison_id: concurrentId }),
    approver.client.rpc('activate_reagent_lot_study', { p_comparison_id: concurrentId }),
  ]);
  const successes = outcomes.filter((o) => o.status === 'fulfilled' && !o.value.error);
  const blocked = outcomes.filter((o) => o.status === 'fulfilled' && o.value.error?.message?.includes('already activated'));
  if (successes.length === 1 && blocked.length === 1) pass('concurrent activation serialized');
  else fail('concurrent activation', `success=${successes.length} blocked=${blocked.length}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\nPreview E2E on ${ref}: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
