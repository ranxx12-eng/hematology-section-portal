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
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { useRouteReplace } from '@/hooks/use-route-replace';
import {
  createCentrifugePppCalibrationDraft,
  fetchCentrifugePppCalibrations,
} from '@/lib/clinical/centrifuge-ppp-calibration';
import { fetchInstruments } from '@/lib/clinical/instruments';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import { findCentrifugeInstrument } from '@/lib/ppm-calibration/centrifuge-detection';
import { getCentrifugePppDisplayStatus } from '@/lib/ppm-calibration/centrifuge-ppp-logic';
import {
  canCreatePpmCalibration,
  canViewPpmCalibration,
} from '@/lib/ppm-calibration/permissions';
import { formatDate } from '@/lib/utils';
import type { CentrifugePppCalibrationListItem } from '@/types/centrifuge-ppp-calibration';

function CentrifugePppListContent() {
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<CentrifugePppCalibrationListItem[]>([]);
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await fetchCentrifugePppCalibrations();
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
    const instruments = await fetchInstruments();
    const centrifuge = findCentrifugeInstrument(instruments.data);
    if (!centrifuge) {
      toast.error('Official Centrifuge equipment record was not found.');
      setCreating(false);
      return;
    }
    const staff = await resolveStaffContext(user);
    const result = await createCentrifugePppCalibrationDraft(staff, centrifuge.id);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to create calibration');
      setCreating(false);
      return;
    }
    router.push(`/${locale}/ppm-calibration/centrifuge-ppp/${result.data.id}`);
  };

  const columns: ColumnDef<CentrifugePppCalibrationListItem>[] = [
    {
      id: 'date',
      header: 'Calibration Date',
      cell: ({ row }) => (
        <Link href={`/${locale}/ppm-calibration/centrifuge-ppp/${row.original.id}`} className="font-medium hover:underline">
          {formatDate(row.original.calibrationDate, locale)}
        </Link>
      ),
    },
    {
      id: 'result',
      header: 'Overall Result',
      cell: ({ row }) => row.original.overallResult?.toUpperCase() ?? '—',
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.overallResult === 'fail' ? 'destructive' : 'secondary'}>
          {getCentrifugePppDisplayStatus({
            status: row.original.status,
            overallResult: row.original.overallResult,
            approvalStatus: row.original.approvalStatus,
          })}
        </Badge>
      ),
    },
    {
      id: 'performedBy',
      header: 'Performed By',
      cell: ({ row }) => row.original.performedByName,
    },
    {
      id: 'review',
      header: 'Review Status',
      cell: ({ row }) => row.original.reviewStatus,
    },
    {
      id: 'approval',
      header: 'Approval Status',
      cell: ({ row }) => row.original.approvalStatus,
    },
    {
      id: 'evidence',
      header: 'Evidence',
      cell: ({ row }) => row.original.evidenceComplete ? 'Complete' : 'Incomplete',
    },
    {
      id: 'pdf',
      header: 'Final PDF',
      cell: ({ row }) => row.original.hasFinalPdf ? 'Available' : '—',
    },
  ];

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Centrifuge Calibration for PPP</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            One calibration record contains five PPP verification samples (Form-Hema-009).
          </p>
          {canCreatePpmCalibration(can) && (
            <Button onClick={() => void startNew()} disabled={creating}>
              <Plus className="h-4 w-4 me-2" />
              {creating ? 'Creating…' : 'New Centrifuge PPP Calibration'}
            </Button>
          )}
        </CardContent>
      </Card>

      <DataTable columns={columns} data={records} searchKey="performedByName" />
    </div>
  );
}

export default function CentrifugePppListPage() {
  const locale = useLocale();
  const { can } = useAuth();
  const accessDenied = !canViewPpmCalibration(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);
  if (accessDenied) return null;

  return (
    <PageContentSections
      pageKey="ppm_calibration"
      fallbackTitle="Centrifuge Calibration for PPP"
      fallbackSubtitle="Form-Hema-009 platelet poor plasma verification for the official Centrifuge"
    >
      <CentrifugePppListContent />
    </PageContentSections>
  );
}
