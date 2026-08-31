import { locales, type Locale } from '@/i18n/request';

const AUTH_ROUTE_PREFIXES = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/change-password',
  '/session-expired',
  '/unauthorized',
] as const;

function stripLocale(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0];
  if (first && (locales as readonly string[]).includes(first)) {
    return '/' + segments.slice(1).join('/');
  }
  return pathname;
}

function isAuthDestination(pathname: string): boolean {
  const stripped = stripLocale(pathname);
  return AUTH_ROUTE_PREFIXES.some(
    (route) => stripped === route || stripped.startsWith(`${route}/`),
  );
}

/** Validate an internal post-login redirect target. Falls back to dashboard when unsafe. */
export function resolveSafeNextPath(
  next: string | null | undefined,
  locale: string,
  fallback?: string,
): string {
  const safeFallback = fallback ?? `/${locale}/dashboard`;

  if (!next) return safeFallback;

  let decoded = next;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    return safeFallback;
  }

  if (!decoded.startsWith('/') || decoded.startsWith('//')) {
    return safeFallback;
  }

  if (decoded.includes('://') || decoded.includes('\\')) {
    return safeFallback;
  }

  const pathname = decoded.split('?')[0] ?? decoded;
  const localePattern = /^\/(en|ar)(\/|$)/;
  if (!localePattern.test(pathname)) {
    return safeFallback;
  }

  if (isAuthDestination(pathname)) {
    return safeFallback;
  }

  return decoded;
}

export function buildLoginNextParam(pathname: string, search: string): string {
  return `${pathname}${search}`;
}

export function resolveLocaleFromPathname(pathname: string, fallback: Locale = 'en'): Locale {
  const segment = pathname.split('/').filter(Boolean)[0];
  return segment && (locales as readonly string[]).includes(segment)
    ? (segment as Locale)
    : fallback;
}
