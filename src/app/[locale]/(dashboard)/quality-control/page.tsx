'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { BRAND_COLORS } from '@/lib/brand/colors';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { statusBadgeVariant } from '@/lib/page-utils';
import { formatDateTime } from '@/lib/utils';
import { fetchInstrumentNameMap, fetchQCRecords } from '@/lib/clinical/qc-records';
import { CLINICAL_WRITE_DISABLED_MESSAGE } from '@/lib/clinical/constants';
import type { QCRecord } from '@/types';

export default function QualityControlPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can } = useAuth();
  const canManage = can('qc.manage');
  const [records, setRecords] = useState<QCRecord[]>([]);
  const [instrumentNames, setInstrumentNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTest, setSelectedTest] = useState('CBC');
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [qcResult, names] = await Promise.all([fetchQCRecords(), fetchInstrumentNameMap()]);
    setRecords(qcResult.data);
    setInstrumentNames(names);
    setError(qcResult.error);
    if (qcResult.data.length > 0) {
      setSelectedTest((current) => (
        qcResult.data.some((r) => r.test === current) ? current : qcResult.data[0].test
      ));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const accessDenied = !can('qc.view');
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);
  if (accessDenied) return null;

  const tests = useMemo(() => [...new Set(records.map((r) => r.test))], [records]);

  const chartData = useMemo(() => {
    return records
      .filter((r) => r.test === selectedTest)
      .slice(0, 20)
      .reverse()
      .map((r, i) => ({
        index: i + 1,
        result: r.result,
        mean: r.mean,
        plus2sd: r.mean + 2 * r.standardDeviation,
        minus2sd: r.mean - 2 * r.standardDeviation,
      }));
  }, [records, selectedTest]);

  const getInstrumentName = (id: string) => instrumentNames[id] ?? id;

  const notifyWriteDisabled = () => toast.info(CLINICAL_WRITE_DISABLED_MESSAGE);

  const columns: ColumnDef<QCRecord>[] = useMemo(() => [
    { accessorKey: 'test', header: 'Test' },
    { accessorKey: 'instrumentId', header: 'Instrument', cell: ({ row }) => getInstrumentName(row.original.instrumentId) },
    { accessorKey: 'controlLevel', header: 'Level' },
    { accessorKey: 'result', header: 'Result', cell: ({ row }) => row.original.result.toFixed(2) },
    { accessorKey: 'cvPercent', header: 'CV%', cell: ({ row }) => `${row.original.cvPercent}%` },
    { accessorKey: 'recordedAt', header: 'Recorded', cell: ({ row }) => formatDateTime(row.original.recordedAt, locale) },
    { accessorKey: 'status', header: tc('status'), cell: ({ row }) => <Badge variant={statusBadgeVariant(row.original.status)}>{row.original.status}</Badge> },
  ], [instrumentNames, locale, tc]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tc('qualityControl')}</h1>
          <p className="text-muted-foreground">{loading ? 'Loading…' : `${records.length} QC records`}</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={notifyWriteDisabled}><Plus className="h-4 w-4 me-2" />{tc('add')}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{tc('add')} QC Record</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">{CLINICAL_WRITE_DISABLED_MESSAGE}</p>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {canManage && (
        <p className="text-sm text-muted-foreground rounded-md border border-border bg-muted/40 px-4 py-3">
          {CLINICAL_WRITE_DISABLED_MESSAGE}
        </p>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin me-2" />
          {tc('loading')}
        </div>
      )}

      {!loading && error && (
        <EmptyState title="Unable to load QC records" description={error} />
      )}

      {!loading && !error && records.length === 0 && (
        <EmptyState
          title="No QC records yet"
          description="Quality control records will appear here once entered in Supabase. Levey-Jennings charts and record management will populate automatically."
        />
      )}

      {!loading && !error && records.length > 0 && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Levey-Jennings Chart — {selectedTest}</CardTitle>
              <Select value={selectedTest} onValueChange={setSelectedTest}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>{tests.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No chart data for {selectedTest}.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="index" label={{ value: 'Run', position: 'insideBottom', offset: -5 }} />
                    <YAxis domain={['auto', 'auto']} />
                    <Tooltip />
                    <Legend />
                    <ReferenceLine y={chartData[0]?.mean} stroke={BRAND_COLORS.primary} strokeDasharray="5 5" label="Mean" />
                    <Line type="monotone" dataKey="plus2sd" stroke={BRAND_COLORS.warning} dot={false} name="+2SD" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="minus2sd" stroke={BRAND_COLORS.warning} dot={false} name="-2SD" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="result" stroke={BRAND_COLORS.accent} name="Result" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <DataTable data={records} columns={columns} searchKey="test" searchPlaceholder="Search QC records..." />
        </>
      )}
    </div>
  );
}
