'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';
import { ComparisonOverallResultBadge } from '@/components/comparison-studies/comparison-status-badges';
import { DataTable } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { fetchComparisonStudies } from '@/lib/clinical/comparison-studies';
import {
  COMPARISON_STATUS_LABELS,
  COMPARISON_STUDY_TYPES,
  COMPARISON_TYPES,
} from '@/lib/comparison-studies/constants';
import {
  canCreateComparisonStudies,
  canViewComparisonStudies,
  filterStudiesByTab,
} from '@/lib/comparison-studies/permissions';
import { formatDate } from '@/lib/utils';
import type { ComparisonStudyListItem, ComparisonStudyType } from '@/types/comparison-study';

const TAB_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'drafts', label: 'Drafts' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'failed', label: 'Not Acceptable / Failed' },
  { value: 'archived', label: 'Archived' },
] as const;

function studyTypeLabel(type: ComparisonStudyType): string {
  return COMPARISON_STUDY_TYPES.find((t) => t.key === type)?.label ?? type;
}

export default function ComparisonStudiesPage() {
  const locale = useLocale();
  const router = useRouter();
  const { can } = useAuth();
  const accessDenied = !canViewComparisonStudies(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  const [loading, setLoading] = useState(true);
  const [studies, setStudies] = useState<ComparisonStudyListItem[]>([]);
  const [tab, setTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [studyTypeFilter, setStudyTypeFilter] = useState<string>('all');
  const [comparisonTypeFilter, setComparisonTypeFilter] = useState<string>('all');

  const reload = useCallback(async (query?: string) => {
    setLoading(true);
    const result = await fetchComparisonStudies(query);
    setStudies(result.data);
    setLoading(false);
    if (result.error) toast.error(result.error);
  }, []);

  useEffect(() => {
    void reload(search);
  }, [reload, search]);

  const filtered = useMemo(() => {
    let list = filterStudiesByTab(studies, tab);
    if (studyTypeFilter !== 'all') {
      list = list.filter((s) => s.studyType === studyTypeFilter);
    }
    if (comparisonTypeFilter !== 'all') {
      list = list.filter((s) => s.comparisonType === comparisonTypeFilter);
    }
    return list;
  }, [studies, tab, studyTypeFilter, comparisonTypeFilter]);

  const stats = useMemo(() => ({
    active: studies.filter((s) => !['archived', 'approved', 'rejected'].includes(s.status)).length,
    pendingReview: studies.filter((s) => s.status === 'pending_review' || s.status === 'submitted').length,
    pendingApproval: studies.filter((s) => s.status === 'pending_approval').length,
    failed: studies.filter((s) => s.overallResult === 'not_acceptable').length,
    approvedThisMonth: studies.filter((s) => {
      if (s.status !== 'approved' || !s.studyDate) return false;
      const d = new Date(s.studyDate);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length,
  }), [studies]);

  const columns: ColumnDef<ComparisonStudyListItem>[] = [
    {
      id: 'studyNumber',
      header: 'Study Number',
      cell: ({ row }) => (
        <Link href={`/${locale}/quality/comparison-studies/${row.original.id}`} className="font-medium hover:underline">
          {row.original.studyNumber}
          {row.original.versionNumber > 1 ? ` v${row.original.versionNumber}` : ''}
        </Link>
      ),
    },
    { id: 'studyType', header: 'Study Type', cell: ({ row }) => studyTypeLabel(row.original.studyType) },
    { id: 'title', header: 'Title', cell: ({ row }) => row.original.studyTitle || '—' },
    { id: 'comparisonType', header: 'Comparison Type', cell: ({ row }) => row.original.comparisonType ?? '—' },
    { id: 'reference', header: 'Reference', cell: ({ row }) => row.original.referenceLabel ?? '—' },
    { id: 'comparison', header: 'Comparison', cell: ({ row }) => row.original.comparisonLabel ?? '—' },
    {
      id: 'sections',
      header: 'Sections',
      cell: ({ row }) => row.original.sections.length ? row.original.sections.join(', ') : '—',
    },
    { id: 'samples', header: 'Samples', cell: ({ row }) => row.original.sampleCount },
    {
      id: 'overall',
      header: 'Overall Result',
      cell: ({ row }) => <ComparisonOverallResultBadge result={row.original.overallResult} />,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant="secondary">
          {COMPARISON_STATUS_LABELS[row.original.status] ?? row.original.status}
        </Badge>
      ),
    },
    { id: 'prepared', header: 'Prepared By', cell: ({ row }) => row.original.preparedByName ?? '—' },
    {
      id: 'date',
      header: 'Study Date',
      cell: ({ row }) => row.original.studyDate ? formatDate(row.original.studyDate, locale) : '—',
    },
  ];

  return (
    <PageContentSections
      pageKey="dashboard"
      fallbackTitle="Comparison Studies"
      fallbackSubtitle="Hematology comparison and verification studies"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Comparison Studies</h1>
            <p className="text-muted-foreground">Hematology comparison and verification studies</p>
          </div>
          {canCreateComparisonStudies(can) && (
            <Button onClick={() => router.push(`/${locale}/quality/comparison-studies/new`)}>
              <Plus className="h-4 w-4 mr-2" /> New Comparison Study
            </Button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['Active Studies', stats.active],
            ['Pending Review', stats.pendingReview],
            ['Pending Approval', stats.pendingApproval],
            ['Not Acceptable', stats.failed],
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
            {TAB_OPTIONS.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>{option.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Search study number, title, reference, comparison..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Select value={studyTypeFilter} onValueChange={setStudyTypeFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Study type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All study types</SelectItem>
              {COMPARISON_STUDY_TYPES.map((type) => (
                <SelectItem key={type.key} value={type.key}>{type.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={comparisonTypeFilter} onValueChange={setComparisonTypeFilter}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Comparison type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All comparison types</SelectItem>
              {COMPARISON_TYPES.map((type) => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <DataTable columns={columns} data={filtered} />
        )}
      </div>
    </PageContentSections>
  );
}
