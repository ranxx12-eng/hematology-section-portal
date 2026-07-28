'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, XCircle, Hourglass, Clock, ArrowRight } from 'lucide-react';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getMockDatabase } from '@/lib/mock/store';
import { getKPIStatus } from '@/lib/calculations/tat';

export default function DashboardPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const db = useMemo(() => getMockDatabase(), []);
  const images = db.portalContent.dashboardImages;
  const settings = db.settings;

  const stats = useMemo(() => ({
    criticalValues: db.criticalValues.length,
    sampleRejections: db.sampleRejections.length,
    pendingSamples: db.pendingSamples.filter((p) => p.isActive).length,
    awaitingReplacement: db.sampleRejections.filter((r) => r.replacementSampleStatus === 'Awaiting Replacement Sample').length,
    discardDue: db.sampleRejections.filter((r) => r.discardStatus === 'discard_due').length,
  }), [db]);

  const tatIndicators = useMemo(() => {
    const routine = db.tatRecords.filter((r) => r.priority === 'routine');
    const stat = db.tatRecords.filter((r) => r.priority === 'stat');
    const avgRoutine = routine.length ? routine.reduce((s, r) => s + r.calculatedTat, 0) / routine.length : 0;
    const avgStat = stat.length ? stat.reduce((s, r) => s + r.calculatedTat, 0) / stat.length : 0;
    return [
      { name: 'Routine TAT', current: Math.round(avgRoutine), target: settings.tatTargets.routine, unit: 'min' },
      { name: 'STAT TAT', current: Math.round(avgStat), target: settings.tatTargets.stat, unit: 'min' },
    ];
  }, [db, settings.tatTargets]);

  const quickLinks = [
    { href: '/critical-values', label: tc('criticalValues'), count: stats.criticalValues },
    { href: '/sample-rejections', label: tc('sampleRejections'), count: stats.sampleRejections },
    { href: '/pending-samples', label: tc('pendingSamples'), count: stats.pendingSamples },
    { href: '/reports', label: tc('reports') },
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-border brand-gradient text-white shadow-lg">
        <div className="grid lg:grid-cols-2 gap-6 p-6 md:p-8">
          <div className="space-y-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images.hospitalLogo} alt="Hospital Logo" className="h-16 w-16 rounded-xl bg-white/10 p-2 object-contain" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">{settings.laboratoryName}</h1>
              <p className="text-lg text-white/90 mt-1">{settings.sectionName}</p>
              <p className="text-sm text-white/70 mt-2">Hematology Section Portal</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/15 text-white border-0">Coagulation</Badge>
              <Badge className="bg-white/15 text-white border-0">Hemostasis</Badge>
              <Badge className="bg-white/15 text-white border-0">Cellular Hematology</Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images.hospitalBuilding} alt="Hospital" className="rounded-xl object-cover h-36 w-full border border-white/20" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images.hematologyLab} alt="Hematology Lab" className="rounded-xl object-cover h-36 w-full border border-white/20" />
          </div>
        </div>
      </section>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title={tc('criticalValues')} value={stats.criticalValues} icon={AlertTriangle} iconClassName="bg-destructive/10 text-destructive" />
        <StatCard title={tc('sampleRejections')} value={stats.sampleRejections} icon={XCircle} iconClassName="bg-warning/10 text-warning" />
        <StatCard title={tc('pendingSamples')} value={stats.pendingSamples} icon={Hourglass} iconClassName="bg-accent/10 text-accent" />
        <StatCard title="Awaiting Replacement" value={stats.awaitingReplacement} icon={Clock} iconClassName="bg-primary/10 text-primary" />
      </div>

      {stats.discardDue > 0 && (
        <Card className="border-warning bg-warning/5 dark:bg-warning/10">
          <CardContent className="py-4 flex items-center justify-between gap-4">
            <p className="text-sm font-medium">{stats.discardDue} rejected sample(s) due for discard review</p>
            <Button asChild size="sm" variant="outline">
              <Link href={`/${locale}/pending-samples`}>View Pending Samples</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>TAT Performance</CardTitle></CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4">
              {tatIndicators.map((ind) => {
                const status = getKPIStatus(ind.current, ind.target, true);
                return (
                  <div key={ind.name} className="rounded-xl border border-border p-4">
                    <p className="text-sm font-medium text-muted-foreground">{ind.name}</p>
                    <p className="text-3xl font-bold mt-1">{ind.current} <span className="text-base font-normal text-muted-foreground">{ind.unit}</span></p>
                    <p className="text-xs text-muted-foreground mt-1">Target: {ind.target} {ind.unit}</p>
                    <Badge variant={status === 'achieved' ? 'success' : status === 'at_risk' ? 'warning' : 'destructive'} className="mt-3">
                      {status === 'achieved' ? 'Achieved' : status === 'at_risk' ? 'At Risk' : 'Not Achieved'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Quick Access</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={`/${locale}${link.href}`}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3 hover:bg-light-blue/20 hover:border-primary/20 transition-all duration-200"
              >
                <span className="font-medium text-sm">{link.label}</span>
                <div className="flex items-center gap-2 text-muted-foreground">
                  {link.count !== undefined && <span className="text-xs">{link.count}</span>}
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
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
    </div>
  );
}
