'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  Calendar,
  ClipboardCheck,
  FileText,
  FlaskConical,
  Gauge,
  GitCompare,
  LineChart,
  TestTube2,
  Thermometer,
} from 'lucide-react';
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BentoCard } from '@/components/dashboard/bento-card';
import { MetricCard } from '@/components/dashboard/metric-card';
import { StatusChip } from '@/components/ui/status-chip';
import { Button } from '@/components/ui/button';
import type { CommandCenterSummary } from '@/lib/clinical/command-center-data';
import { useAuth } from '@/components/providers/auth-provider';
import type { Permission } from '@/lib/permissions/roles';
import { formatDate } from '@/lib/utils';

const QUICK_ACTION_ICONS: Record<string, typeof FlaskConical> = {
  FlaskConical,
  TestTube2,
  AlertTriangle,
  Thermometer,
  Gauge,
  GitCompare,
  ClipboardCheck,
  FileText,
  BarChart3: LineChart,
};

const REJECTION_COLORS = ['#5b3fd6', '#7c6ae8', '#38bdf8', '#f59e0b', '#ef4444', '#94a3b8'];

interface CommandCenterDashboardProps {
  locale: string;
  summary: CommandCenterSummary;
  userFirstName: string;
  greeting: string;
}

function QualityHealthCard() {
  return (
    <BentoCard title="Quality Health Score" className="h-full">
      <div className="flex flex-col items-center justify-center py-4 text-center">
        <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-4 border-muted">
          <span className="text-sm font-medium text-muted-foreground">—</span>
        </div>
        <p className="mt-4 text-sm font-medium text-muted-foreground">Not configured</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Quality Health Score formula is not yet approved for this portal.
        </p>
      </div>
    </BentoCard>
  );
}

export function CommandCenterDashboard({
  locale,
  summary,
  userFirstName,
  greeting,
}: CommandCenterDashboardProps) {
  const { can } = useAuth();
  const todayLabel = useMemo(
    () => new Date().toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    [locale],
  );

  const trendData = summary.kpiTrendWeeks.map((week, index) => ({
    week,
    qcOut: summary.kpiTrendQcOut[index] ?? 0,
    highCv: summary.kpiTrendHighCv[index] ?? 0,
    rejections: summary.kpiTrendRejections[index] ?? 0,
  }));

  const visibleQuickActions = summary.quickActions.filter(
    (action) => !action.permission || can(action.permission as Permission),
  );

  const severityVariant = (severity: 'high' | 'medium' | 'low') => {
    if (severity === 'high') return 'danger' as const;
    if (severity === 'medium') return 'warning' as const;
    return 'neutral' as const;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            {greeting}, {userFirstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening in Hematology today.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">{todayLabel}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <QualityHealthCard />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-9 lg:grid-cols-3">
          <MetricCard
            title="QC OUT"
            value={summary.qcOutToday}
            subtitle={`${summary.qcOutThisMonth} this month`}
            icon={FlaskConical}
            iconClassName="bg-primary/10 text-primary"
            href={`/${locale}/quality-control`}
            sparkline={summary.qcOutWeeklyTrend}
            sparklineColor="#5b3fd6"
          />
          <MetricCard
            title="High CV"
            value={summary.highCvCount}
            subtitle="Manual review cases"
            icon={LineChart}
            iconClassName="bg-amber-500/10 text-amber-600"
            href={`/${locale}/quality/cv-monitoring`}
            sparkline={summary.highCvWeeklyTrend}
            sparklineColor="#f59e0b"
          />
          <MetricCard
            title="Critical Values TAT"
            value="Not configured"
            subtitle={`${summary.criticalValuesCount} total records`}
            unavailable
            icon={AlertTriangle}
            iconClassName="bg-destructive/10 text-destructive"
            href={`/${locale}/critical-values`}
          />
          <MetricCard
            title="Sample Rejections"
            value={summary.rejectionsThisMonth}
            subtitle="This month · rate not configured"
            icon={TestTube2}
            iconClassName="bg-warning/10 text-warning"
            href={`/${locale}/sample-rejections`}
            sparkline={summary.kpiTrendRejections}
            sparklineColor="#ef4444"
          />
          <MetricCard
            title="Overdue Actions"
            value={summary.overdueActions}
            subtitle="Tasks & calibration due"
            icon={ClipboardCheck}
            iconClassName="bg-destructive/10 text-destructive"
            href={`/${locale}/tasks`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <BentoCard title="KPI Trends" subtitle="Last 8 weeks">
            {trendData.some((row) => row.qcOut + row.highCv + row.rejections > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <RechartsLineChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="qcOut" name="QC OUT" stroke="#5b3fd6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="highCv" name="High CV" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="rejections" name="Rejections" stroke="#ef4444" strokeWidth={2} dot={false} />
                </RechartsLineChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">Insufficient historical data for trends.</p>
            )}
          </BentoCard>
        </div>

        <div className="xl:col-span-4">
          <BentoCard
            title="Active Alerts"
            subtitle={`${summary.alerts.length} current`}
            className="h-full"
          >
            {summary.alerts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No active alerts.</p>
            ) : (
              <ul className="space-y-3">
                {summary.alerts.map((alert) => (
                  <li key={alert.id}>
                    <Link
                      href={alert.href}
                      className="flex items-start gap-3 rounded-xl border border-border/60 p-3 transition-colors hover:bg-muted/40"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{alert.title}</p>
                          <StatusChip variant={severityVariant(alert.severity)} label={alert.severity} />
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{alert.context}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </BentoCard>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BentoCard title="Instrument Status">
          {summary.instruments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No instruments available.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {summary.instruments.map((instrument) => (
                <Link
                  key={instrument.id}
                  href={`/${locale}/instruments/${instrument.id}`}
                  className="rounded-xl border border-border/60 p-3 transition-colors hover:bg-muted/30"
                >
                  <p className="truncate text-sm font-medium">{instrument.name}</p>
                  {instrument.serialNumber && (
                    <p className="truncate text-xs text-muted-foreground">{instrument.serialNumber}</p>
                  )}
                  <StatusChip
                    variant={instrument.statusVariant}
                    label={instrument.statusLabel}
                    className="mt-2"
                  />
                </Link>
              ))}
            </div>
          )}
        </BentoCard>

        <BentoCard
          title="My Pending Tasks"
          action={(
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/${locale}/tasks`}>View all</Link>
            </Button>
          )}
        >
          {summary.pendingTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending tasks assigned to you.</p>
          ) : (
            <ul className="space-y-2">
              {summary.pendingTasks.map((task) => (
                <li key={task.id} className="rounded-lg border border-border/60 px-3 py-2">
                  <p className="text-sm font-medium">{task.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{task.module}</span>
                    <span>·</span>
                    <span>Due {formatDate(task.dueDate)}</span>
                    <StatusChip variant="info" label={task.priority} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </BentoCard>

        <BentoCard
          title="Upcoming Schedule"
          action={(
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/${locale}/calendar`}>
                <Calendar className="mr-1 h-4 w-4" />
                View calendar
              </Link>
            </Button>
          )}
        >
          {summary.upcomingSchedule.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming scheduled items.</p>
          ) : (
            <ul className="space-y-2">
              {summary.upcomingSchedule.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.type}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(item.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </BentoCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <BentoCard
            title="Top Rejection Reasons"
            subtitle="This month"
            action={(
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/${locale}/sample-rejections`}>View report</Link>
              </Button>
            )}
          >
            {summary.rejectionReasons.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No rejections this month.</p>
            ) : (
              <>
                <p className="mb-2 text-center text-2xl font-semibold">{summary.rejectionTotalThisMonth}</p>
                <p className="mb-4 text-center text-xs text-muted-foreground">Total rejections</p>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={summary.rejectionReasons} dataKey="count" nameKey="reason" innerRadius={45} outerRadius={70}>
                      {summary.rejectionReasons.map((entry, index) => (
                        <Cell key={entry.reason} fill={REJECTION_COLORS[index % REJECTION_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="mt-2 space-y-1 text-xs">
                  {summary.rejectionReasons.map((item) => (
                    <li key={item.reason} className="flex justify-between gap-2">
                      <span className="truncate">{item.reason}</span>
                      <span className="shrink-0 text-muted-foreground">{item.count} ({item.percentage}%)</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </BentoCard>
        </div>

        <div className="xl:col-span-8">
          <BentoCard title="Quick Actions">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {visibleQuickActions.map((action) => {
                const Icon = QUICK_ACTION_ICONS[action.icon] ?? Activity;
                return (
                  <Link
                    key={action.id}
                    href={action.href}
                    className="flex flex-col items-center gap-2 rounded-xl border border-border/60 p-4 text-center transition-colors hover:border-primary/30 hover:bg-primary/5"
                  >
                    <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <span className="text-xs font-medium leading-tight">{action.label}</span>
                  </Link>
                );
              })}
            </div>
          </BentoCard>
        </div>
      </div>

      <BentoCard title="Recent Activity">
        {summary.recentActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity recorded.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {summary.recentActivity.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3 min-w-0">
                  <Activity className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.action}</p>
                    <p className="text-xs text-muted-foreground">{item.module}{item.entity ? ` · ${item.entity.slice(0, 8)}` : ''}</p>
                  </div>
                </div>
                <time className="text-xs text-muted-foreground">{formatDate(item.time)}</time>
              </li>
            ))}
          </ul>
        )}
      </BentoCard>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function getDashboardGreeting(): string {
  return getGreeting();
}

export function getUserFirstName(fullName?: string): string {
  if (!fullName?.trim()) return 'there';
  return fullName.trim().split(/\s+/)[0] ?? 'there';
}
