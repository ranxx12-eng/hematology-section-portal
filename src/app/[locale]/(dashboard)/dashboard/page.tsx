'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { useAuth } from '@/components/providers/auth-provider';
import { CommandCenterDashboard } from '@/components/dashboard/command-center-dashboard';
import { DashboardContentSkeleton } from '@/components/dashboard/dashboard-content-skeleton';
import { fetchCommandCenterSummary } from '@/lib/clinical/command-center-data';
import type { CommandCenterSummary } from '@/lib/clinical/command-center-data';

export default function DashboardPage() {
  const locale = useLocale();
  const { user, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<CommandCenterSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetchGeneration = useRef(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const generation = ++fetchGeneration.current;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const data = await fetchCommandCenterSummary(locale, user.id);
        if (generation !== fetchGeneration.current) return;
        setSummary(data);
      } catch (err) {
        if (generation !== fetchGeneration.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        if (generation === fetchGeneration.current) {
          setLoading(false);
        }
      }
    })();
  }, [authLoading, locale, user]);

  if (authLoading) {
    return (
      <DashboardContentSkeleton locale={locale} userId="loading" userFullName={null} />
    );
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Dashboard unavailable.
      </div>
    );
  }

  if (loading) {
    return (
      <DashboardContentSkeleton
        locale={locale}
        userId={user.id}
        userFullName={user.fullName}
      />
    );
  }

  if (error || !summary) {
    return (
      <div className="space-y-6">
        <DashboardContentSkeleton
          locale={locale}
          userId={user.id}
          userFullName={user.fullName}
        />
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {error ?? 'Dashboard unavailable.'}
        </div>
      </div>
    );
  }

  return (
    <CommandCenterDashboard
      locale={locale}
      summary={summary}
      userId={user.id}
      userFullName={user.fullName}
    />
  );
}
