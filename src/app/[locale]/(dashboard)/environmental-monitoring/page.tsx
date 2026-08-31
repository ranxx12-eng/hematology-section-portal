'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Loader2, AlertTriangle, ClipboardCheck, Thermometer } from 'lucide-react';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { StatCard } from '@/components/shared/stat-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { useEnvironmentalMonitoring } from '@/hooks/use-environmental-monitoring';
import { computeEnvironmentalDashboardStats } from '@/lib/clinical/environmental-monitoring';
import { buildAssetStatusRows } from '@/lib/environmental-monitoring/compliance';
import { formatDateTime } from '@/lib/utils';
import type { EnvironmentalAssetStatusRow } from '@/types/environmental-monitoring';

function statusVariant(status: EnvironmentalAssetStatusRow['displayStatus']) {
  if (status === 'OUT OF RANGE' || status === 'MISSING') return 'destructive' as const;
  if (status === 'DUE') return 'warning' as const;
  if (status === 'IN RANGE') return 'success' as const;
  return 'secondary' as const;
}

export default function EnvironmentalMonitoringDashboardPage() {
  const locale = useLocale();
  const { assets, windows, readings, excursions, loading, error } = useEnvironmentalMonitoring();
  const stats = useMemo(
    () => computeEnvironmentalDashboardStats(assets, windows, readings, excursions),
    [assets, windows, readings, excursions],
  );
  const statusRows = useMemo(
    () => buildAssetStatusRows(assets, windows, readings),
    [assets, windows, readings],
  );

  const columns: ColumnDef<EnvironmentalAssetStatusRow>[] = [
    { accessorKey: 'asset.assetName', header: 'Asset', cell: ({ row }) => row.original.asset.assetName },
    { accessorKey: 'asset.location', header: 'Location', cell: ({ row }) => row.original.asset.location ?? '—' },
    { accessorKey: 'acceptableRangeLabel', header: 'Acceptable Range' },
    {
      id: 'lastReading',
      header: 'Last Reading',
      cell: ({ row }) => row.original.lastReading ? `${row.original.lastReading.temperature}°C` : '—',
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge variant={statusVariant(row.original.displayStatus)}>{row.original.displayStatus}</Badge>,
    },
    {
      id: 'lastChecked',
      header: 'Last Checked',
      cell: ({ row }) => row.original.lastCheckedAt ? formatDateTime(row.original.lastCheckedAt, locale) : '—',
    },
    { id: 'performedBy', header: 'Performed By', cell: ({ row }) => row.original.performedBy ?? '—' },
    { id: 'nextDue', header: 'Next/Due Window', cell: ({ row }) => row.original.nextDueWindow ?? '—' },
  ];

  return (
    <PageContentSections
      pageKey="environmental_monitoring"
      fallbackTitle="Environmental Monitoring"
      fallbackSubtitle="Daily compliance, asset status, and excursion overview"
    >
      {loading && (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      )}

      {!loading && error && <EmptyState title="Unable to load environmental monitoring" description={error} />}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Link href={`/${locale}/environmental-monitoring/monthly-logs`}>
              <StatCard title="Daily Compliance" value={`${stats.dailyCompliancePercent}%`} icon={ClipboardCheck} />
            </Link>
            <Link href={`/${locale}/environmental-monitoring/record`}>
              <StatCard title="Missing Readings" value={String(stats.missingReadings)} icon={AlertTriangle} />
            </Link>
            <Link href={`/${locale}/environmental-monitoring/excursions`}>
              <StatCard title="Excursions This Month" value={String(stats.excursionsThisMonth)} icon={Thermometer} />
            </Link>
            <Link href={`/${locale}/environmental-monitoring/excursions?status=open`}>
              <StatCard title="Open Excursions" value={String(stats.openExcursions)} icon={AlertTriangle} iconClassName="bg-destructive/10 text-destructive" />
            </Link>
          </div>

          <Card>
            <CardHeader><CardTitle>Current Status</CardTitle></CardHeader>
            <CardContent>
              <DataTable columns={columns} data={statusRows} searchKey="asset.assetName" />
            </CardContent>
          </Card>
        </>
      )}
    </PageContentSections>
  );
}
