import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolvePostLoginPath, resolveLocaleFromPathname } from '@/lib/auth/safe-redirect';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const locale = resolveLocaleFromPathname(searchParams.get('next') ?? searchParams.get('redirect') ?? '/en');
  const next = resolvePostLoginPath(
    searchParams.get('next'),
    searchParams.get('redirect'),
    locale,
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
