import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  decryptFormHema023SampleReference,
  FORM_HEMA_023_SYNTHETIC_KEY_VERSION,
  storeFormHema023SampleReference,
} from '@/lib/security/sample-id-crypto';

export const dynamic = 'force-dynamic';

const MASKED = 'Sample reference on file';
const SYNTHETIC_MASKED = 'Synthetic sample reference on file';

async function authorize(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data, error } = await supabase.rpc('get_mixing_study', { p_study_id: id });
  if (error || !data) {
    return { error: NextResponse.json({ error: 'Mixing study not found' }, { status: 404 }) };
  }
  return { supabase, study: data as { canEdit?: boolean; sampleReferencePresent?: boolean } };
}

function maskedResponse(present: boolean, synthetic = false) {
  return NextResponse.json({
    present,
    ...(synthetic ? { synthetic: true } : {}),
    maskedLabel: present ? (synthetic ? SYNTHETIC_MASKED : MASKED) : 'Not recorded',
  });
}

async function readCiphertext(id: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('medical_mixing_studies')
    .select('sample_reference_ciphertext, sample_reference_key_version, sample_reference_present')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return data as {
    sample_reference_ciphertext: string | null;
    sample_reference_key_version: string | null;
    sample_reference_present: boolean;
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const auth = await authorize(id);
  if ('error' in auth && auth.error) return auth.error;
  const present = Boolean(auth.study.sampleReferencePresent);
  try {
    const row = await readCiphertext(id);
    if (!row) return maskedResponse(present);
    const synthetic = row.sample_reference_key_version === FORM_HEMA_023_SYNTHETIC_KEY_VERSION;
    return maskedResponse(Boolean(row.sample_reference_present), synthetic);
  } catch {
    return maskedResponse(present);
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const auth = await authorize(id);
  if ('error' in auth && auth.error) return auth.error;
  const present = Boolean(auth.study.sampleReferencePresent);
  let row: Awaited<ReturnType<typeof readCiphertext>> = null;
  try {
    row = await readCiphertext(id);
  } catch {
    return maskedResponse(present);
  }
  if (!row?.sample_reference_ciphertext || !row.sample_reference_key_version) {
    return maskedResponse(present);
  }
  if (row.sample_reference_key_version === FORM_HEMA_023_SYNTHETIC_KEY_VERSION) {
    return maskedResponse(true, true);
  }
  try {
    const sampleReference = decryptFormHema023SampleReference(
      row.sample_reference_ciphertext,
      row.sample_reference_key_version,
    );
    return NextResponse.json({ present: true, sampleReference });
  } catch {
    return NextResponse.json({ error: 'Sample reference could not be read.' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const auth = await authorize(id);
  if ('error' in auth && auth.error) return auth.error;
  if (!auth.study.canEdit) {
    return NextResponse.json({ error: 'This mixing study cannot be edited.' }, { status: 409 });
  }

  let sampleReference = '';
  try {
    const body = await request.json() as { sampleReference?: unknown };
    if (typeof body.sampleReference !== 'string') {
      return NextResponse.json({ error: 'Sample reference could not be stored.' }, { status: 400 });
    }
    sampleReference = body.sampleReference.trim();
  } catch {
    return NextResponse.json({ error: 'Sample reference could not be stored.' }, { status: 400 });
  }

  if (sampleReference.length > 80) {
    return NextResponse.json({ error: 'Sample reference could not be stored.' }, { status: 400 });
  }

  const { supabase } = auth;
  if (!sampleReference) {
    const { error } = await supabase.rpc('set_mixing_study_sample_reference', {
      p_study_id: id,
      p_ciphertext: null,
      p_key_version: null,
    });
    if (error) return NextResponse.json({ error: 'Sample reference could not be stored.' }, { status: 400 });
    return NextResponse.json({ present: false, maskedLabel: 'Not recorded' });
  }

  try {
    const stored = storeFormHema023SampleReference(sampleReference);
    const { error } = await supabase.rpc('set_mixing_study_sample_reference', {
      p_study_id: id,
      p_ciphertext: stored.ciphertext,
      p_key_version: stored.keyVersion,
    });
    if (error) return NextResponse.json({ error: 'Sample reference could not be stored.' }, { status: 400 });
    return NextResponse.json({
      present: true,
      maskedLabel: stored.isSynthetic ? SYNTHETIC_MASKED : MASKED,
    });
  } catch {
    return NextResponse.json(
      { error: 'Sample reference cannot be stored until server encryption is configured.' },
      { status: 409 },
    );
  }
}
