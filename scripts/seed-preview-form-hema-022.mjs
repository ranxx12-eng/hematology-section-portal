#!/usr/bin/env node
/** Seed isolated preview project with Form-Hema-022 browser test fixtures. */
import { createClient } from '@supabase/supabase-js';

const PREVIEW_REF = 'kabfiqhnroxfpcevwtog';
const PRODUCTION_REF = 'rrdedjnzqpgymoorvwio';

function assertPreview(url) {
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  if (ref === PRODUCTION_REF) throw new Error('Refusing to seed production Supabase');
  if (ref !== PREVIEW_REF) throw new Error(`Unexpected ref ${ref}`);
}

async function main() {
  const url = process.env.PREVIEW_SUPABASE_URL;
  const serviceKey = process.env.PREVIEW_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Missing preview Supabase env vars');
  assertPreview(url);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const password = process.env.E2E_PREVIEW_USER_PASSWORD ?? 'preview-e2e-change-me';

  const { data: role } = await admin.from('roles').select('id').eq('name', 'inventory_officer').single();
  if (!role?.id) throw new Error('inventory_officer role missing');

  const users = [
    { email: 'e2e-preparer@preview-e2e.test', fullName: 'E2E Preparer', staffId: 'E2E-PREP' },
    { email: 'e2e-reviewer@preview-e2e.test', fullName: 'E2E Reviewer', staffId: 'E2E-REV' },
    { email: 'e2e-approver@preview-e2e.test', fullName: 'E2E Approver', staffId: 'E2E-APP' },
  ];

  for (const spec of users) {
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
      await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
    }
    await admin.from('profiles').upsert({
      id: user.id,
      email: spec.email,
      full_name: spec.fullName,
      staff_id: spec.staffId,
      primary_role_id: role.id,
      is_active: true,
    }, { onConflict: 'id' });
  }

  const instrumentId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  await admin.from('instruments').upsert({
    id: instrumentId,
    name: 'ALINITY HQ Preview',
    manufacturer: 'Abbott',
    model: 'ALINITY hq',
    serial_number: 'PREVIEW-ALINITY-001',
    location: 'Hematology',
    status: 'active',
    is_active: true,
  }, { onConflict: 'id' });

  const reticItemId = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';
  await admin.from('inventory_items').upsert({
    id: reticItemId,
    item_name: 'RETIC reagent',
    lot_number: 'RETIC-NEW-BROWSER',
    quantity: 10,
    category: 'reagent',
    unit: 'kit',
    storage_location: 'Cold Room',
    expiry_date: '2027-12-31',
  }, { onConflict: 'id' });

  console.log('Preview seed complete: users, ALINITY HQ instrument, RETIC reagent store item');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
