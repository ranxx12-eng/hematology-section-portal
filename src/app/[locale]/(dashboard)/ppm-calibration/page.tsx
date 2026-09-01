'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { type ColumnDef } from '@tanstack/react-table';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { useAuth } from '@/components/providers/auth-provider';
import { CentrifugePppQuickAction } from '@/components/ppm-calibration/centrifuge-ppp-quick-action';
import { PpmCalibrationKpiCards } from '@/components/ppm-calibration/ppm-calibration-kpi-cards';
import { PpmCalibrationReportsMenu } from '@/components/ppm-calibration/ppm-calibration-reports-menu';
import { RecordCalibrationDialog } from '@/components/ppm-calibration/record-calibration-dialog';
import { RecordPpmDialog } from '@/components/ppm-calibration/record-ppm-dialog';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import {
  createCalibrationRecord,
  createPpmRecord,
  fetchPpmCalibrationBundle,
} from '@/lib/clinical/ppm-calibration';
import { fetchCentrifugePppCalibrations } from '@/lib/clinical/centrifuge-ppp-calibration';
import { getCentrifugePppDisplayStatus } from '@/lib/ppm-calibration/centrifuge-ppp-logic';
import { dueStatusBadgeVariant } from '@/lib/ppm-calibration/compliance';
import { DUE_STATUS_LABELS, INSTRUMENT_ITEM_TYPE_LABELS } from '@/lib/ppm-calibration/constants';
import {
  canCreatePpmCalibration,
  canViewPpmCalibration,
} from '@/lib/ppm-calibration/permissions';
import type { CalibrationRecordFormData, PpmRecordFormData } from '@/lib/ppm-calibration/schema';
import { createPpmCalibrationReportPdf } from '@/lib/print/ppm-calibration-report';
import { formatCalibrationPerformer, formatInstrumentSelectorLabel } from '@/lib/ppm-calibration/instrument-display';
import { formatDate } from '@/lib/utils';
import type { Instrument } from '@/types';
import type {
  EquipmentMaintenanceDueStatus,
  EquipmentMaintenanceRecord,
  InstrumentMaintenanceSummary,
  PpmCalibrationTab,
} from '@/types/ppm-calibration';
import type { CentrifugePppCalibrationListItem } from '@/types/centrifuge-ppp-calibration';

const TAB_LABELS: Record<PpmCalibrationTab, string> = {
  overview: 'Overview',
  ppm: 'PPM',
  calibration: 'Calibration',
  due_soon: 'Due Soon',
  overdue: 'Overdue',
  history: 'History',
  centrifuge_ppp: 'Centrifuge PPP',
};

const STATUS_FILTER_OPTIONS: Array<{ value: 'all' | EquipmentMaintenanceDueStatus; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'due_soon', label: 'Due Soon' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'not_required', label: 'Not Required' },
];

function StatusBadge({ status, label }: { status: EquipmentMaintenanceDueStatus; label: string }) {
  return (
    <Badge variant={dueStatusBadgeVariant(status)} className="whitespace-nowrap text-[11px]">
      {label}
    </Badge>
  );
}

export default function PpmCalibrationPage() {
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const accessDenied = !canViewPpmCalibration(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  const [tab, setTab] = useState<PpmCalibrationTab>('overview');
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<InstrumentMaintenanceSummary[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [records, setRecords] = useState<EquipmentMaintenanceRecord[]>([]);
  const [centrifugeRecords, setCentrifugeRecords] = useState<CentrifugePppCalibrationListItem[]>([]);
  const [stats, setStats] = useState({
    totalItems: 0,
    ppmDueSoon: 0,
    ppmOverdue: 0,
    calibrationDueSoon: 0,
    calibrationOverdue: 0,
  });
  const [ppmDialogOpen, setPpmDialogOpen] = useState(false);
  const [calibrationDialogOpen, setCalibrationDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'instrument' | 'equipment'>('all');
  const [ppmStatusFilter, setPpmStatusFilter] = useState<'all' | EquipmentMaintenanceDueStatus>('all');
  const [calibrationStatusFilter, setCalibrationStatusFilter] = useState<'all' | EquipmentMaintenanceDueStatus>('all');
  const [recordSearchQuery, setRecordSearchQuery] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    const [bundle, centrifugeResult] = await Promise.all([
      fetchPpmCalibrationBundle(),
      fetchCentrifugePppCalibrations(),
    ]);
    setSummaries(bundle.summaries);
    setInstruments(bundle.instruments.filter((item) => item.active !== false));
    setRecords(bundle.records);
    setCentrifugeRecords(centrifugeResult.data);
    setStats(bundle.stats);
    setLoading(false);
    if (bundle.error) toast.error(bundle.error);
    if (centrifugeResult.error) toast.error(centrifugeResult.error);
  }, []);

  useEffect(() => {
    if (!accessDenied) void reload();
  }, [accessDenied, reload]);

  const isOverviewTab = tab === 'overview' || tab === 'due_soon' || tab === 'overdue';

  const tabFilteredSummaries = useMemo(() => {
    switch (tab) {
      case 'due_soon':
        return summaries.filter((s) => s.ppmStatus === 'due_soon' || s.calibrationStatus === 'due_soon');
      case 'overdue':
        return summaries.filter((s) => s.ppmStatus === 'overdue' || s.calibrationStatus === 'overdue');
      default:
        return summaries;
    }
  }, [summaries, tab]);

  const overviewTableData = useMemo(() => {
    let rows = tabFilteredSummaries;
    if (typeFilter !== 'all') rows = rows.filter((row) => row.itemType === typeFilter);
    if (ppmStatusFilter !== 'all') rows = rows.filter((row) => row.ppmStatus === ppmStatusFilter);
    if (calibrationStatusFilter !== 'all') rows = rows.filter((row) => row.calibrationStatus === calibrationStatusFilter);
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      rows = rows.filter((row) =>
        row.instrumentName.toLowerCase().includes(query)
        || (row.location?.toLowerCase().includes(query) ?? false)
        || (row.assetCode?.toLowerCase().includes(query) ?? false),
      );
    }
    return rows;
  }, [tabFilteredSummaries, typeFilter, ppmStatusFilter, calibrationStatusFilter, searchQuery]);

  const selectorItems = useMemo(
    () => instruments.map((item) => ({
      id: item.id,
      name: item.name,
      label: formatInstrumentSelectorLabel(item),
      serialNumber: item.serialNumber,
      assetCode: item.assetCode,
      equipmentCategory: item.equipmentCategory,
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
      cell: ({ row }) => <span className="font-medium">{row.original.instrumentName}</span>,
    },
    {
      id: 'type',
      header: 'Type',
      cell: ({ row }) => <span className="whitespace-nowrap">{INSTRUMENT_ITEM_TYPE_LABELS[row.original.itemType]}</span>,
    },
    {
      id: 'location',
      header: 'Location',
      cell: ({ row }) => <span className="whitespace-nowrap">{row.original.location ?? '—'}</span>,
    },
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
      cell: ({ row }) => <StatusBadge status={row.original.ppmStatus} label={DUE_STATUS_LABELS[row.original.ppmStatus]} />,
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
        <StatusBadge status={row.original.calibrationStatus} label={DUE_STATUS_LABELS[row.original.calibrationStatus]} />
      ),
    },
  ];

  const recordColumns: ColumnDef<EquipmentMaintenanceRecord>[] = [
    { id: 'date', header: 'Date', cell: ({ row }) => formatDate(row.original.performedDate, locale) },
    { id: 'type', header: 'Type', cell: ({ row }) => (row.original.recordType === 'ppm' ? 'PPM' : 'Calibration') },
    { id: 'result', header: 'Result', cell: ({ row }) => row.original.result.toUpperCase() },
    { id: 'provider', header: 'Provider', cell: ({ row }) => row.original.serviceProvider ?? '—' },
    { id: 'nextDue', header: 'Next Due', cell: ({ row }) => (row.original.nextDueDate ? formatDate(row.original.nextDueDate, locale) : '—') },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.dueStatus} label={DUE_STATUS_LABELS[row.original.dueStatus]} />,
    },
    {
      id: 'performedBy',
      header: 'Performed By',
      cell: ({ row }) => {
        if (row.original.recordType === 'calibration') {
          const performer = formatCalibrationPerformer(row.original);
          return (
            <div className="min-w-[140px] text-sm">
              <p className="truncate">{performer.primary}</p>
              {performer.secondary && <p className="truncate text-muted-foreground">{performer.secondary}</p>}
            </div>
          );
        }
        return row.original.performedByName;
      },
    },
  ];

  const centrifugeColumns: ColumnDef<CentrifugePppCalibrationListItem>[] = [
    { id: 'date', header: 'Calibration Date', cell: ({ row }) => formatDate(row.original.calibrationDate, locale) },
    { id: 'result', header: 'Overall Result', cell: ({ row }) => row.original.overallResult?.toUpperCase() ?? '—' },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.overallResult === 'fail' ? 'destructive' : 'secondary'} className="whitespace-nowrap text-[11px]">
          {getCentrifugePppDisplayStatus({
            status: row.original.status,
            overallResult: row.original.overallResult,
            approvalStatus: row.original.approvalStatus,
          })}
        </Badge>
      ),
    },
    { id: 'performedBy', header: 'Performed By', cell: ({ row }) => row.original.performedByName },
    { id: 'review', header: 'Review Status', cell: ({ row }) => row.original.reviewStatus },
    { id: 'approval', header: 'Approval Status', cell: ({ row }) => row.original.approvalStatus },
    { id: 'evidence', header: 'Evidence', cell: ({ row }) => (row.original.evidenceComplete ? 'Complete' : 'Incomplete') },
    { id: 'pdf', header: 'Final PDF', cell: ({ row }) => (row.original.hasFinalPdf ? 'Available' : '—') },
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
    const doc = await createPpmCalibrationReportPdf({ mode, summaries, records, locale });
    if (!doc) {
      toast.error('No data to export');
      return;
    }
    doc.save(`ppm-calibration-${mode}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  if (accessDenied) return null;

  return (
    <div className="space-y-5">
      <PageContentSections
        pageKey="ppm_calibration"
        fallbackTitle="PPM & Calibration"
        fallbackSubtitle="Preventive maintenance and calibration tracking for instruments and equipment"
      >
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {canCreatePpmCalibration(can) && (
              <>
                <Button onClick={() => setPpmDialogOpen(true)} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 me-2" aria-hidden="true" />
                  Record PPM
                </Button>
                <Button onClick={() => setCalibrationDialogOpen(true)} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 me-2" aria-hidden="true" />
                  Record Calibration
                </Button>
              </>
            )}
            <PpmCalibrationReportsMenu
              onExportPpmDue={() => void exportPdf('ppm_due')}
              onExportCalibrationDue={() => void exportPdf('calibration_due')}
              onExportHistory={() => void exportPdf('history')}
              onPrint={() => window.print()}
            />
          </div>
        </div>
      </PageContentSections>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading PPM and calibration data" />
        </div>
      ) : (
        <>
          <CentrifugePppQuickAction locale={locale} records={centrifugeRecords} />
          <PpmCalibrationKpiCards stats={stats} onSelectTab={setTab} />

          <Tabs value={tab} onValueChange={(value) => setTab(value as PpmCalibrationTab)} className="space-y-4">
            <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto p-1">
              {(Object.keys(TAB_LABELS) as PpmCalibrationTab[]).map((value) => (
                <TabsTrigger key={value} value={value} className="shrink-0 px-3">
                  {TAB_LABELS[value]}
                </TabsTrigger>
              ))}
            </TabsList>

            <Card>
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <Input
                    placeholder={isOverviewTab ? 'Search instruments/equipment...' : 'Search records...'}
                    value={isOverviewTab ? searchQuery : recordSearchQuery}
                    onChange={(event) => {
                      if (isOverviewTab) setSearchQuery(event.target.value);
                      else setRecordSearchQuery(event.target.value);
                    }}
                    aria-label={isOverviewTab ? 'Search instruments and equipment' : 'Search maintenance records'}
                    className="w-full lg:max-w-sm"
                  />
                  {isOverviewTab && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as typeof typeFilter)}>
                        <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filter by type">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All types</SelectItem>
                          <SelectItem value="instrument">Instrument</SelectItem>
                          <SelectItem value="equipment">Equipment</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={ppmStatusFilter} onValueChange={(value) => setPpmStatusFilter(value as typeof ppmStatusFilter)}>
                        <SelectTrigger className="w-full sm:w-[170px]" aria-label="Filter by PPM status">
                          <SelectValue placeholder="PPM Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_FILTER_OPTIONS.map((option) => (
                            <SelectItem key={`ppm-${option.value}`} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={calibrationStatusFilter}
                        onValueChange={(value) => setCalibrationStatusFilter(value as typeof calibrationStatusFilter)}
                      >
                        <SelectTrigger className="w-full sm:w-[190px]" aria-label="Filter by calibration status">
                          <SelectValue placeholder="Calibration Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_FILTER_OPTIONS.map((option) => (
                            <SelectItem key={`cal-${option.value}`} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <TabsContent value="overview" className="mt-0">
                  <DataTable
                    columns={overviewColumns}
                    data={overviewTableData}
                    hideSearch
                    stickyHeader
                    onRowClick={(row) => router.push(`/${locale}/ppm-calibration/${row.instrumentId}`)}
                    className="space-y-0"
                  />
                </TabsContent>
                <TabsContent value="due_soon" className="mt-0">
                  <DataTable
                    columns={overviewColumns}
                    data={overviewTableData}
                    hideSearch
                    stickyHeader
                    onRowClick={(row) => router.push(`/${locale}/ppm-calibration/${row.instrumentId}`)}
                    className="space-y-0"
                  />
                </TabsContent>
                <TabsContent value="overdue" className="mt-0">
                  <DataTable
                    columns={overviewColumns}
                    data={overviewTableData}
                    hideSearch
                    stickyHeader
                    onRowClick={(row) => router.push(`/${locale}/ppm-calibration/${row.instrumentId}`)}
                    className="space-y-0"
                  />
                </TabsContent>
                <TabsContent value="ppm" className="mt-0">
                  <DataTable
                    columns={recordColumns}
                    data={filteredRecords}
                    searchKey="performedByName"
                    hideSearch
                    globalFilter={recordSearchQuery}
                    onGlobalFilterChange={setRecordSearchQuery}
                    stickyHeader
                    className="space-y-0"
                  />
                </TabsContent>
                <TabsContent value="calibration" className="mt-0">
                  <DataTable
                    columns={recordColumns}
                    data={filteredRecords}
                    searchKey="performedByName"
                    hideSearch
                    globalFilter={recordSearchQuery}
                    onGlobalFilterChange={setRecordSearchQuery}
                    stickyHeader
                    className="space-y-0"
                  />
                </TabsContent>
                <TabsContent value="history" className="mt-0">
                  <DataTable
                    columns={recordColumns}
                    data={filteredRecords}
                    searchKey="performedByName"
                    hideSearch
                    globalFilter={recordSearchQuery}
                    onGlobalFilterChange={setRecordSearchQuery}
                    stickyHeader
                    className="space-y-0"
                  />
                </TabsContent>
                <TabsContent value="centrifuge_ppp" className="mt-0">
                  <DataTable
                    columns={centrifugeColumns}
                    data={centrifugeRecords}
                    searchKey="performedByName"
                    hideSearch
                    globalFilter={recordSearchQuery}
                    onGlobalFilterChange={setRecordSearchQuery}
                    stickyHeader
                    onRowClick={(row) => router.push(`/${locale}/ppm-calibration/centrifuge-ppp/${row.id}`)}
                    className="space-y-0"
                  />
                </TabsContent>
              </CardContent>
            </Card>
          </Tabs>
        </>
      )}

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
