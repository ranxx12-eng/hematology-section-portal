'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { type ColumnDef } from '@tanstack/react-table';
import { Download, Loader2, Plus, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { useAuth } from '@/components/providers/auth-provider';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import {
  createCalibrationRecord,
  createPpmRecord,
  fetchPpmCalibrationBundle,
} from '@/lib/clinical/ppm-calibration';
import { dueStatusBadgeVariant } from '@/lib/ppm-calibration/compliance';
import { DUE_STATUS_LABELS, INSTRUMENT_ITEM_TYPE_LABELS } from '@/lib/ppm-calibration/constants';
import {
  canCreatePpmCalibration,
  canViewPpmCalibration,
} from '@/lib/ppm-calibration/permissions';
import {
  calibrationRecordFormSchema,
  ppmRecordFormSchema,
  type CalibrationRecordFormData,
  type PpmRecordFormData,
} from '@/lib/ppm-calibration/schema';
import { createPpmCalibrationReportPdf } from '@/lib/print/ppm-calibration-report';
import { formatCalibrationPerformer, formatInstrumentSelectorLabel } from '@/lib/ppm-calibration/instrument-display';
import { formatDate } from '@/lib/utils';
import type { Instrument } from '@/types';
import type { EquipmentMaintenanceRecord, InstrumentMaintenanceSummary, PpmCalibrationTab } from '@/types/ppm-calibration';
import { RecordCalibrationDialog } from '@/components/ppm-calibration/record-calibration-dialog';
import { RecordPpmDialog } from '@/components/ppm-calibration/record-ppm-dialog';

function PpmCalibrationContent() {
  const locale = useLocale();
  const { can, user } = useAuth();
  const [tab, setTab] = useState<PpmCalibrationTab>('overview');
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<InstrumentMaintenanceSummary[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [records, setRecords] = useState<EquipmentMaintenanceRecord[]>([]);
  const [stats, setStats] = useState({
    totalItems: 0,
    ppmDueSoon: 0,
    ppmOverdue: 0,
    calibrationDueSoon: 0,
    calibrationOverdue: 0,
  });
  const [ppmDialogOpen, setPpmDialogOpen] = useState(false);
  const [calibrationDialogOpen, setCalibrationDialogOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const bundle = await fetchPpmCalibrationBundle();
    setSummaries(bundle.summaries);
    setInstruments(bundle.instruments.filter((item) => item.active !== false));
    setRecords(bundle.records);
    setStats(bundle.stats);
    setLoading(false);
    if (bundle.error) toast.error(bundle.error);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filteredSummaries = useMemo(() => {
    switch (tab) {
      case 'due_soon':
        return summaries.filter((s) => s.ppmStatus === 'due_soon' || s.calibrationStatus === 'due_soon');
      case 'overdue':
        return summaries.filter((s) => s.ppmStatus === 'overdue' || s.calibrationStatus === 'overdue');
      default:
        return summaries;
    }
  }, [summaries, tab]);

  const selectorItems = useMemo(
    () => instruments.map((item) => ({
      id: item.id,
      name: item.name,
      label: formatInstrumentSelectorLabel(item),
    })),
    [instruments],
  );

  const filteredRecords = useMemo(() => {
    switch (tab) {
      case 'ppm':
        return records.filter((r) => r.recordType === 'ppm');
      case 'calibration':
        return records.filter((r) => r.recordType === 'calibration');
      case 'history':
        return records;
      default:
        return records;
    }
  }, [records, tab]);

  const overviewColumns: ColumnDef<InstrumentMaintenanceSummary>[] = [
    {
      id: 'name',
      header: 'Instrument / Equipment',
      cell: ({ row }) => (
        <Link href={`/${locale}/ppm-calibration/${row.original.instrumentId}`} className="font-medium hover:underline">
          {row.original.instrumentName}
        </Link>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      cell: ({ row }) => INSTRUMENT_ITEM_TYPE_LABELS[row.original.itemType],
    },
    { id: 'location', header: 'Location', cell: ({ row }) => row.original.location ?? '—' },
    {
      id: 'lastPpm',
      header: 'Last PPM',
      cell: ({ row }) => row.original.lastPpmDate ? formatDate(row.original.lastPpmDate, locale) : '—',
    },
    {
      id: 'nextPpm',
      header: 'Next PPM',
      cell: ({ row }) => row.original.nextPpmDate ? formatDate(row.original.nextPpmDate, locale) : '—',
    },
    {
      id: 'ppmStatus',
      header: 'PPM Status',
      cell: ({ row }) => (
        <Badge variant={dueStatusBadgeVariant(row.original.ppmStatus)}>{DUE_STATUS_LABELS[row.original.ppmStatus]}</Badge>
      ),
    },
    {
      id: 'lastCal',
      header: 'Last Calibration',
      cell: ({ row }) => row.original.lastCalibrationDate ? formatDate(row.original.lastCalibrationDate, locale) : '—',
    },
    {
      id: 'nextCal',
      header: 'Next Calibration',
      cell: ({ row }) => row.original.nextCalibrationDate ? formatDate(row.original.nextCalibrationDate, locale) : '—',
    },
    {
      id: 'calStatus',
      header: 'Calibration Status',
      cell: ({ row }) => (
        <Badge variant={dueStatusBadgeVariant(row.original.calibrationStatus)}>
          {DUE_STATUS_LABELS[row.original.calibrationStatus]}
        </Badge>
      ),
    },
  ];

  const recordColumns: ColumnDef<EquipmentMaintenanceRecord>[] = [
    {
      id: 'date',
      header: 'Date',
      cell: ({ row }) => formatDate(row.original.performedDate, locale),
    },
    {
      id: 'type',
      header: 'Type',
      cell: ({ row }) => row.original.recordType === 'ppm' ? 'PPM' : 'Calibration',
    },
    {
      id: 'result',
      header: 'Result',
      cell: ({ row }) => row.original.result.toUpperCase(),
    },
    {
      id: 'provider',
      header: 'Provider',
      cell: ({ row }) => row.original.serviceProvider ?? '—',
    },
    {
      id: 'nextDue',
      header: 'Next Due',
      cell: ({ row }) => row.original.nextDueDate ? formatDate(row.original.nextDueDate, locale) : '—',
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={dueStatusBadgeVariant(row.original.dueStatus)}>{DUE_STATUS_LABELS[row.original.dueStatus]}</Badge>
      ),
    },
    {
      id: 'performedBy',
      header: 'Performed By',
      cell: ({ row }) => {
        if (row.original.recordType === 'calibration') {
          const performer = formatCalibrationPerformer(row.original);
          return (
            <div className="text-sm">
              <p>{performer.primary}</p>
              {performer.mode === 'internal' && performer.secondary && (
                <p className="text-muted-foreground">{performer.secondary}</p>
              )}
              {performer.mode === 'external' && performer.secondary && (
                <p className="text-muted-foreground">{performer.secondary}</p>
              )}
            </div>
          );
        }
        return row.original.performedByName;
      },
    },
  ];

  const savePpm = async (form: PpmRecordFormData, attachment?: File) => {
    if (!user) return;
    const staff = await resolveStaffContext(user);
    const result = await createPpmRecord(staff, form, attachment);
    if (result.error) toast.error(result.error);
    else {
      toast.success('PPM recorded');
      setPpmDialogOpen(false);
      await reload();
    }
  };

  const saveCalibration = async (form: CalibrationRecordFormData, attachment?: File) => {
    if (!user) return;
    const staff = await resolveStaffContext(user);
    const result = await createCalibrationRecord(staff, form, attachment);
    if (result.error) toast.error(result.error);
    else {
      toast.success('Calibration recorded');
      setCalibrationDialogOpen(false);
      await reload();
    }
  };

  const exportPdf = async (mode: 'ppm_due' | 'calibration_due' | 'history') => {
    const doc = await createPpmCalibrationReportPdf({
      mode,
      summaries,
      records,
      locale,
    });
    if (!doc) {
      toast.error('No data to export');
      return;
    }
    doc.save(`ppm-calibration-${mode}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {canCreatePpmCalibration(can) && (
          <>
            <Button onClick={() => setPpmDialogOpen(true)}><Plus className="h-4 w-4 me-2" />Record PPM</Button>
            <Button variant="outline" onClick={() => setCalibrationDialogOpen(true)}><Plus className="h-4 w-4 me-2" />Record Calibration</Button>
          </>
        )}
        <Button variant="outline" onClick={() => void exportPdf('ppm_due')}><Download className="h-4 w-4 me-2" />PPM Due PDF</Button>
        <Button variant="outline" onClick={() => void exportPdf('calibration_due')}><Download className="h-4 w-4 me-2" />Calibration Due PDF</Button>
        <Button variant="outline" onClick={() => void exportPdf('history')}><Download className="h-4 w-4 me-2" />Maintenance History PDF</Button>
        <Button variant="outline" onClick={() => { window.print(); }}><Printer className="h-4 w-4 me-2" />Print</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card className="cursor-pointer hover:border-primary/40" onClick={() => setTab('overview')}>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.totalItems}</p></CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-amber-500/40" onClick={() => setTab('due_soon')}>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">PPM Due Soon</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-amber-600">{stats.ppmDueSoon}</p></CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-destructive/40" onClick={() => setTab('overdue')}>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">PPM Overdue</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-destructive">{stats.ppmOverdue}</p></CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-amber-500/40" onClick={() => setTab('due_soon')}>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Calibration Due Soon</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-amber-600">{stats.calibrationDueSoon}</p></CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-destructive/40" onClick={() => setTab('overdue')}>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Calibration Overdue</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-destructive">{stats.calibrationOverdue}</p></CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as PpmCalibrationTab)}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ppm">PPM</TabsTrigger>
          <TabsTrigger value="calibration">Calibration</TabsTrigger>
          <TabsTrigger value="due_soon">Due Soon</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <DataTable columns={overviewColumns} data={filteredSummaries} searchKey="instrumentName" />
        </TabsContent>
        <TabsContent value="due_soon" className="mt-4">
          <DataTable columns={overviewColumns} data={filteredSummaries} searchKey="instrumentName" />
        </TabsContent>
        <TabsContent value="overdue" className="mt-4">
          <DataTable columns={overviewColumns} data={filteredSummaries} searchKey="instrumentName" />
        </TabsContent>
        <TabsContent value="ppm" className="mt-4">
          <DataTable columns={recordColumns} data={filteredRecords} searchKey="performedByName" />
        </TabsContent>
        <TabsContent value="calibration" className="mt-4">
          <DataTable columns={recordColumns} data={filteredRecords} searchKey="performedByName" />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <DataTable columns={recordColumns} data={filteredRecords} searchKey="performedByName" />
        </TabsContent>
      </Tabs>

      <RecordPpmDialog
        open={ppmDialogOpen}
        onOpenChange={setPpmDialogOpen}
        instruments={selectorItems}
        onSave={savePpm}
      />
      <RecordCalibrationDialog
        open={calibrationDialogOpen}
        onOpenChange={setCalibrationDialogOpen}
        instruments={selectorItems}
        onSave={saveCalibration}
      />
    </div>
  );
}

export default function PpmCalibrationPage() {
  const locale = useLocale();
  const { can } = useAuth();
  const accessDenied = !canViewPpmCalibration(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);
  if (accessDenied) return null;

  return (
    <PageContentSections
      pageKey="ppm_calibration"
      fallbackTitle="PPM & Calibration"
      fallbackSubtitle="Preventive maintenance and calibration tracking for instruments and equipment"
    >
      <PpmCalibrationContent />
    </PageContentSections>
  );
}
