'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { RestoreRecordDialog } from '@/components/records/system-admin-delete-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import {
  fetchDeletedOperationalRecords,
  restoreOperationalRecord,
} from '@/lib/records/restore';
import {
  OPERATIONAL_RECORD_MODULES,
  type DeletedOperationalRecord,
  type OperationalRecordModule,
} from '@/lib/records/registry';
import { formatDateTime } from '@/lib/utils';

export default function DeletedRecordsPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can, user } = useAuth();
  const searchParams = useSearchParams();
  const moduleParam = searchParams.get('module') as OperationalRecordModule | null;

  const [records, setRecords] = useState<DeletedOperationalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState<string>(moduleParam ?? 'all');
  const [deletedByFilter, setDeletedByFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [restoreTarget, setRestoreTarget] = useState<DeletedOperationalRecord | null>(null);
  const [restoring, setRestoring] = useState(false);

  const accessDenied = !can('records.restore');

  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchDeletedOperationalRecords();
    setRecords(result.data);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!accessDenied) void loadRecords();
  }, [accessDenied, loadRecords]);

  useEffect(() => {
    if (moduleParam) setModuleFilter(moduleParam);
  }, [moduleParam]);

  const filtered = useMemo(() => records.filter((record) => {
    if (moduleFilter !== 'all' && record.module !== moduleFilter) return false;
    if (deletedByFilter.trim()) {
      const q = deletedByFilter.trim().toLowerCase();
      const byName = record.deletedByName?.toLowerCase() ?? '';
      const byStaff = record.deletedByStaffId?.toLowerCase() ?? '';
      if (!byName.includes(q) && !byStaff.includes(q)) return false;
    }
    if (dateFrom && record.deletedAt.slice(0, 10) < dateFrom) return false;
    if (dateTo && record.deletedAt.slice(0, 10) > dateTo) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const haystack = [
        record.summary,
        record.patientReference,
        record.moduleLabel,
        record.deleteReason ?? '',
      ].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  }), [records, moduleFilter, deletedByFilter, dateFrom, dateTo, search]);

  const handleRestore = async () => {
    if (!restoreTarget || !user) return;
    setRestoring(true);
    const staff = await resolveStaffContext(user);
    const result = await restoreOperationalRecord(restoreTarget.module, restoreTarget.id, staff);
    setRestoring(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Record restored');
    setRestoreTarget(null);
    await loadRecords();
  };

  const columns: ColumnDef<DeletedOperationalRecord>[] = useMemo(() => [
    { accessorKey: 'moduleLabel', header: 'Module' },
    { accessorKey: 'summary', header: 'Record' },
    { accessorKey: 'patientReference', header: 'Patient / Reference' },
    { accessorKey: 'deletedByName', header: 'Deleted By', cell: ({ row }) => row.original.deletedByName ?? '—' },
    { accessorKey: 'deletedByStaffId', header: 'Deleted By Staff ID', cell: ({ row }) => row.original.deletedByStaffId ?? '—' },
    {
      accessorKey: 'deletedAt',
      header: 'Deleted At',
      cell: ({ row }) => formatDateTime(row.original.deletedAt, locale),
    },
    {
      accessorKey: 'deleteReason',
      header: 'Delete Reason',
      cell: ({ row }) => row.original.deleteReason ?? '—',
    },
    {
      accessorKey: 'createdAt',
      header: 'Original Created At',
      cell: ({ row }) => formatDateTime(row.original.createdAt, locale),
    },
    {
      id: 'restore',
      header: 'Restore',
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setRestoreTarget(row.original)}
        >
          <RotateCcw className="h-4 w-4 me-1" />
          Restore
        </Button>
      ),
    },
  ], [locale]);

  if (accessDenied) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deleted Records</h1>
        <p className="text-muted-foreground">Review and restore soft-deleted operational records.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <Label>Module</Label>
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modules</SelectItem>
              {OPERATIONAL_RECORD_MODULES.map((m) => (
                <SelectItem key={m.module} value={m.module}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Deleted By</Label>
          <Input
            value={deletedByFilter}
            onChange={(e) => setDeletedByFilter(e.target.value)}
            placeholder="Name or staff ID"
          />
        </div>
        <div>
          <Label>Deleted From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <Label>Deleted To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div>
          <Label>Search</Label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Summary, patient, reason..."
          />
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin me-2" />
          {tc('loading')}
        </div>
      )}

      {!loading && error && (
        <EmptyState title="Unable to load deleted records" description={error} />
      )}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          title="No deleted records"
          description={records.length === 0
            ? 'Soft-deleted operational records will appear here.'
            : 'Adjust filters to find deleted records.'}
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <DataTable
          data={filtered}
          columns={columns}
          searchKey="summary"
          searchPlaceholder="Search deleted records..."
        />
      )}

      <RestoreRecordDialog
        open={Boolean(restoreTarget)}
        onOpenChange={(open) => { if (!open) setRestoreTarget(null); }}
        summary={restoreTarget
          ? `${restoreTarget.moduleLabel}: ${restoreTarget.summary}`
          : ''}
        onConfirm={handleRestore}
        saving={restoring}
      />
    </div>
  );
}
