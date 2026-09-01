'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '@/components/providers/auth-provider';
import { CvResultStatusBadge } from '@/components/cv-monitoring/cv-status-badges';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { fetchCvTrendData } from '@/lib/clinical/cv-monitoring';
import { fetchInstruments } from '@/lib/clinical/instruments';
import { analytePrintCode, monthAbbreviation } from '@/lib/cv-monitoring/constants';
import { roundForDisplay } from '@/lib/cv-monitoring/calculation';
import { canExportCvMonitoring, canViewCvMonitoring } from '@/lib/cv-monitoring/permissions';
import { downloadCSV } from '@/lib/utils';
import type { Instrument } from '@/types';
import type { CvTrendDataPoint } from '@/types/cv-monitoring';

export default function CvMonitoringTrendsPage() {
  const locale = useLocale();
  const { can } = useAuth();
  const accessDenied = !canViewCvMonitoring(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<CvTrendDataPoint[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [instrumentId, setInstrumentId] = useState('all');
  const [analyteCode, setAnalyteCode] = useState('all');
  const [qcLevel, setQcLevel] = useState('all');

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await fetchCvTrendData({
      instrumentId: instrumentId === 'all' ? undefined : instrumentId,
      analyteCode: analyteCode === 'all' ? undefined : analyteCode,
      qcLevel: qcLevel === 'all' ? undefined : qcLevel,
    });
    setPoints(result.data);
    setLoading(false);
    if (result.error) toast.error(result.error);
  }, [instrumentId, analyteCode, qcLevel]);

  useEffect(() => {
    void fetchInstruments().then((res) => { if (res.data) setInstruments(res.data); });
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const chartData = useMemo(() => {
    const map = new Map<string, { label: string; cv?: number; limit?: number }>();
    for (const p of points) {
      const label = `${monthAbbreviation(p.month)} ${p.year}`;
      map.set(label, {
        label,
        cv: p.cvPercent != null ? roundForDisplay(p.cvPercent, 2) : undefined,
        limit: p.cvLimitSnapshot != null ? roundForDisplay(p.cvLimitSnapshot, 3) : undefined,
      });
    }
    return [...map.values()];
  }, [points]);

  const exportTrend = () => {
    if (!canExportCvMonitoring(can)) return;
    downloadCSV('cv-trend-data.csv',
      ['Month', 'Year', 'Instrument', 'Level', 'Analyte', 'Mean', 'SD', 'CV %', 'CV Limit', 'Status'],
      points.map((p) => [
        String(p.month), String(p.year), p.instrumentName, p.qcLevel, analytePrintCode(p.analyteCode),
        p.mean != null ? String(p.mean) : '', p.sd != null ? String(p.sd) : '',
        p.cvPercent != null ? String(roundForDisplay(p.cvPercent, 2)) : '',
        p.cvLimitSnapshot != null ? String(p.cvLimitSnapshot) : '', p.status,
      ]),
    );
  };

  return (
    <PageContentSections pageKey="dashboard" fallbackTitle="CV Monitoring Trends">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/${locale}/quality/cv-monitoring`}><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">CV Trends</h1>
              <p className="text-muted-foreground">Long-term CV monitoring from approved records</p>
            </div>
          </div>
          {canExportCvMonitoring(can) && <Button variant="outline" onClick={exportTrend}>Export Trend Data</Button>}
        </div>

        <div className="flex flex-wrap gap-3">
          <Select value={instrumentId} onValueChange={setInstrumentId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Instrument" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All instruments</SelectItem>
              {instruments.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={analyteCode} onValueChange={setAnalyteCode}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Analyte" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All analytes</SelectItem>
              {['PT', 'PTT', 'FIB', 'DD'].map((c) => <SelectItem key={c} value={c}>{analytePrintCode(c)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={qcLevel} onValueChange={setQcLevel}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Level" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              <SelectItem value="N">Level N</SelectItem>
              <SelectItem value="P">Level P</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader><CardTitle>CV % Trend</CardTitle></CardHeader>
          <CardContent className="h-80">
            {loading ? (
              <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">No approved trend data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="cv" name="CV %" stroke="#5B3FD6" strokeWidth={2} />
                  <Line type="monotone" dataKey="limit" name="CV Limit" stroke="#ef4444" strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Trend Table</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  {['Month', 'Year', 'Instrument', 'Level', 'Analyte', 'Mean', 'SD', 'CV %', 'CV Limit', 'Status'].map((h) => (
                    <th key={h} className="p-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={`${p.recordId}-${p.analyteCode}-${p.qcLevel}`} className="border-b">
                    <td className="p-2">{monthAbbreviation(p.month)}</td>
                    <td className="p-2">{p.year}</td>
                    <td className="p-2">{p.instrumentName}</td>
                    <td className="p-2">{p.qcLevel}</td>
                    <td className="p-2">{analytePrintCode(p.analyteCode)}</td>
                    <td className="p-2">{p.mean ?? '—'}</td>
                    <td className="p-2">{p.sd ?? '—'}</td>
                    <td className="p-2">{p.cvPercent != null ? `${roundForDisplay(p.cvPercent, 2)}%` : 'N/A'}</td>
                    <td className="p-2">{p.cvLimitSnapshot ?? '—'}%</td>
                    <td className="p-2"><CvResultStatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </PageContentSections>
  );
}
