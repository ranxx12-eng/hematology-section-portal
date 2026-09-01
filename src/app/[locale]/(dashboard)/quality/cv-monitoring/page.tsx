'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Loader2, Plus, Settings, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';
import { CvOverallStatusBadge } from '@/components/cv-monitoring/cv-status-badges';
import { DataTable } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { fetchCvMonitoringRecords } from '@/lib/clinical/cv-monitoring';
import { CV_STATUS_LABELS, monthName } from '@/lib/cv-monitoring/constants';
import {
  canCreateCvMonitoring,
  canManageCvDefinitions,
  canViewCvMonitoring,
  filterCvRecordsByTab,
} from '@/lib/cv-monitoring/permissions';
import type { CvMonitoringListItem } from '@/types/cv-monitoring';

const TAB_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'high_cv', label: 'High CV' },
  { value: 'archived', label: 'Archived' },
] as const;

export default function CvMonitoringPage() {
  const locale = useLocale();
  const router = useRouter();
  const { can } = useAuth();
  const accessDenied = !canViewCvMonitoring(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<CvMonitoringListItem[]>([]);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');

  const reload = useCallback(async (query?: string) => {
    setLoading(true);
    const result = await fetchCvMonitoringRecords(query);
    setRecords(result.data);
    setLoading(false);
    if (result.error) toast.error(result.error);
  }, []);

  useEffect(() => { void reload(search); }, [reload, search]);

  const filtered = useMemo(() => filterCvRecordsByTab(records, tab), [records, tab]);

  const stats = useMemo(() => {
    const now = new Date();
    return {
      currentMonth: records.filter((r) => r.currentMonth === now.getMonth() + 1 && r.currentYear === now.getFullYear()).length,
      pendingReview: records.filter((r) => r.status === 'pending_review').length,
      pendingApproval: records.filter((r) => r.status === 'pending_approval').length,
      highCv: records.filter((r) => r.overallStatus === 'high_cv_detected').length,
      approvedThisMonth: records.filter((r) => r.status === 'approved' && r.currentMonth === now.getMonth() + 1 && r.currentYear === now.getFullYear()).length,
    };
  }, [records]);

  const columns: ColumnDef<CvMonitoringListItem>[] = [
    {
      id: 'number',
      header: 'Monitoring #',
      cell: ({ row }) => (
        <Link href={`/${locale}/quality/cv-monitoring/${row.original.id}`} className="font-medium hover:underline">
          {row.original.monitoringNumber}
        </Link>
      ),
    },
    {
      id: 'period',
      header: 'Month / Year',
      cell: ({ row }) => `${monthName(row.original.currentMonth)} ${row.original.currentYear}`,
    },
    { id: 'instrument', header: 'Instrument', cell: ({ row }) => row.original.instrumentName },
    { id: 'levels', header: 'Levels', cell: ({ row }) => row.original.levels.join(', ') },
    { id: 'highCv', header: 'High CV', cell: ({ row }) => row.original.highCvCount },
    {
      id: 'overall',
      header: 'Overall Status',
      cell: ({ row }) => <CvOverallStatusBadge status={row.original.overallStatus} />,
    },
    {
      id: 'status',
      header: 'Workflow',
      cell: ({ row }) => <Badge variant="secondary">{CV_STATUS_LABELS[row.original.status] ?? row.original.status}</Badge>,
    },
    { id: 'prepared', header: 'Prepared By', cell: ({ row }) => row.original.preparedByName ?? '—' },
  ];

  return (
    <PageContentSections pageKey="dashboard" fallbackTitle="CV Monitoring" fallbackSubtitle="Form-Hema-015 Monthly CV Comparison">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">CV Monitoring</h1>
            <p className="text-muted-foreground">Form-Hema-015 · HMG/SAH/QID/9167</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => router.push(`/${locale}/quality/cv-monitoring/trends`)}>
              <TrendingUp className="h-4 w-4 mr-2" /> Trends
            </Button>
            {canManageCvDefinitions(can) && (
              <Button variant="outline" onClick={() => router.push(`/${locale}/quality/cv-monitoring/settings`)}>
                <Settings className="h-4 w-4 mr-2" /> Settings
              </Button>
            )}
            {canCreateCvMonitoring(can) && (
              <Button onClick={() => router.push(`/${locale}/quality/cv-monitoring/new`)}>
                <Plus className="h-4 w-4 mr-2" /> New Monthly CV Comparison
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['Current Month Records', stats.currentMonth],
            ['Pending Review', stats.pendingReview],
            ['Pending Approval', stats.pendingApproval],
            ['High CV', stats.highCv],
            ['Approved This Month', stats.approvedThisMonth],
          ].map(([label, value]) => (
            <Card key={label as string}>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{label as string}</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{value as number}</div></CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto">
            {TAB_OPTIONS.map((o) => <TabsTrigger key={o.value} value={o.value}>{o.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>

        <Input placeholder="Search monitoring number, instrument..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <DataTable columns={columns} data={filtered} />
        )}
      </div>
    </PageContentSections>
  );
}
