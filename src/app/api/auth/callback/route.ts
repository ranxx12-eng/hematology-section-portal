import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveSafeNextPath, resolveLocaleFromPathname } from '@/lib/auth/safe-redirect';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = resolveSafeNextPath(
    searchParams.get('next'),
    resolveLocaleFromPathname(searchParams.get('next') ?? '/en'),
  );

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/en/login?error=auth_callback_failed`);
}
