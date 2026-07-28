import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasSupabaseConfig } from '@/lib/security/env';

export async function POST() {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ success: true });
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.json({ success: true });
}
