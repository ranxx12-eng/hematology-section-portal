'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase } from '@/lib/mock/store';
import { formatDateTime, downloadCSV } from '@/lib/utils';
import type { AuditLog } from '@/types';

export default function AuditLogPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can } = useAuth();
  const db = useMemo(() => getMockDatabase(), []);
  const [moduleFilter, setModuleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');

  if (!can('audit.view')) {
    router.replace(`/${locale}/unauthorized`);
    return null;
  }

  const modules = useMemo(() => [...new Set(db.auditLogs.map((l) => l.module))], [db.auditLogs]);
  const actions = useMemo(() => [...new Set(db.auditLogs.map((l) => l.action))], [db.auditLogs]);

  const filtered = useMemo(() => db.auditLogs.filter((l) => {
    const matchModule = moduleFilter === 'all' || l.module === moduleFilter;
    const matchAction = actionFilter === 'all' || l.action === actionFilter;
    return matchModule && matchAction;
  }), [db.auditLogs, moduleFilter, actionFilter]);

  const getUserName = (id: string) => db.employees.find((e) => e.id === id)?.fullName ?? id;

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
  ], [locale, db.employees]);

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
          <SelectTrigger className="w-48"><SelectValue placeholder="Module" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            {modules.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable data={filtered} columns={columns} searchKey="module" searchPlaceholder="Search audit log..." />
    </div>
  );
}
