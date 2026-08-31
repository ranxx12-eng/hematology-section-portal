'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/components/providers/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Skeleton } from '@/components/ui/skeleton';
import {
  buildLoginHref,
  logAuthRedirect,
  persistPostLoginPath,
} from '@/lib/auth/safe-redirect';

function ProtectedLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isLoading && !user) {
      const query = searchParams.toString();
      const returnPath = `${pathname}${query ? `?${query}` : ''}`;
      persistPostLoginPath(returnPath);
      const loginHref = buildLoginHref(locale, returnPath);
      logAuthRedirect('protected-layout', {
        requestedPath: returnPath,
        loginHref,
      });
      router.replace(loginHref);
    }
  }, [user, isLoading, router, locale, pathname, searchParams]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-1/2" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <DashboardLayout>{children}</DashboardLayout>;
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={(
        <div className="flex min-h-screen items-center justify-center">
          <div className="space-y-4 w-64">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-8 w-1/2" />
          </div>
        </div>
      )}
    >
      <ProtectedLayoutInner>{children}</ProtectedLayoutInner>
    </Suspense>
  );
}
