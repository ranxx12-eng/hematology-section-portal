'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { StatCard } from '@/components/shared/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { statusBadgeVariant } from '@/lib/page-utils';
import { formatDateTime } from '@/lib/utils';
import { fetchTATRecords } from '@/lib/clinical/tat-records';
import { CLINICAL_WRITE_DISABLED_MESSAGE } from '@/lib/clinical/constants';
import { Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import type { TATRecord } from '@/types';

export default function TATPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can } = useAuth();
  const canManage = can('tat.manage');
  const [records, setRecords] = useState<TATRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchTATRecords();
    setRecords(result.data);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const accessDenied = !can('tat.view');
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);
  if (accessDenied) return null;

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return records;
    return records.filter((r) => r.status === statusFilter);
  }, [records, statusFilter]);

  const stats = useMemo(() => ({
    within: records.filter((r) => r.status === 'within_target').length,
    near: records.filter((r) => r.status === 'near_breach').length,
    breached: records.filter((r) => r.status === 'breached').length,
  }), [records]);

  const notifyWriteDisabled = () => toast.info(CLINICAL_WRITE_DISABLED_MESSAGE);

  const columns: ColumnDef<TATRecord>[] = useMemo(() => [
    { accessorKey: 'testType', header: 'Test' },
    { accessorKey: 'priority', header: 'Priority', cell: ({ row }) => <Badge variant={row.original.priority === 'stat' ? 'destructive' : 'secondary'}>{row.original.priority}</Badge> },
    { accessorKey: 'department', header: 'Department' },
    { accessorKey: 'calculatedTat', header: 'TAT (min)' },
    { accessorKey: 'targetTat', header: 'Target (min)' },
    { accessorKey: 'status', header: tc('status'), cell: ({ row }) => <Badge variant={statusBadgeVariant(row.original.status)}>{row.original.status.replace('_', ' ')}</Badge> },
    { accessorKey: 'sampleReceivedTime', header: 'Received', cell: ({ row }) => formatDateTime(row.original.sampleReceivedTime, locale) },
  ], [locale, tc]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tc('tat')}</h1>
          <p className="text-muted-foreground">Turnaround time monitoring</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={notifyWriteDisabled}><Plus className="h-4 w-4 me-2" />{tc('add')}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{tc('add')} TAT Record</DialogTitle></DialogHeader>
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

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Within Target" value={loading ? '—' : stats.within} icon={CheckCircle} iconClassName="bg-emerald-100 text-emerald-600" />
        <StatCard title="Near Breach" value={loading ? '—' : stats.near} icon={AlertTriangle} iconClassName="bg-amber-100 text-amber-600" />
        <StatCard title="Breached" value={loading ? '—' : stats.breached} icon={Clock} iconClassName="bg-red-100 text-red-600" />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin me-2" />
          {tc('loading')}
        </div>
      )}

      {!loading && error && (
        <EmptyState title="Unable to load TAT records" description={error} />
      )}

      {!loading && !error && records.length === 0 && (
        <EmptyState
          title="No TAT records yet"
          description="Turnaround time metrics will appear here once TAT records are available in Supabase."
        />
      )}

      {!loading && !error && records.length > 0 && (
        <>
          <div className="flex gap-3 items-center">
            <Label>{tc('filter')}:</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="within_target">Within Target</SelectItem>
                <SelectItem value="near_breach">Near Breach</SelectItem>
                <SelectItem value="breached">Breached</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DataTable data={filtered} columns={columns} searchKey="testType" searchPlaceholder="Search TAT records..." />
        </>
      )}
    </div>
  );
}
