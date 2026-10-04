import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  assertSampleIdAllowedForStorage,
  decryptSampleId,
  getSampleIdCryptoConfig,
  maskSampleIdLabel,
  storeSampleIdCiphertext,
} from '@/lib/security/sample-id-crypto';

export const dynamic = 'force-dynamic';

async function requireInventoryManage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  return { supabase, user };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ comparisonId: string }> },
) {
  const auth = await requireInventoryManage();
  if ('error' in auth && auth.error) return auth.error;
  const { supabase } = auth;
  const { comparisonId } = await context.params;

  const { data, error } = await supabase
    .from('inventory_reagent_lot_sample_identifiers')
    .select('sample_number, ciphertext, key_version, is_synthetic')
    .eq('comparison_id', comparisonId)
    .order('sample_number');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const config = getSampleIdCryptoConfig();
  if (!config.enabled) {
    return NextResponse.json({
      syntheticOnly: true,
      samples: (data ?? []).map((row) => ({
        sampleNumber: row.sample_number,
        maskedLabel: maskSampleIdLabel(Boolean(row.is_synthetic)),
        isSynthetic: row.is_synthetic,
      })),
    });
  }

  try {
    const samples = (data ?? []).map((row) => ({
      sampleNumber: row.sample_number,
      sampleId: decryptSampleId(row.ciphertext, row.key_version),
      isSynthetic: row.is_synthetic,
    }));
    return NextResponse.json({ syntheticOnly: false, samples });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unable to decrypt Sample IDs.' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ comparisonId: string }> },
) {
  const auth = await requireInventoryManage();
  if ('error' in auth && auth.error) return auth.error;
  const { supabase, user } = auth;
  const { comparisonId } = await context.params;

  const body = await request.json() as {
    samples?: Array<{ sampleNumber: number; sampleId: string }>;
  };
  if (!Array.isArray(body.samples) || body.samples.length === 0) {
    return NextResponse.json({ error: 'Sample identifiers are required.' }, { status: 400 });
  }

  const { data: comparison } = await supabase
    .from('inventory_reagent_lot_comparisons')
    .select('status, schema_version')
    .eq('id', comparisonId)
    .maybeSingle();
  if (!comparison) return NextResponse.json({ error: 'Study not found.' }, { status: 404 });
  if (comparison.schema_version !== 2) {
    return NextResponse.json({ error: 'Sample ID encryption applies to Form-Hema-022 studies only.' }, { status: 400 });
  }
  if (comparison.status !== 'draft' && comparison.status !== 'returned') {
    return NextResponse.json({ error: 'Study is read-only.' }, { status: 409 });
  }

  for (const sample of body.samples) {
    try {
      assertSampleIdAllowedForStorage(sample.sampleId.trim());
      const encrypted = storeSampleIdCiphertext(sample.sampleId.trim());
      const { error } = await supabase.from('inventory_reagent_lot_sample_identifiers').upsert({
        comparison_id: comparisonId,
        sample_number: sample.sampleNumber,
        ciphertext: encrypted.ciphertext,
        key_version: encrypted.keyVersion,
        is_synthetic: encrypted.isSynthetic,
      }, { onConflict: 'comparison_id,sample_number' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Unable to store Sample ID.' },
        { status: 400 },
      );
    }
  }

  await supabase.from('inventory_reagent_lot_comparisons').update({
    updated_by: user.id,
  }).eq('id', comparisonId);

  return NextResponse.json({ ok: true });
}
