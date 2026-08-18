'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  AlertTriangle, XCircle, Hourglass, Clock, ArrowRight, FlaskConical,
  CheckSquare, GraduationCap, Package, Activity,
} from 'lucide-react';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getKPIStatus } from '@/lib/calculations/tat';
import type { DashboardWidgetData } from '@/lib/clinical/reports-data';
import { BRAND_COLORS } from '@/lib/brand/colors';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import type { DashboardStats } from '@/types';
import type { DashboardWidgetType } from '@/types/modules';

interface DashboardWidgetsProps {
  enabledWidgets: DashboardWidgetType[];
  db: DashboardWidgetData;
  stats: DashboardStats;
  locale: string;
}

export function DashboardWidgets({ enabledWidgets, db, stats, locale }: DashboardWidgetsProps) {
  const tc = useTranslations('common');
  const td = useTranslations('dashboard');
  const settings = db.settings;
  const images = db.dashboardImages;

  const qualityStats = {
    criticalValues: db.criticalValues.length,
    sampleRejections: db.sampleRejections.length,
    pendingSamples: db.pendingSamples.filter((p) => p.isActive).length,
    awaitingReplacement: db.sampleRejections.filter((r) => r.replacementSampleStatus === 'Awaiting Replacement Sample').length,
    discardDue: db.sampleRejections.filter((r) => r.discardStatus === 'discard_due').length,
  };

  const tatIndicators = (() => {
    const routine = db.tatRecords.filter((r) => r.priority === 'routine');
    const stat = db.tatRecords.filter((r) => r.priority === 'stat');
    const avgRoutine = routine.length ? routine.reduce((s, r) => s + r.calculatedTat, 0) / routine.length : 0;
    const avgStat = stat.length ? stat.reduce((s, r) => s + r.calculatedTat, 0) / stat.length : 0;
    return [
      { name: 'Routine TAT', current: Math.round(avgRoutine), target: settings.tatTargets.routine, unit: 'min' },
      { name: 'STAT TAT', current: Math.round(avgStat), target: settings.tatTargets.stat, unit: 'min' },
    ];
  })();

  const monthlyTrend = Array.from({ length: 6 }, (_, i) => ({
    month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i],
    routine: 200 + i * 12 + (i % 2) * 8,
    stat: 45 + i * 3,
  }));

  const sampleVolume = Array.from({ length: 7 }, (_, i) => ({
    day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
    volume: 80 + i * 15 + (i % 3) * 10,
  }));

  const pinnedAnnouncements = db.announcements.filter((a) => a.isPinned && a.isPublished).slice(0, 3);
  const upcomingEvents = [...db.calendarEvents].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()).slice(0, 4);

  const quickLinks = [
    { href: '/employees', label: tc('employees') },
    { href: '/critical-values', label: tc('criticalValues'), count: qualityStats.criticalValues },
    { href: '/sample-rejections', label: tc('sampleRejections'), count: qualityStats.sampleRejections },
    { href: '/pending-samples', label: tc('pendingSamples'), count: qualityStats.pendingSamples },
    { href: '/instruments', label: tc('instruments') },
    { href: '/quality-control', label: tc('qualityControl') },
    { href: '/tasks', label: tc('tasks'), count: stats.openTasks },
    { href: '/reports', label: tc('reports') },
  ];

  const widgetMap: Record<DashboardWidgetType, React.ReactNode> = {
    stats_critical: <StatCard key="sc" title={tc('criticalValues')} value={qualityStats.criticalValues} icon={AlertTriangle} iconClassName="bg-destructive/10 text-destructive" />,
    stats_rejections: <StatCard key="sr" title={tc('sampleRejections')} value={qualityStats.sampleRejections} icon={XCircle} iconClassName="bg-warning/10 text-warning" />,
    stats_pending: <StatCard key="sp" title={tc('pendingSamples')} value={qualityStats.pendingSamples} icon={Hourglass} iconClassName="bg-accent/10 text-accent" />,
    stats_tasks: <StatCard key="st" title={td('openTasks')} value={stats.openTasks} icon={CheckSquare} iconClassName="bg-primary/10 text-primary" />,
    tat_summary: (
      <Card key="tat" className="lg:col-span-2">
        <CardHeader><CardTitle>{td('tatIndicators')}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            {tatIndicators.map((ind) => {
              const status = getKPIStatus(ind.current, ind.target, true);
              return (
                <div key={ind.name} className="rounded-xl border border-border p-4">
                  <p className="text-sm font-medium text-muted-foreground">{ind.name}</p>
                  <p className="text-3xl font-bold mt-1">{ind.current} <span className="text-base font-normal text-muted-foreground">{ind.unit}</span></p>
                  <Badge variant={status === 'achieved' ? 'success' : status === 'at_risk' ? 'warning' : 'destructive'} className="mt-3">
                    {status === 'achieved' ? td('achieved') : status === 'at_risk' ? td('atRisk') : td('notAchieved')}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    ),
    quick_links: (
      <Card key="ql">
        <CardHeader><CardTitle>Quick Access</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-80 overflow-y-auto">
          {quickLinks.map((link) => (
            <Link key={link.href} href={`/${locale}${link.href}`} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 hover:bg-light-blue/20 hover:border-primary/20 transition-all duration-200">
              <span className="font-medium text-sm">{link.label}</span>
              <div className="flex items-center gap-2 text-muted-foreground">
                {link.count !== undefined && <span className="text-xs">{link.count}</span>}
                <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    ),
    announcements: (
      <Card key="ann">
        <CardHeader><CardTitle>Pinned Announcements</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {pinnedAnnouncements.length === 0 ? <p className="text-sm text-muted-foreground">No pinned announcements</p> : pinnedAnnouncements.map((a) => (
            <div key={a.id} className="rounded-lg border border-border p-3">
              <p className="font-medium text-sm">{a.title}</p>
              <p className="text-xs text-muted-foreground mt-1 capitalize">{a.type} · {a.priority}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    ),
    calendar: (
      <Card key="cal">
        <CardHeader><CardTitle>Upcoming Events</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {upcomingEvents.map((e) => (
            <div key={e.id} className="rounded-lg border border-border p-3">
              <p className="font-medium text-sm">{e.title}</p>
              <p className="text-xs text-muted-foreground">{new Date(e.startDate).toLocaleDateString(locale)} · {e.type.replace('_', ' ')}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    ),
    tasks_summary: (
      <Card key="tsk">
        <CardHeader><CardTitle>Task Summary</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Open</span><p className="text-xl font-bold">{stats.openTasks}</p></div>
          <div><span className="text-muted-foreground">Overdue</span><p className="text-xl font-bold text-destructive">{db.tasks.filter((t) => t.status === 'overdue').length}</p></div>
        </CardContent>
      </Card>
    ),
  };

  const statWidgets = enabledWidgets.filter((w) => w.startsWith('stats_'));
  const panelWidgets = enabledWidgets.filter((w) => !w.startsWith('stats_'));

  return (
    <>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title={td('totalSamples')} value={stats.totalSamples} icon={Activity} iconClassName="bg-primary/10 text-primary" />
        <StatCard title={td('routineSamples')} value={stats.routineSamples} icon={FlaskConical} iconClassName="bg-accent/10 text-accent" />
        <StatCard title={td('statSamples')} value={stats.statSamples} icon={Clock} iconClassName="bg-warning/10 text-warning" />
        <StatCard title={td('activeInstruments')} value={stats.activeInstruments} icon={FlaskConical} iconClassName="bg-success/10 text-success" />
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title={td('correctedResults')} value={stats.correctedResults} icon={XCircle} />
        <StatCard title={td('instrumentsUnderMaintenance')} value={stats.instrumentsUnderMaintenance} icon={FlaskConical} iconClassName="bg-warning/10 text-warning" />
        <StatCard title={td('expiringInventory')} value={stats.expiringInventory} icon={Package} iconClassName="bg-destructive/10 text-destructive" />
        <StatCard title={td('trainingCompletion')} value={`${stats.trainingCompletionRate}%`} icon={GraduationCap} iconClassName="bg-success/10 text-success" />
      </div>

      {statWidgets.length > 0 && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {statWidgets.map((w) => widgetMap[w])}
        </div>
      )}

      {qualityStats.discardDue > 0 && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="py-4 flex items-center justify-between gap-4">
            <p className="text-sm font-medium">{qualityStats.discardDue} rejected sample(s) due for discard review</p>
            <Button asChild size="sm" variant="outline"><Link href={`/${locale}/pending-samples`}>View Pending Samples</Link></Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{td('monthlyTrend')}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" /><YAxis /><Tooltip />
                <Line type="monotone" dataKey="routine" stroke={BRAND_COLORS.primary} name="Routine" strokeWidth={2} />
                <Line type="monotone" dataKey="stat" stroke={BRAND_COLORS.accent} name="STAT" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{td('sampleVolume')}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={sampleVolume}>
                <XAxis dataKey="day" /><YAxis /><Tooltip />
                <Bar dataKey="volume" fill={BRAND_COLORS.secondary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {panelWidgets.map((w) => (
          <div key={w} className={w === 'tat_summary' ? 'lg:col-span-2' : ''}>{widgetMap[w]}</div>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Our Laboratory</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images.labEquipment} alt="Lab Equipment" className="rounded-xl object-cover h-44 w-full border border-border" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images.departmentPhoto} alt="Department" className="rounded-xl object-cover h-44 w-full border border-border" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images.hematologyLab} alt="Hematology" className="rounded-xl object-cover h-44 w-full border border-border sm:col-span-2 lg:col-span-1" />
        </CardContent>
      </Card>
    </>
  );
}
