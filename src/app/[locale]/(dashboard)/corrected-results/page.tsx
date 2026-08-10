'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/components/providers/auth-provider';
import { maskPatientId } from '@/lib/page-utils';
import { formatDate } from '@/lib/utils';
import { fetchCorrectedResults } from '@/lib/clinical/corrected-results';
import { CLINICAL_WRITE_DISABLED_MESSAGE } from '@/lib/clinical/constants';
import type { CorrectedResult } from '@/types';

export default function CorrectedResultsPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can } = useAuth();
  const canManage = can('corrected_results.manage');
  const [records, setRecords] = useState<CorrectedResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ patientId: '', test: '', originalResult: '', correctedResult: '', reason: '' });

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchCorrectedResults();
    setRecords(result.data);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const accessDenied = !can('corrected_results.view');
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);
  if (accessDenied) return null;

  const notifyWriteDisabled = () => toast.info(CLINICAL_WRITE_DISABLED_MESSAGE);

  const columns: ColumnDef<CorrectedResult>[] = useMemo(() => [
    { accessorKey: 'date', header: 'Date', cell: ({ row }) => formatDate(row.original.date, locale) },
    { accessorKey: 'patientId', header: 'Patient ID', cell: ({ row }) => <span className="font-mono">{maskPatientId(row.original.patientId)}</span> },
    { accessorKey: 'test', header: 'Test' },
    { accessorKey: 'originalResult', header: 'Original' },
    { accessorKey: 'correctedResult', header: 'Corrected' },
    { accessorKey: 'reason', header: 'Reason' },
    { accessorKey: 'physicianNotified', header: 'Physician Notified', cell: ({ row }) => row.original.physicianNotified ? <Badge variant="success">Yes</Badge> : <Badge variant="warning">No</Badge> },
    { accessorKey: 'correctedBy', header: 'Corrected By', cell: ({ row }) => <span className="font-mono text-xs">{row.original.correctedBy.slice(0, 8)}…</span> },
    { accessorKey: 'approvedBy', header: 'Approved By', cell: ({ row }) => row.original.approvedBy ? <span className="font-mono text-xs">{row.original.approvedBy.slice(0, 8)}…</span> : '—' },
  ], [locale]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tc('correctedResults')}</h1>
          <p className="text-muted-foreground">{loading ? 'Loading…' : `${records.length} corrections on file`}</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={notifyWriteDisabled}><Plus className="h-4 w-4 me-2" />{tc('add')}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record Corrected Result</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">{CLINICAL_WRITE_DISABLED_MESSAGE}</p>
              <div className="space-y-3 opacity-60 pointer-events-none">
                <div><Label>Patient ID</Label><Input value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} /></div>
                <div><Label>Test</Label><Input value={form.test} onChange={(e) => setForm({ ...form, test: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Original</Label><Input value={form.originalResult} onChange={(e) => setForm({ ...form, originalResult: e.target.value })} /></div>
                  <div><Label>Corrected</Label><Input value={form.correctedResult} onChange={(e) => setForm({ ...form, correctedResult: e.target.value })} /></div>
                </div>
                <div><Label>Reason</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
                <Button disabled className="w-full">{tc('save')}</Button>
              </div>
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
        <EmptyState title="Unable to load corrected results" description={error} />
      )}

      {!loading && !error && records.length === 0 && (
        <EmptyState title="No corrected results" description="Corrected result records will appear here once recorded in Supabase." />
      )}

      {!loading && !error && records.length > 0 && (
        <DataTable data={records} columns={columns} searchKey="test" searchPlaceholder="Search corrected results..." />
      )}
    </div>
  );
}
