'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { BentoCard } from '@/components/dashboard/bento-card';
import { buildDashboardGreeting } from '@/lib/dashboard/greeting';

interface DashboardContentSkeletonProps {
  locale: string;
  userId: string;
  userFullName?: string | null;
}

function MetricSkeleton() {
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
      <Skeleton className="mt-4 h-8 w-full" />
    </div>
  );
}

function BentoSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <BentoCard title="Loading">
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </BentoCard>
  );
}

export function DashboardContentSkeleton({
  locale,
  userId,
  userFullName,
}: DashboardContentSkeletonProps) {
  const greeting = buildDashboardGreeting(userId, userFullName);
  const todayLabel = new Date().toLocaleDateString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
            {greeting.timeGreeting}, {greeting.firstName}{' '}
            <span aria-hidden="true">{greeting.accent}</span>
          </h1>
          <p className="mt-1.5 text-sm text-primary/70 md:text-[0.9375rem]">
            {greeting.motivationalMessage}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">{todayLabel}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <BentoSkeleton rows={4} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-9 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <MetricSkeleton key={i} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <BentoCard title="KPI Trends" subtitle="Last 8 weeks">
            <Skeleton className="h-[280px] w-full rounded-xl" />
          </BentoCard>
        </div>
        <div className="xl:col-span-4">
          <BentoSkeleton rows={4} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BentoSkeleton rows={4} />
        <BentoSkeleton rows={4} />
        <BentoSkeleton rows={4} />
      </div>
    </div>
  );
}
