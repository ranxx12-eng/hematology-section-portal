'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { fetchAuditLogs } from '@/lib/clinical/audit-logs';
import { fetchProfileNameMap } from '@/lib/clinical/employees';
import { formatDateTime, downloadCSV } from '@/lib/utils';
import type { AuditLog } from '@/types';

export default function AuditLogPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [logsResult, names] = await Promise.all([
      fetchAuditLogs(),
      fetchProfileNameMap(),
    ]);
    setLogs(logsResult.data);
    setUserNames(names);
    setError(logsResult.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const accessDenied = !can('audit.view');

  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  if (accessDenied) return null;

  const modules = useMemo(() => [...new Set(logs.map((l) => l.module))], [logs]);
  const actions = useMemo(() => [...new Set(logs.map((l) => l.action))], [logs]);

  const filtered = useMemo(() => logs.filter((l) => {
    const matchModule = moduleFilter === 'all' || l.module === moduleFilter;
    const matchAction = actionFilter === 'all' || l.action === actionFilter;
    return matchModule && matchAction;
  }), [logs, moduleFilter, actionFilter]);

  const getUserName = (id: string) => userNames[id] ?? id;

  const actionVariant = (action: string) => {
    if (action === 'delete') return 'destructive' as const;
    if (action === 'create') return 'success' as const;
    if (action === 'update' || action === 'export' || action === 'print') return 'warning' as const;
    if (action === 'login' || action === 'logout') return 'secondary' as const;
    return 'outline' as const;
  };

  const exportLog = () => {
    downloadCSV('audit-log.csv', ['Timestamp', 'User', 'Action', 'Module', 'Record ID'], filtered.map((l) => [
      l.createdAt, getUserName(l.userId), l.action, l.module, l.recordId ?? '',
    ]));
    toast.success('Audit log exported');
  };

  const columns: ColumnDef<AuditLog>[] = useMemo(() => [
    { accessorKey: 'createdAt', header: 'Timestamp', cell: ({ row }) => formatDateTime(row.original.createdAt, locale) },
    { accessorKey: 'userId', header: 'User', cell: ({ row }) => getUserName(row.original.userId) },
    { accessorKey: 'action', header: 'Action', cell: ({ row }) => <Badge variant={actionVariant(row.original.action)}>{row.original.action}</Badge> },
    { accessorKey: 'module', header: 'Module', cell: ({ row }) => <Badge variant="outline">{row.original.module}</Badge> },
    { accessorKey: 'recordId', header: 'Record ID', cell: ({ row }) => row.original.recordId ?? '—' },
    { accessorKey: 'ipAddress', header: 'IP', cell: ({ row }) => row.original.ipAddress ?? '—' },
  ], [locale, userNames]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Audit Center</h1>
          <p className="text-muted-foreground">Centralized activity tracking — login, CRUD, exports, and user actions</p>
        </div>
        <Button variant="outline" onClick={exportLog}><Download className="h-4 w-4 me-2" />Export</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Module" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            {modules.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <EmptyState title="Failed to load audit logs" description={error} />
      ) : filtered.length === 0 ? (
        <EmptyState title={tc('noData')} description="No audit log entries match your filters." />
      ) : (
        <DataTable data={filtered} columns={columns} searchKey="module" searchPlaceholder="Search audit log..." />
      )}
    </div>
  );
}
