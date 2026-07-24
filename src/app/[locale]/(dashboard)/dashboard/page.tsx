'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  TestTube, Activity, Zap, AlertTriangle, XCircle, FileEdit, Hourglass,
  Microscope, Wrench, Package, GraduationCap, CheckSquare,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getMockDatabase, getDashboardStats } from '@/lib/mock/store';
import { getKPIStatus } from '@/lib/calculations/tat';

const COLORS = ['#2563eb', '#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const db = useMemo(() => getMockDatabase(), []);
  const stats = useMemo(() => getDashboardStats(db), [db]);

  const tatIndicators = useMemo(() => {
    const routine = db.tatRecords.filter((r) => r.priority === 'routine');
    const stat = db.tatRecords.filter((r) => r.priority === 'stat');
    const avgRoutine = routine.length ? routine.reduce((s, r) => s + r.calculatedTat, 0) / routine.length : 0;
    const avgStat = stat.length ? stat.reduce((s, r) => s + r.calculatedTat, 0) / stat.length : 0;
    return [
      { name: 'Routine TAT', current: Math.round(avgRoutine), target: 240, unit: 'min' },
      { name: 'STAT TAT', current: Math.round(avgStat), target: 60, unit: 'min' },
      { name: 'D-Dimer TAT', current: 55, target: 60, unit: 'min' },
      { name: 'ER TAT', current: 85, target: 90, unit: 'min' },
      { name: 'ICU TAT', current: 78, target: 90, unit: 'min' },
    ];
  }, [db]);

  const monthlyTAT = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => ({
      month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i],
      routine: 200 + (i * 12) + 10,
      stat: 45 + (i * 4) + 2,
    }));
  }, []);

  const sampleVolume = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => ({
      month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i],
      routine: 800 + i * 50,
      stat: 120 + i * 10,
    }));
  }, []);

  const rejectionReasons = useMemo(() => {
    const counts: Record<string, number> = {};
    db.sampleRejections.forEach((r) => {
      counts[r.rejectionReason] = (counts[r.rejectionReason] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [db]);

  const taskStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    db.tasks.forEach((t) => { counts[t.status] = (counts[t.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [db]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tc('dashboard')}</h1>
        <p className="text-muted-foreground">Hematology Section Overview</p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard title={t('totalSamples')} value={stats.totalSamples} icon={TestTube} iconClassName="bg-medical-blue/10 text-medical-blue" />
        <StatCard title={t('routineSamples')} value={stats.routineSamples} icon={Activity} iconClassName="bg-sky-blue/10 text-sky-blue" />
        <StatCard title={t('statSamples')} value={stats.statSamples} icon={Zap} iconClassName="bg-soft-violet/10 text-soft-violet" />
        <StatCard title={t('criticalValues')} value={stats.criticalValues} icon={AlertTriangle} iconClassName="bg-red-100 text-red-600" />
        <StatCard title={t('sampleRejections')} value={stats.sampleRejections} icon={XCircle} iconClassName="bg-amber-100 text-amber-600" />
        <StatCard title={t('correctedResults')} value={stats.correctedResults} icon={FileEdit} iconClassName="bg-orange-100 text-orange-600" />
        <StatCard title={t('pendingSamples')} value={stats.pendingSamples} icon={Hourglass} iconClassName="bg-yellow-100 text-yellow-600" />
        <StatCard title={t('activeInstruments')} value={stats.activeInstruments} icon={Microscope} iconClassName="bg-emerald-100 text-emerald-600" />
        <StatCard title={t('instrumentsUnderMaintenance')} value={stats.instrumentsUnderMaintenance} icon={Wrench} />
        <StatCard title={t('expiringInventory')} value={stats.expiringInventory} icon={Package} />
        <StatCard title={t('trainingCompletion')} value={`${stats.trainingCompletionRate}%`} icon={GraduationCap} />
        <StatCard title={t('openTasks')} value={stats.openTasks} icon={CheckSquare} />
      </div>

      <Card>
        <CardHeader><CardTitle>{t('tatIndicators')}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {tatIndicators.map((ind) => {
              const status = getKPIStatus(ind.current, ind.target, true);
              return (
                <div key={ind.name} className="rounded-lg border border-border p-4">
                  <p className="text-sm font-medium">{ind.name}</p>
                  <p className="text-2xl font-bold mt-1">{ind.current} {ind.unit}</p>
                  <p className="text-xs text-muted-foreground">Target: {ind.target} {ind.unit}</p>
                  <Badge variant={status === 'achieved' ? 'success' : status === 'at_risk' ? 'warning' : 'destructive'} className="mt-2">
                    {t(status === 'achieved' ? 'achieved' : status === 'at_risk' ? 'atRisk' : 'notAchieved')}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t('monthlyTrend')}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyTAT}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="routine" stroke="#2563eb" name="Routine" />
                <Line type="monotone" dataKey="stat" stroke="#ef4444" name="STAT" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t('sampleVolume')}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sampleVolume}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="routine" fill="#2563eb" name="Routine" />
                <Bar dataKey="stat" fill="#ef4444" name="STAT" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Rejection Reasons</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={rejectionReasons} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {rejectionReasons.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Task Status Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={taskStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {taskStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
