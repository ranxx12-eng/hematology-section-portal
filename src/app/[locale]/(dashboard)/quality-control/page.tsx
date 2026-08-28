'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Pencil, Loader2, FlaskConical, QrCode, Download, Printer, Trash2, Eye, ClipboardCheck, CheckCircle2, CalendarDays, CalendarRange } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { StatCard } from '@/components/shared/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { QCFormFields, recordToForm } from '@/components/qc-records/qc-form';
import { QCDecisionField } from '@/components/qc-records/qc-decision-field';
import { QCRecordDetailSections, QCWorkflowBadges } from '@/components/qc-records/qc-record-detail';
import { useAuth } from '@/components/providers/auth-provider';
import { statusBadgeVariant } from '@/lib/page-utils';
import { formatDateTime } from '@/lib/utils';
import {
  approveQCRecord,
  computeQCSummary,
  createQCRecord,
  createQCRecordBatch,
  fetchInstrumentNameMap,
  fetchQCInstruments,
  fetchQCRecords,
  reviewQCRecord,
  shouldUseBatchCreate,
  updateQCRecord,
} from '@/lib/clinical/qc-records';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import {
  getLevelsForParameter,
  getParametersForInstrument,
  QC_INSTRUMENT_NAMES,
} from '@/lib/qc-records/config';
import {
  QC_IN_OUT_STATUSES,
  QC_RESOLUTION_FILTER_OPTIONS,
} from '@/lib/qc-records/constants';
import {
  canApproveQCRecord,
  canAccessQCReviewCenter,
  canReviewDailyQC,
  canReviewMonthlyQC,
  canReviewQCRecord,
  formatQCFrequencyLabel,
} from '@/lib/qc-records/permissions';
import {
  buildQCReviewCenterHref,
  countQCPendingReviewByFrequency,
} from '@/lib/qc-records/review-queue';
import {
  qcApprovalFormSchema,
  qcReviewFormSchema,
  emptyQCApprovalForm,
  emptyQCReviewForm,
  type QCApprovalFormData,
  type QCReviewFormData,
} from '@/lib/qc-records/review-schema';
import {
  deriveResolutionDisplay,
  emptyQCRecordForm,
  formatCorrectiveActionsSummary,
  qcRecordFormSchema,
  type QCRecordFormData,
} from '@/lib/qc-records/schema';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { QCPrintFooter, QCPrintHeader } from '@/components/print/qc-print-chrome';
import { QCPrintTable } from '@/components/print/qc-print-table';
import { ReportDateRangeDialog, type ReportExportAction } from '@/components/print/report-date-range-dialog';
import { SystemAdminDeleteDialog } from '@/components/records/system-admin-delete-dialog';
import { ViewDeletedRecordsLink } from '@/components/records/view-deleted-records-link';
import { createQCReportPdf } from '@/lib/print/qc-report';
import { formatReportingPeriodLabel, type ReportDateRange } from '@/lib/print/report-date-range';
import { canSoftDeleteModule } from '@/lib/records/restore';
import { softDeleteOperationalRecord } from '@/lib/records/soft-delete';
import '@/styles/qc-print.css';
import type { QCRecord } from '@/types';

export default function QualityControlPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can, user } = useAuth();
  const canManage = can('qc.manage');
  const canDelete = canSoftDeleteModule('qc_records', can);
  const canViewDeleted = can('records.restore');
  const canQrAdmin = canManage;
  const [records, setRecords] = useState<QCRecord[]>([]);
  const [instrumentOptions, setInstrumentOptions] = useState<{ id: string; name: string }[]>([]);
  const [instrumentNames, setInstrumentNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<QCRecordFormData>(() => emptyQCRecordForm());
  const [staffName, setStaffName] = useState('');
  const [filters, setFilters] = useState({
    instrumentId: 'all',
    parameter: 'all',
    level: 'all',
    qcStatus: 'all',
    resolution: 'all' as (typeof QC_RESOLUTION_FILTER_OPTIONS)[number],
    dateFrom: '',
    dateTo: '',
  });
  const [dateRangeDialogOpen, setDateRangeDialogOpen] = useState(false);
  const [exportAction, setExportAction] = useState<ReportExportAction>('print');
  const [printExport, setPrintExport] = useState<{ records: QCRecord[]; period: string } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [viewRecord, setViewRecord] = useState<QCRecord | null>(null);
  const [reviewRecord, setReviewRecord] = useState<QCRecord | null>(null);
  const [approveRecord, setApproveRecord] = useState<QCRecord | null>(null);
  const [reviewForm, setReviewForm] = useState<QCReviewFormData>(() => emptyQCReviewForm());
  const [approvalForm, setApprovalForm] = useState<QCApprovalFormData>(() => emptyQCApprovalForm());

  const canReviewCenter = canAccessQCReviewCenter(can);
  const canDailyReview = canReviewDailyQC(can);
  const canMonthlyReview = canReviewMonthlyQC(can);
  const dailyPendingReviewCount = useMemo(
    () => countQCPendingReviewByFrequency(records, 'daily'),
    [records],
  );
  const monthlyPendingReviewCount = useMemo(
    () => countQCPendingReviewByFrequency(records, 'monthly'),
    [records],
  );

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [qcResult, instruments, names] = await Promise.all([
      fetchQCRecords(),
      fetchQCInstruments(),
      fetchInstrumentNameMap(),
    ]);
    setRecords(qcResult.data);
    setInstrumentOptions(instruments);
    setInstrumentNames(names);
    setError(qcResult.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    if (!user) return;
    void resolveStaffContext(user).then((staff) => setStaffName(staff.fullName));
  }, [user]);

  const accessDenied = !can('qc.view');
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);
  if (accessDenied) return null;

  const filterInstrumentName = filters.instrumentId !== 'all'
    ? instrumentNames[filters.instrumentId]
    : undefined;

  const parameterOptions = useMemo(() => {
    if (filterInstrumentName) {
      return getParametersForInstrument(filterInstrumentName).map((p) => p.name);
    }
    return [...new Set(QC_INSTRUMENT_NAMES.flatMap((name) => getParametersForInstrument(name).map((p) => p.name)))];
  }, [filterInstrumentName]);

  const levelOptions = useMemo(() => {
    if (filterInstrumentName && filters.parameter !== 'all') {
      return [...getLevelsForParameter(filterInstrumentName, filters.parameter)];
    }
    return [];
  }, [filterInstrumentName, filters.parameter]);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      const name = instrumentNames[r.instrumentId];
      if (filters.instrumentId !== 'all' && r.instrumentId !== filters.instrumentId) return false;
      if (filters.parameter !== 'all' && r.parameter !== filters.parameter) return false;
      if (filters.level !== 'all' && r.level !== filters.level) return false;
      if (filters.qcStatus !== 'all' && r.qcStatus !== filters.qcStatus) return false;
      if (filters.dateFrom && r.recordedAt.slice(0, 10) < filters.dateFrom) return false;
      if (filters.dateTo && r.recordedAt.slice(0, 10) > filters.dateTo) return false;

      const resolution = deriveResolutionDisplay(r.qcStatus, r.resolutionStatus);
      if (filters.resolution === 'resolved' && resolution !== 'Resolved') return false;
      if (filters.resolution === 'unresolved' && resolution !== 'Unresolved' && resolution !== 'Still OUT') return false;
      if (filters.resolution === 'Pending' && resolution !== 'Pending') return false;
      if (filters.resolution === 'Still OUT' && resolution !== 'Still OUT') return false;

      void name;
      return true;
    });
  }, [records, filters, instrumentNames]);

  const summary = useMemo(() => computeQCSummary(filtered), [filtered]);

  const getInstrumentName = (id: string) => instrumentNames[id] ?? id;

  const openAddDialog = () => {
    setEditingId(null);
    setForm(emptyQCRecordForm());
    setDialogOpen(true);
  };

  const openEditDialog = (record: QCRecord) => {
    setEditingId(record.id);
    setForm(recordToForm(record, instrumentNames));
    setDialogOpen(true);
  };

  const saveRecord = async () => {
    if (!canManage || !user || saving) return;

    const parsed = qcRecordFormSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Please complete all required fields');
      return;
    }

    setSaving(true);
    const staff = await resolveStaffContext(user);
    const existing = editingId ? records.find((r) => r.id === editingId) : undefined;

    if (editingId && existing) {
      const result = await updateQCRecord(editingId, staff, parsed.data, existing);
      setSaving(false);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('QC record updated');
    } else if (shouldUseBatchCreate(parsed.data)) {
      const result = await createQCRecordBatch(staff, parsed.data);
      setSaving(false);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.data?.count ?? 0} QC parameter records saved successfully.`);
    } else {
      const result = await createQCRecord(staff, parsed.data);
      setSaving(false);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('QC record created');
    }
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyQCRecordForm());
    await loadRecords();
  };

  const openReportExportDialog = (action: ReportExportAction) => {
    setExportAction(action);
    setDateRangeDialogOpen(true);
  };

  const getQCRecordDate = useCallback((record: QCRecord) => record.recordedAt, []);

  const handleReportDateRangeConfirm = (range: ReportDateRange, filteredRecords: QCRecord[]) => {
    const period = formatReportingPeriodLabel(range, locale);
    setDateRangeDialogOpen(false);

    if (exportAction === 'pdf') {
      void createQCReportPdf(filteredRecords, instrumentNames, period).then((doc) => {
        doc.save('quality-control-report.pdf');
        toast.success('PDF exported');
      });
      return;
    }

    setPrintExport({ records: filteredRecords, period });
    window.setTimeout(() => window.print(), 50);
  };

  const openDeleteDialog = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async (deleteReason?: string) => {
    if (!deletingId || !user) return;
    setDeleteSaving(true);
    const staff = await resolveStaffContext(user);
    const result = await softDeleteOperationalRecord('qc_records', deletingId, staff, deleteReason);
    setDeleteSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Record deleted');
    setDeleteDialogOpen(false);
    setDeletingId(null);
    await loadRecords();
  };

  const openViewDialog = (record: QCRecord) => {
    setViewRecord(record);
  };

  const openReviewDialog = (record: QCRecord) => {
    setReviewRecord(record);
    setReviewForm(emptyQCReviewForm());
  };

  const openApproveDialog = (record: QCRecord) => {
    setApproveRecord(record);
    setApprovalForm(emptyQCApprovalForm());
  };

  const saveReview = async () => {
    if (!reviewRecord || !user) return;
    const parsed = qcReviewFormSchema.safeParse(reviewForm);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Please complete review fields');
      return;
    }
    setSaving(true);
    const staff = await resolveStaffContext(user);
    const result = await reviewQCRecord(reviewRecord.id, staff, parsed.data);
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('QC record reviewed');
    setReviewRecord(null);
    await loadRecords();
  };

  const saveApproval = async () => {
    if (!approveRecord || !user) return;
    const parsed = qcApprovalFormSchema.safeParse(approvalForm);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Please complete approval fields');
      return;
    }
    setSaving(true);
    const staff = await resolveStaffContext(user);
    const result = await approveQCRecord(approveRecord.id, staff, parsed.data);
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('QC record approved');
    setApproveRecord(null);
    await loadRecords();
  };

  const columns: ColumnDef<QCRecord>[] = useMemo(() => [
    {
      accessorKey: 'recordedAt',
      header: 'Date/Time',
      cell: ({ row }) => formatDateTime(row.original.recordedAt, locale),
    },
    {
      accessorKey: 'instrumentId',
      header: 'Instrument',
      cell: ({ row }) => getInstrumentName(row.original.instrumentId),
    },
    { accessorKey: 'parameter', header: 'Parameter' },
    { accessorKey: 'level', header: 'Level' },
    {
      accessorKey: 'qcStatus',
      header: 'QC Status',
      cell: ({ row }) => (
        <Badge variant={statusBadgeVariant(row.original.qcStatus)}>{row.original.qcStatus}</Badge>
      ),
    },
    {
      id: 'correctiveAction',
      header: 'Corrective Action',
      cell: ({ row }) => {
        const r = row.original;
        if (r.qcStatus === 'IN') return '—';
        return formatCorrectiveActionsSummary(r.correctiveActions, r.correctiveActionOther);
      },
    },
    {
      id: 'resolution',
      header: 'Resolution Status',
      cell: ({ row }) => {
        const label = deriveResolutionDisplay(row.original.qcStatus, row.original.resolutionStatus);
        if (label === 'N/A') return '—';
        return <Badge variant={statusBadgeVariant(label)}>{label}</Badge>;
      },
    },
    {
      id: 'workflow',
      header: 'Workflow',
      cell: ({ row }) => (
        <div className="space-y-1">
          <QCWorkflowBadges record={row.original} />
        </div>
      ),
    },
    {
      id: 'performedBy',
      header: 'Performed By',
      cell: ({ row }) => row.original.performedByName ?? '—',
    },
    {
      id: 'comment',
      header: 'Comment',
      cell: ({ row }) => row.original.comment ?? row.original.correctiveActionComment ?? '—',
    },
    {
      id: 'updated',
      header: 'Updated',
      cell: ({ row }) => formatDateTime(row.original.updatedAt, locale),
    },
    {
      id: 'actions',
      header: tc('actions'),
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => openViewDialog(row.original)} title="View">
            <Eye className="h-4 w-4" />
          </Button>
          {canReviewQCRecord(can, row.original, user?.id) && (
            <Button size="sm" variant="ghost" onClick={() => openReviewDialog(row.original)} title="Review">
              <ClipboardCheck className="h-4 w-4" />
            </Button>
          )}
          {canApproveQCRecord(can, row.original) && (
            <Button size="sm" variant="ghost" onClick={() => openApproveDialog(row.original)} title="Approve">
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          )}
          {canManage && (
            <Button size="sm" variant="ghost" onClick={() => openEditDialog(row.original)}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canDelete && (
            <Button size="sm" variant="ghost" onClick={() => openDeleteDialog(row.original.id)}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          )}
        </div>
      ),
    },
  ], [can, canDelete, canManage, instrumentNames, locale, tc, user?.id]);

  return (
    <div className="qc-print-report space-y-6">
      <QCPrintHeader />

      <div className="print:hidden">
      <PageContentSections
        pageKey="quality_control"
        fallbackTitle={tc('qualityControl')}
        fallbackSubtitle={
          canMonthlyReview && monthlyPendingReviewCount > 0
            ? `Monitor QC runs, review out-of-range results, and document corrective actions. Monthly Review Pending: ${monthlyPendingReviewCount}.`
            : 'Monitor QC runs, review out-of-range results, and document corrective actions.'
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {canReviewCenter && (
            <Button variant="default" asChild>
              <Link href={buildQCReviewCenterHref(locale, { frequency: canMonthlyReview ? 'monthly' : 'daily', status: 'pending_review' })}>
                <ClipboardCheck className="h-4 w-4 me-2" />
                QC Review
                {canMonthlyReview && monthlyPendingReviewCount > 0 && (
                  <Badge variant="warning" className="ms-2 px-1.5 py-0">
                    {monthlyPendingReviewCount}
                  </Badge>
                )}
              </Link>
            </Button>
          )}
          <Button variant="outline" onClick={() => openReportExportDialog('pdf')} disabled={loading || !!error || records.length === 0}>
            <Download className="h-4 w-4 me-2" />PDF
          </Button>
          <Button variant="outline" onClick={() => openReportExportDialog('print')} disabled={loading || !!error || records.length === 0}>
            <Printer className="h-4 w-4 me-2" />Print
          </Button>
          {canViewDeleted && <ViewDeletedRecordsLink module="qc_records" locale={locale} />}
          {canQrAdmin && (
            <Button variant="outline" asChild>
              <Link href={`/${locale}/quality-control/qr-codes`}>
                <QrCode className="h-4 w-4 me-2" />
                QR Codes
              </Link>
            </Button>
          )}
          {canManage && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openAddDialog}><Plus className="h-4 w-4 me-2" />Add QC Record</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingId ? 'Edit QC Record' : 'Add QC Record'}</DialogTitle>
                </DialogHeader>
                <QCFormFields
                  form={form}
                  setForm={setForm}
                  instrumentOptions={instrumentOptions}
                  staffName={staffName}
                  saving={saving}
                  onSave={() => void saveRecord()}
                  saveLabel={saving ? tc('loading') : tc('save')}
                  isEditing={Boolean(editingId)}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </PageContentSections>

      {!loading && !error && (
        <p className="text-sm text-muted-foreground">
          {`${filtered.length} QC record${filtered.length === 1 ? '' : 's'}`}
        </p>
      )}

      {!loading && !error && canReviewCenter && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {canDailyReview && (
            <Link href={buildQCReviewCenterHref(locale, { frequency: 'daily', status: 'pending_review' })}>
              <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/30">
                <CardContent className="flex items-center justify-between gap-4 p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <CalendarDays className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold">Daily QC Pending Review</p>
                      <p className="text-2xl font-bold mt-1">{dailyPendingReviewCount}</p>
                      <p className="text-sm text-muted-foreground">Open Daily Review queue</p>
                    </div>
                  </div>
                  <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          )}
          {canMonthlyReview && (
            <Link href={buildQCReviewCenterHref(locale, { frequency: 'monthly', status: 'pending_review' })}>
              <Card className="h-full border-amber-500/30 bg-amber-50/40 transition-colors hover:border-amber-500/50 dark:bg-amber-950/20">
                <CardContent className="flex items-center justify-between gap-4 p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-amber-100 p-2 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                      <CalendarRange className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold">Monthly QC Review</p>
                      <p className="text-2xl font-bold mt-1">{monthlyPendingReviewCount} Pending</p>
                      <p className="text-sm text-muted-foreground">Quality Officer monthly review</p>
                    </div>
                  </div>
                  <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <StatCard title="QC Runs" value={summary.qcRuns} icon={FlaskConical} />
          <StatCard title="Parameter Results" value={summary.parameterResults} icon={FlaskConical} />
          <StatCard title="IN" value={summary.inCount} icon={FlaskConical} iconClassName="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" />
          <StatCard title="OUT" value={summary.outCount} icon={FlaskConical} iconClassName="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" />
          <StatCard title="Unresolved OUT" value={summary.unresolvedOut} icon={FlaskConical} iconClassName="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" />
          <StatCard title="OUT %" value={`${summary.outPercent}%`} icon={FlaskConical} />
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label>Instrument</Label>
            <Select
              value={filters.instrumentId}
              onValueChange={(v) => setFilters({
                ...filters,
                instrumentId: v,
                parameter: 'all',
                level: 'all',
              })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {instrumentOptions.map(({ id, name }) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Parameter</Label>
            <Select
              value={filters.parameter}
              onValueChange={(v) => setFilters({ ...filters, parameter: v, level: 'all' })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {parameterOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Level</Label>
            <Select
              value={filters.level}
              onValueChange={(v) => setFilters({ ...filters, level: v })}
              disabled={levelOptions.length === 0}
            >
              <SelectTrigger><SelectValue placeholder={levelOptions.length ? 'All' : 'Select instrument + parameter'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {levelOptions.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>QC Status</Label>
            <Select value={filters.qcStatus} onValueChange={(v) => setFilters({ ...filters, qcStatus: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {QC_IN_OUT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Resolution Status</Label>
            <Select
              value={filters.resolution}
              onValueChange={(v) => setFilters({ ...filters, resolution: v as typeof filters.resolution })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="unresolved">Unresolved</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Still OUT">Still OUT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date From</Label>
            <Input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
          </div>
          <div>
            <Label>Date To</Label>
            <Input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin me-2" />
          {tc('loading')}
        </div>
      )}

      {!loading && error && (
        <EmptyState title="Unable to load QC records" description={error} />
      )}

      {!loading && !error && records.length === 0 && (
        <EmptyState
          title="No QC records yet"
          description="Quality control records will appear here once entered."
        />
      )}

      {!loading && !error && records.length > 0 && filtered.length === 0 && (
        <EmptyState
          title="No matching records"
          description="Adjust filters to see QC records."
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <DataTable
          data={filtered}
          columns={columns}
          searchKey="parameter"
          searchPlaceholder="Search QC records..."
        />
      )}
      </div>

      <ReportDateRangeDialog
        open={dateRangeDialogOpen}
        onOpenChange={setDateRangeDialogOpen}
        moduleName="Quality Control Report"
        records={records}
        getRecordDate={getQCRecordDate}
        action={exportAction}
        onConfirm={handleReportDateRangeConfirm}
      />

      {printExport && (
        <QCPrintTable
          records={printExport.records}
          instrumentNames={instrumentNames}
          reportingPeriod={printExport.period}
        />
      )}

      <QCPrintFooter />

      <Dialog open={Boolean(viewRecord)} onOpenChange={(open) => { if (!open) setViewRecord(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>QC Record Details</DialogTitle>
          </DialogHeader>
          {viewRecord && (
            <QCRecordDetailSections
              record={viewRecord}
              instrumentName={getInstrumentName(viewRecord.instrumentId)}
              locale={locale}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reviewRecord)} onOpenChange={(open) => { if (!open) setReviewRecord(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review QC Record</DialogTitle>
          </DialogHeader>
          {reviewRecord && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {formatQCFrequencyLabel(reviewRecord.qcFrequency)} QC · {getInstrumentName(reviewRecord.instrumentId)} · {reviewRecord.parameter}
              </p>
              <QCDecisionField
                idPrefix="qc-review-decision"
                label="Review Decision"
                value={reviewForm.reviewDecision}
                onChange={(reviewDecision) => setReviewForm((prev) => ({ ...prev, reviewDecision }))}
              />
              <div>
                <Label htmlFor="qc-review-comment">Additional Comment</Label>
                <Textarea
                  id="qc-review-comment"
                  value={reviewForm.reviewComment ?? ''}
                  onChange={(e) => setReviewForm((prev) => ({ ...prev, reviewComment: e.target.value }))}
                  rows={3}
                />
              </div>
              <Button onClick={() => void saveReview()} className="w-full" disabled={saving}>
                {saving ? tc('loading') : 'Submit Review'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(approveRecord)} onOpenChange={(open) => { if (!open) setApproveRecord(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Supervisor Approval</DialogTitle>
          </DialogHeader>
          {approveRecord && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {formatQCFrequencyLabel(approveRecord.qcFrequency)} QC · Reviewed by {approveRecord.reviewedByName ?? '—'}
              </p>
              <QCDecisionField
                idPrefix="qc-approval-decision"
                label="Approval Decision"
                value={approvalForm.approvalDecision}
                onChange={(approvalDecision) => setApprovalForm((prev) => ({ ...prev, approvalDecision }))}
              />
              <div>
                <Label htmlFor="qc-approval-comment">Additional Comment</Label>
                <Textarea
                  id="qc-approval-comment"
                  value={approvalForm.approvalComment ?? ''}
                  onChange={(e) => setApprovalForm((prev) => ({ ...prev, approvalComment: e.target.value }))}
                  rows={3}
                />
              </div>
              <Button onClick={() => void saveApproval()} className="w-full" disabled={saving}>
                {saving ? tc('loading') : 'Approve QC Record'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SystemAdminDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDeletingId(null);
        }}
        onConfirm={confirmDelete}
        saving={deleteSaving}
      />
    </div>
  );
}
