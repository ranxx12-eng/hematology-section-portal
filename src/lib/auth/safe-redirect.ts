import { locales, type Locale } from '@/i18n/request';

export const POST_LOGIN_PATH_STORAGE_KEY = 'portal_post_login_path';

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

export function buildLoginHref(locale: string, returnPath: string): string {
  const safePath = resolveSafeNextPath(returnPath, locale);
  return `/${locale}/login?next=${encodeURIComponent(safePath)}`;
}

export function resolveLocaleFromPathname(pathname: string, fallback: Locale = 'en'): Locale {
  const segment = pathname.split('/').filter(Boolean)[0];
  return segment && (locales as readonly string[]).includes(segment)
    ? (segment as Locale)
    : fallback;
}

export function persistPostLoginPath(path: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(POST_LOGIN_PATH_STORAGE_KEY, path);
  } catch {
    // Ignore storage failures (private mode, etc.).
  }
}

export function readPersistedPostLoginPath(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(POST_LOGIN_PATH_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearPersistedPostLoginPath(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(POST_LOGIN_PATH_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

/** Resolve post-login destination from next, legacy redirect, or session backup. */
export function resolvePostLoginPath(
  next: string | null | undefined,
  legacyRedirect: string | null | undefined,
  locale: string,
  persistedPath?: string | null,
): string {
  const fallback = `/${locale}/dashboard`;

  if (next) {
    return resolveSafeNextPath(next, locale, fallback);
  }

  if (legacyRedirect) {
    let decoded = legacyRedirect;
    try {
      decoded = decodeURIComponent(legacyRedirect);
    } catch {
      return resolveSafeNextPath(persistedPath, locale, fallback);
    }

    const persisted = persistedPath ?? null;
    if (persisted) {
      const persistedPathname = persisted.split('?')[0];
      if (persistedPathname === decoded || persisted.startsWith(`${decoded}?`)) {
        return resolveSafeNextPath(persisted, locale, fallback);
      }
    }

    return resolveSafeNextPath(decoded, locale, fallback);
  }

  if (persistedPath) {
    return resolveSafeNextPath(persistedPath, locale, fallback);
  }

  return fallback;
}

export function resolvePostLoginPathFromSearchParams(
  searchParams: Pick<URLSearchParams, 'get'>,
  locale: string,
  persistedPath?: string | null,
): string {
  return resolvePostLoginPath(
    searchParams.get('next'),
    searchParams.get('redirect'),
    locale,
    persistedPath,
  );
}

export function logAuthRedirect(
  stage: string,
  details: Record<string, string | null | undefined>,
): void {
  if (process.env.NODE_ENV !== 'development') return;
  console.info(`[auth-redirect:${stage}]`, details);
}
