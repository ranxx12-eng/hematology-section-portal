import { NextResponse, type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from '@/i18n/request';
import { createMiddlewareClient } from '@/lib/supabase/middleware';
import { hasSupabaseConfig } from '@/lib/security/env';
import {
  buildLoginNextParam,
  resolvePostLoginPath,
} from '@/lib/auth/safe-redirect';

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
  if (QC_LIVE_PUBLIC_PATH.test(pathname)) {
    return true;
  }
  const path = stripLocale(pathname);
  return PUBLIC_ROUTE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export async function proxy(request: NextRequest) {
  const response = intlMiddleware(request);
  const pathname = request.nextUrl.pathname;

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
      const returnPath = buildLoginNextParam(request.nextUrl.pathname, request.nextUrl.search);
      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set('next', returnPath);
      return NextResponse.redirect(loginUrl);
    }

    if (isAuthRoute(path) && user && path === '/login') {
      const locale = request.nextUrl.pathname.split('/')[1] || defaultLocale;
      const destination = resolvePostLoginPath(
        request.nextUrl.searchParams.get('next'),
        request.nextUrl.searchParams.get('redirect'),
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
