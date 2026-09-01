'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';
import { DataTable } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { useRouteReplace } from '@/hooks/use-route-replace';
import {
  createBodyFluidWorksheetDraft,
  fetchBodyFluidWorksheets,
} from '@/lib/clinical/body-fluid-worksheets';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import { getMedicalReportSection } from '@/lib/medical-reports/constants';
import { SPECIMEN_TYPE_LABELS, formatCellsPerMm3 } from '@/lib/medical-reports/body-fluid-logic';
import {
  canCreateMedicalReports,
  canViewMedicalReports,
} from '@/lib/medical-reports/permissions';
import { formatDate, formatDateTime } from '@/lib/utils';
import type { BodyFluidWorksheetListItem } from '@/types/body-fluid-worksheet';

function BodyFluidListContent() {
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const section = getMedicalReportSection('body-fluid');
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<BodyFluidWorksheetListItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  const reload = useCallback(async (query?: string) => {
    setLoading(true);
    const result = await fetchBodyFluidWorksheets(query);
    setRecords(result.data);
    setLoading(false);
    if (result.error) toast.error(result.error);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const startNew = async () => {
    if (!user) return;
    setCreating(true);
    const staff = await resolveStaffContext(user);
    const result = await createBodyFluidWorksheetDraft(staff);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to create worksheet');
      setCreating(false);
      return;
    }
    router.push(`/${locale}/medical-reports/body-fluid/${result.data.id}`);
  };

  const columns: ColumnDef<BodyFluidWorksheetListItem>[] = [
    {
      id: 'patient',
      header: 'Patient / Label',
      cell: ({ row }) => (
        <Link
          href={`/${locale}/medical-reports/body-fluid/${row.original.id}`}
          className="font-medium hover:underline"
        >
          {row.original.patientLabelReference || 'Untitled worksheet'}
        </Link>
      ),
    },
    {
      id: 'specimen',
      header: 'Specimen',
      cell: ({ row }) => (
        row.original.specimenType ? SPECIMEN_TYPE_LABELS[row.original.specimenType] ?? row.original.specimenType : '—'
      ),
    },
    {
      id: 'received',
      header: 'Time Received',
      cell: ({ row }) => (
        row.original.timeReceived ? formatDateTime(row.original.timeReceived, locale) : '—'
      ),
    },
    {
      id: 'tech',
      header: 'Primary Tech',
      cell: ({ row }) => row.original.primaryTechName,
    },
    {
      id: 'wbc',
      header: 'Final WBC',
      cell: ({ row }) => formatCellsPerMm3(row.original.finalWbc),
    },
    {
      id: 'rbc',
      header: 'Final RBC',
      cell: ({ row }) => formatCellsPerMm3(row.original.finalRbc),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'submitted' ? 'default' : 'secondary'}>
          {row.original.status === 'submitted' ? 'Submitted' : 'Draft'}
        </Badge>
      ),
    },
    {
      id: 'submitted',
      header: 'Submitted',
      cell: ({ row }) => (
        row.original.submittedAt ? formatDate(row.original.submittedAt, locale) : '—'
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{section?.title ?? 'Body Fluid Reports'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {section?.description}
          </p>
          <div className="flex flex-wrap gap-2">
            {canCreateMedicalReports(can) && (
              <Button onClick={() => void startNew()} disabled={creating}>
                <Plus className="h-4 w-4 me-2" />
                {creating ? 'Creating…' : section?.newActionLabel ?? 'New Body Fluid Worksheet'}
              </Button>
            )}
          </div>
          {section?.showSearch && (
            <div className="flex max-w-md gap-2">
              <Input
                placeholder="Search by patient / label reference"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <Button variant="outline" onClick={() => void reload(search)}>Search</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <DataTable columns={columns} data={records} searchKey="patientLabelReference" />
    </div>
  );
}

export default function BodyFluidReportsPage() {
  const locale = useLocale();
  const { can } = useAuth();
  const section = getMedicalReportSection('body-fluid');
  const accessDenied = !canViewMedicalReports(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);
  if (accessDenied || !section) return null;

  return (
    <PageContentSections
      pageKey="dashboard"
      fallbackTitle={section.title}
      fallbackSubtitle={section.subtitle}
    >
      <BodyFluidListContent />
    </PageContentSections>
  );
}
