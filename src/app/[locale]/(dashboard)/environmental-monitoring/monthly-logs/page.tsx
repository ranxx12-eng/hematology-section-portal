'use client';

import { Suspense, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { Download, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { useEnvironmentalMonitoring } from '@/hooks/use-environmental-monitoring';
import { computeMonthlyComplianceSummary } from '@/lib/environmental-monitoring/compliance';
import { ENVIRONMENTAL_READING_STATUS_LABELS } from '@/lib/environmental-monitoring/constants';
import { createEnvironmentalMonthlyReportPdf } from '@/lib/print/env-monitoring-report';
import { formatDateTime } from '@/lib/utils';
import type { EnvironmentalReading } from '@/types/environmental-monitoring';
import '@/styles/qc-print.css';
import { ReadingCorrectionDialog } from '@/components/environmental-monitoring/reading-correction-dialog';

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const currentYear = new Date().getFullYear();

function MonthlyLogsContent() {
  const locale = useLocale();
  const { assets, windows, readings, excursions, corrections, loading, error, reload } = useEnvironmentalMonitoring();
  const [assetId, setAssetId] = useState<string>('all');
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(currentYear);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [printMode, setPrintMode] = useState(false);

  const selectedAsset = useMemo(
    () => (assetId === 'all' ? undefined : assets.find((asset) => asset.id === assetId)),
    [assetId, assets],
  );

  const monthReadings = useMemo(() => {
    return readings.filter((reading) => {
      if (reading.voidedAt) return false;
      const recorded = new Date(reading.recordedAt);
      if (recorded.getMonth() + 1 !== month || recorded.getFullYear() !== year) return false;
      if (selectedAsset && reading.assetId !== selectedAsset.id) return false;
      if (statusFilter === 'in_range') return reading.calculatedStatus === 'in_range';
      if (statusFilter === 'out_of_range') return reading.calculatedStatus === 'out_of_range';
      return true;
    });
  }, [readings, month, year, selectedAsset, statusFilter]);

  const summary = useMemo(() => {
    if (!selectedAsset) {
      const activeAssets = assets.filter((asset) => asset.active);
      const totals = activeAssets.map((asset) =>
        computeMonthlyComplianceSummary(asset, windows, readings, excursions, month, year),
      );
      const requiredReadings = totals.reduce((sum, item) => sum + item.requiredReadings, 0);
      const completedReadings = totals.reduce((sum, item) => sum + item.completedReadings, 0);
      return {
        requiredReadings,
        completedReadings,
        missingReadings: totals.reduce((sum, item) => sum + item.missingReadings, 0),
        outOfRangeReadings: totals.reduce((sum, item) => sum + item.outOfRangeReadings, 0),
        excursions: totals.reduce((sum, item) => sum + item.excursions, 0),
        compliancePercent: requiredReadings === 0 ? 100 : Number(((completedReadings / requiredReadings) * 100).toFixed(1)),
      };
    }
    return computeMonthlyComplianceSummary(selectedAsset, windows, readings, excursions, month, year);
  }, [selectedAsset, assets, windows, readings, excursions, month, year]);

  const excursionByReading = useMemo(
    () => Object.fromEntries(excursions.map((item) => [item.readingId, item])),
    [excursions],
  );

  const correctionByReading = useMemo(() => {
    const map: Record<string, typeof corrections> = {};
    for (const correction of corrections) {
      map[correction.readingId] = [...(map[correction.readingId] ?? []), correction];
    }
    return map;
  }, [corrections]);

  const columns: ColumnDef<EnvironmentalReading>[] = [
    {
      id: 'date',
      header: 'Date',
      cell: ({ row }) => formatDateTime(row.original.recordedAt, locale),
    },
    {
      id: 'asset',
      header: 'Asset',
      cell: ({ row }) => assets.find((asset) => asset.id === row.original.assetId)?.assetCode ?? '—',
    },
    {
      id: 'temperature',
      header: 'Temperature',
      cell: ({ row }) => {
        const correction = correctionByReading[row.original.id]?.[0];
        if (correction) {
          return `${correction.previousTemperature}°C → ${correction.newTemperature}°C`;
        }
        return `${row.original.temperature}°C`;
      },
    },
    {
      id: 'humidity',
      header: 'Humidity',
      cell: ({ row }) => row.original.humidity != null ? `${row.original.humidity}%` : '—',
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.calculatedStatus === 'in_range' ? 'success' : 'destructive'}>
          {ENVIRONMENTAL_READING_STATUS_LABELS[row.original.calculatedStatus]}
        </Badge>
      ),
    },
    {
      id: 'performedBy',
      header: 'Performed By',
      cell: ({ row }) => row.original.performedByName,
    },
    {
      id: 'staffId',
      header: 'Staff ID',
      cell: ({ row }) => row.original.performedByStaffId ?? '—',
    },
    {
      id: 'excursion',
      header: 'Corrective Action',
      cell: ({ row }) => excursionByReading[row.original.id]?.immediateAction ?? '—',
    },
    {
      id: 'reviewedBy',
      header: 'Reviewed By',
      cell: ({ row }) => excursionByReading[row.original.id]?.reviewedByName ?? '—',
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <ReadingCorrectionDialog
          reading={row.original}
          corrections={corrections.filter((item) => item.readingId === row.original.id)}
          onSaved={reload}
        />
      ),
    },
  ];

  const exportPdf = async () => {
    const doc = await createEnvironmentalMonthlyReportPdf({
      assets: selectedAsset ? [selectedAsset] : assets.filter((asset) => asset.active),
      windows,
      readings,
      excursions,
      corrections,
      month,
      year,
      summary,
      locale,
    });
    if (!doc) {
      toast.error('Unable to generate monthly report');
      return;
    }
    doc.save(`environmental-monitoring-${year}-${String(month).padStart(2, '0')}.pdf`);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 print:hidden">
        <Select value={assetId} onValueChange={setAssetId}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Asset" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assets</SelectItem>
            {assets.map((asset) => (
              <SelectItem key={asset.id} value={asset.id}>{asset.assetCode}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Month" /></SelectTrigger>
          <SelectContent>
            {MONTHS.map((value) => (
              <SelectItem key={value} value={String(value)}>{new Date(2000, value - 1, 1).toLocaleString(locale, { month: 'long' })}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue placeholder="Year" /></SelectTrigger>
          <SelectContent>
            {[currentYear - 1, currentYear, currentYear + 1].map((value) => (
              <SelectItem key={value} value={String(value)}>{value}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="in_range">In Range</SelectItem>
            <SelectItem value="out_of_range">Out of Range</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => { setPrintMode(true); window.print(); setPrintMode(false); }}>
          <Printer className="h-4 w-4 me-2" />Print
        </Button>
        <Button variant="outline" onClick={() => void exportPdf()}>
          <Download className="h-4 w-4 me-2" />PDF
        </Button>
      </div>

      {loading && <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}
      {!loading && error && <p className="text-destructive">{error}</p>}

      {!loading && !error && (
        <div className={printMode ? 'print-area' : ''}>
          <Card>
            <CardHeader>
              <CardTitle>Environmental Monitoring Monthly Log</CardTitle>
              <p className="text-sm text-muted-foreground">
                {selectedAsset ? `${selectedAsset.assetName} (${selectedAsset.assetCode})` : 'All assets'} · {new Date(year, month - 1).toLocaleString(locale, { month: 'long', year: 'numeric' })}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 text-sm">
                <div><p className="text-muted-foreground">Monthly Compliance</p><p className="font-semibold">{summary.compliancePercent}%</p></div>
                <div><p className="text-muted-foreground">Required</p><p className="font-semibold">{summary.requiredReadings}</p></div>
                <div><p className="text-muted-foreground">Completed</p><p className="font-semibold">{summary.completedReadings}</p></div>
                <div><p className="text-muted-foreground">Missing</p><p className="font-semibold">{summary.missingReadings}</p></div>
                <div><p className="text-muted-foreground">Out of Range</p><p className="font-semibold">{summary.outOfRangeReadings}</p></div>
                <div><p className="text-muted-foreground">Excursions</p><p className="font-semibold">{summary.excursions}</p></div>
              </div>
              <DataTable columns={columns} data={monthReadings} searchKey="performedByName" />
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

export default function EnvironmentalMonthlyLogsPage() {
  return (
    <PageContentSections
      pageKey="environmental_monitoring"
      fallbackTitle="Monthly Logs"
      fallbackSubtitle="Monthly environmental monitoring compliance and reading history"
    >
      <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
        <MonthlyLogsContent />
      </Suspense>
    </PageContentSections>
  );
}
