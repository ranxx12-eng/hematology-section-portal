'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useAuth } from '@/components/providers/auth-provider';
import {
  CommandCenterDashboard,
  getDashboardGreeting,
  getUserFirstName,
} from '@/components/dashboard/command-center-dashboard';
import { fetchCommandCenterSummary } from '@/lib/clinical/command-center-data';
import type { CommandCenterSummary } from '@/lib/clinical/command-center-data';

export default function DashboardPage() {
  const locale = useLocale();
  const { user, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<CommandCenterSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const data = await fetchCommandCenterSummary(locale, user.id);
        setSummary(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, locale, user]);

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !summary) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        {error ?? 'Dashboard unavailable.'}
      </div>
    );
  }

  return (
    <CommandCenterDashboard
      locale={locale}
      summary={summary}
      userFirstName={getUserFirstName(user.fullName)}
      greeting={getDashboardGreeting()}
    />
  );
}
