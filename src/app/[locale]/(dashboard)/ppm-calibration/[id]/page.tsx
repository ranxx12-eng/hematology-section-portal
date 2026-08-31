'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { type ColumnDef } from '@tanstack/react-table';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { DataTable } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { useAuth } from '@/components/providers/auth-provider';
import { fetchInstrumentById } from '@/lib/clinical/instruments';
import {
  buildInstrumentMaintenanceSummary,
  fetchEquipmentMaintenanceRecords,
  getAttachmentSignedUrl,
} from '@/lib/clinical/ppm-calibration';
import { dueStatusBadgeVariant } from '@/lib/ppm-calibration/compliance';
import { DUE_STATUS_LABELS, INSTRUMENT_ITEM_TYPE_LABELS } from '@/lib/ppm-calibration/constants';
import { canViewPpmCalibration } from '@/lib/ppm-calibration/permissions';
import { createPpmCalibrationReportPdf } from '@/lib/print/ppm-calibration-report';
import { formatDate } from '@/lib/utils';
import type { EquipmentMaintenanceRecord } from '@/types/ppm-calibration';
import type { Instrument } from '@/types';

export default function PpmCalibrationDetailPage() {
  const params = useParams<{ id: string }>();
  const locale = useLocale();
  const { can } = useAuth();
  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [records, setRecords] = useState<EquipmentMaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const accessDenied = !canViewPpmCalibration(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  useEffect(() => {
    if (accessDenied || !params.id) return;
    void (async () => {
      setLoading(true);
      const [instrumentResult, recordsResult] = await Promise.all([
        fetchInstrumentById(params.id),
        fetchEquipmentMaintenanceRecords(params.id),
      ]);
      setInstrument(instrumentResult.data);
      setRecords(recordsResult.data);
      setLoading(false);
    })();
  }, [accessDenied, params.id]);

  const summary = useMemo(
    () => (instrument ? buildInstrumentMaintenanceSummary(instrument, records) : null),
    [instrument, records],
  );

  const ppmHistory = records.filter((r) => r.recordType === 'ppm');
  const calibrationHistory = records.filter((r) => r.recordType === 'calibration');

  const historyColumns: ColumnDef<EquipmentMaintenanceRecord>[] = [
    { id: 'date', header: 'Date', cell: ({ row }) => formatDate(row.original.performedDate, locale) },
    { id: 'result', header: 'Result', cell: ({ row }) => row.original.result.toUpperCase() },
    { id: 'provider', header: 'Provider', cell: ({ row }) => row.original.serviceProvider ?? '—' },
    { id: 'engineer', header: 'Engineer', cell: ({ row }) => row.original.engineerName ?? '—' },
    {
      id: 'cert',
      header: 'Certificate / Work Order',
      cell: ({ row }) => row.original.certificateNumber ?? row.original.workOrderNumber ?? row.original.ticketNumber ?? '—',
    },
    {
      id: 'nextDue',
      header: 'Next Due',
      cell: ({ row }) => row.original.nextDueDate ? formatDate(row.original.nextDueDate, locale) : '—',
    },
    { id: 'performedBy', header: 'Performed By', cell: ({ row }) => row.original.performedByName },
    { id: 'reviewedBy', header: 'Reviewed By', cell: ({ row }) => row.original.reviewedByName ?? '—' },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={dueStatusBadgeVariant(row.original.dueStatus)}>{DUE_STATUS_LABELS[row.original.dueStatus]}</Badge>
      ),
    },
    {
      id: 'attachment',
      header: 'Attachment',
      cell: ({ row }) => row.original.attachmentPath ? (
        <Button
          size="sm"
          variant="link"
          className="h-auto p-0"
          onClick={() => void getAttachmentSignedUrl(row.original.attachmentPath!).then((url) => {
            if (url) window.open(url, '_blank', 'noopener,noreferrer');
          })}
        >
          {row.original.attachmentName ?? 'View'}
        </Button>
      ) : '—',
    },
  ];

  const exportHistoryPdf = async () => {
    if (!summary) return;
    const doc = await createPpmCalibrationReportPdf({
      mode: 'history',
      summaries: [summary],
      records,
      locale,
    });
    if (!doc) {
      toast.error('No history to export');
      return;
    }
    doc.save(`maintenance-history-${instrument?.name ?? params.id}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  if (accessDenied) return null;

  return (
    <PageContentSections
      pageKey="ppm_calibration"
      fallbackTitle={instrument?.name ?? 'Maintenance History'}
      fallbackSubtitle="PPM and calibration history"
    >
      {loading && <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>}
      {!loading && instrument && summary && (
        <div className="space-y-4">
          <Button variant="outline" asChild><Link href={`/${locale}/ppm-calibration`}>← Back to PPM & Calibration</Link></Button>
          <Button variant="outline" onClick={() => void exportHistoryPdf()}><Download className="h-4 w-4 me-2" />Maintenance History PDF</Button>
          <Card>
            <CardHeader>
              <CardTitle>{instrument.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {INSTRUMENT_ITEM_TYPE_LABELS[summary.itemType]} · {instrument.location || '—'} · {instrument.assetCode || instrument.serialNumber || '—'}
              </p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4 text-sm">
              <div><p className="text-muted-foreground">PPM Status</p><Badge variant={dueStatusBadgeVariant(summary.ppmStatus)}>{DUE_STATUS_LABELS[summary.ppmStatus]}</Badge></div>
              <div><p className="text-muted-foreground">Calibration Status</p><Badge variant={dueStatusBadgeVariant(summary.calibrationStatus)}>{DUE_STATUS_LABELS[summary.calibrationStatus]}</Badge></div>
              <div><p className="text-muted-foreground">Next PPM</p><p>{summary.nextPpmDate ? formatDate(summary.nextPpmDate, locale) : '—'}</p></div>
              <div><p className="text-muted-foreground">Next Calibration</p><p>{summary.nextCalibrationDate ? formatDate(summary.nextCalibrationDate, locale) : '—'}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>PPM History</CardTitle></CardHeader>
            <CardContent><DataTable columns={historyColumns} data={ppmHistory} searchKey="performedByName" /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Calibration History</CardTitle></CardHeader>
            <CardContent><DataTable columns={historyColumns} data={calibrationHistory} searchKey="performedByName" /></CardContent>
          </Card>
        </div>
      )}
    </PageContentSections>
  );
}
