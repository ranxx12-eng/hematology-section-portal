'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase } from '@/lib/mock/store';
import { formatDateTime } from '@/lib/utils';
import type { AuditLog } from '@/types';

export default function AuditLogPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can } = useAuth();
  const db = useMemo(() => getMockDatabase(), []);

  if (!can('audit.view')) {
    router.replace(`/${locale}/unauthorized`);
    return null;
  }

  const getUserName = (id: string) => db.employees.find((e) => e.id === id)?.fullName ?? id;

  const actionVariant = (action: string) => {
    if (action === 'delete') return 'destructive' as const;
    if (action === 'create') return 'success' as const;
    if (action === 'update') return 'warning' as const;
    return 'secondary' as const;
  };

  const columns: ColumnDef<AuditLog>[] = useMemo(() => [
    { accessorKey: 'createdAt', header: 'Timestamp', cell: ({ row }) => formatDateTime(row.original.createdAt, locale) },
    { accessorKey: 'userId', header: 'User', cell: ({ row }) => getUserName(row.original.userId) },
    { accessorKey: 'action', header: 'Action', cell: ({ row }) => <Badge variant={actionVariant(row.original.action)}>{row.original.action}</Badge> },
    { accessorKey: 'module', header: 'Module', cell: ({ row }) => <Badge variant="outline">{row.original.module}</Badge> },
    { accessorKey: 'recordId', header: 'Record ID' },
    { accessorKey: 'ipAddress', header: 'IP', cell: ({ row }) => row.original.ipAddress ?? '—' },
  ], [locale, db.employees]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tc('auditLog')}</h1>
        <p className="text-muted-foreground">Read-only system activity log ({db.auditLogs.length} entries)</p>
      </div>
      <DataTable data={db.auditLogs} columns={columns} searchKey="module" searchPlaceholder="Search by module..." />
    </div>
  );
}
