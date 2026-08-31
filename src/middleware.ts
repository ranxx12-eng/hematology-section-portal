import { NextResponse, type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from '@/i18n/request';
import { createMiddlewareClient } from '@/lib/supabase/middleware';
import { hasSupabaseConfig } from '@/lib/security/env';
import { buildLoginNextParam, resolveSafeNextPath } from '@/lib/auth/safe-redirect';

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

const AUTH_ROUTES = new Set([
  '/login',
  '/forgot-password',
  '/reset-password',
  '/change-password',
  '/session-expired',
  '/unauthorized',
]);

function stripLocale(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0];
  if (first && (locales as readonly string[]).includes(first)) {
    return '/' + segments.slice(1).join('/');
  }
  return pathname;
}

function isAuthRoute(path: string): boolean {
  return AUTH_ROUTES.has(path) || AUTH_ROUTES.has(path.split('/')[1] ? `/${path.split('/')[1]}` : path);
}

/** Read-only public routes (no session required). */
const PUBLIC_ROUTE_PREFIXES = ['/qc-live'] as const;
const QC_LIVE_PUBLIC_PATH = /^\/(en|ar)\/qc-live(\/|$)/;

function isPublicRoute(pathname: string): boolean {
  // Match locale-prefixed paths directly — safe on Edge even if stripLocale fails.
  if (QC_LIVE_PUBLIC_PATH.test(pathname)) {
    return true;
  }
  const path = stripLocale(pathname);
  return PUBLIC_ROUTE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  const response = intlMiddleware(request);
  const pathname = request.nextUrl.pathname;

  // Public read-only Live QC pages — skip auth entirely.
  if (isPublicRoute(pathname)) {
    return response;
  }

  const path = stripLocale(pathname);

  if (!hasSupabaseConfig()) {
    return response;
  }

  try {
    const supabase = createMiddlewareClient(request, response);
    const { data: { user } } = await supabase.auth.getUser();

    const isProtected = !isAuthRoute(path) && !isPublicRoute(path) && path !== '/';

    if (isProtected && !user) {
      const locale = request.nextUrl.pathname.split('/')[1] || defaultLocale;
      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set(
        'next',
        buildLoginNextParam(request.nextUrl.pathname, request.nextUrl.search),
      );
      return NextResponse.redirect(loginUrl);
    }

    if (isAuthRoute(path) && user && path === '/login') {
      const locale = request.nextUrl.pathname.split('/')[1] || defaultLocale;
      const destination = resolveSafeNextPath(
        request.nextUrl.searchParams.get('next'),
        locale,
      );
      return NextResponse.redirect(new URL(destination, request.url));
    }
  } catch {
    // Supabase misconfiguration — allow request; server components will surface errors.
  }

  return response;
}

export const config = {
  matcher: ['/', '/(ar|en)/:path*'],
};
