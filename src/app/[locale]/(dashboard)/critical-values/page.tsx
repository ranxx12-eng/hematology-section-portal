'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2, Eye, EyeOff, Pencil, Loader2, Download, Printer, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { AccessionFieldWithScan } from '@/components/clinical/accession-field-with-scan';
import { CreatableDepartmentCombobox } from '@/components/clinical/creatable-department-combobox';
import { getTubeForTests, getTubesForTestsList, useSampleTubeAutoFill } from '@/components/clinical/sample-test-tube-fields';
import { MultiSelectField } from '@/components/shared/multi-select-field';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { lookupPatientByAccession } from '@/lib/clinical/accession-lookup';
import { maskPatientId } from '@/lib/page-utils';
import { formatDate, downloadCSV } from '@/lib/utils';
import {
  createCriticalValue,
  deleteCriticalValue,
  fetchCriticalValues,
  reviewCriticalValue,
  updateCriticalValue,
} from '@/lib/clinical/critical-values';
import { canReviewCriticalValue } from '@/lib/critical-values/permissions';
import {
  CRITICAL_VALUE_REVIEW_STATUSES,
  criticalValueReviewSchema,
  type CriticalValueReviewData,
} from '@/lib/critical-values/review-schema';
import {
  CRITICAL_VALUE_DEPARTMENTS,
  CRITICAL_VALUE_ESCALATION_OPTIONS,
  CRITICAL_VALUE_TESTS,
  CRITICAL_VALUE_TUBES,
  criticalValueFormSchema,
  displayEscalationTo,
  emptyCriticalValueForm,
  formatReadBack,
  formatTestsList,
  type CriticalValueFormData,
  type CriticalValueFormDraft,
} from '@/lib/critical-values/schema';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { CriticalValuesPrintFooter, CriticalValuesPrintHeader } from '@/components/print/critical-values-print-chrome';
import { CriticalValuesPrintTable } from '@/components/print/critical-values-print-table';
import { ReportDateRangeDialog, type ReportExportAction } from '@/components/print/report-date-range-dialog';
import { SystemAdminDeleteDialog } from '@/components/records/system-admin-delete-dialog';
import { ViewDeletedRecordsLink } from '@/components/records/view-deleted-records-link';
import { createCriticalValuesPdf } from '@/lib/print/critical-values-report';
import { formatReportingPeriodLabel, type ReportDateRange } from '@/lib/print/report-date-range';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import { canSoftDeleteModule } from '@/lib/records/restore';
import '@/styles/critical-values-print.css';
import type { CriticalValue } from '@/types';

function recordToForm(record: CriticalValue): CriticalValueFormData {
  return {
    date: record.date,
    patientId: record.patientId,
    patientName: record.patientName,
    patientAccNumber: record.patientAccNumber,
    tests: record.tests,
    sampleTube: '',
    criticalValue: record.criticalValue,
    informedToDr: record.informedToDr,
    drId: record.drId,
    verifyTime: record.verifyTime,
    informedTime: record.informedTime,
    department: record.department,
    escalationTo: displayEscalationTo(record.escalationTo),
    readBack: formatReadBack(record.readBack),
    comment: record.comment ?? '',
    initial: record.initial,
  };
}

export default function CriticalValuesPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can, user, role } = useAuth();
  const canManage = can('critical_values.manage');
  const canDelete = canSoftDeleteModule('critical_values', can);
  const canViewDeleted = can('records.restore');
  const [records, setRecords] = useState<CriticalValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewingRecord, setReviewingRecord] = useState<CriticalValue | null>(null);
  const [reviewForm, setReviewForm] = useState<CriticalValueReviewData>({
    reviewStatus: 'Reviewed',
    reviewComment: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CriticalValueFormDraft>(() => emptyCriticalValueForm(user?.fullName ?? ''));
  const [dateRangeDialogOpen, setDateRangeDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [exportAction, setExportAction] = useState<ReportExportAction>('print');
  const [printExport, setPrintExport] = useState<{ records: CriticalValue[]; period: string } | null>(null);

  const { resetAutoTubeGuard, applyTubeForTests } = useSampleTubeAutoFill({
    onTubeChange: (sampleTube) => setForm((prev) => ({ ...prev, sampleTube })),
  });

  const departmentOptions = useMemo(() => {
    const fromRecords = records.map((record) => record.department);
    return [...new Set([...CRITICAL_VALUE_DEPARTMENTS, ...fromRecords])].sort();
  }, [records]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchCriticalValues();
    setRecords(result.data);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    if (user?.fullName && !editingId) {
      setForm((prev) => ({ ...prev, initial: user.fullName }));
    }
  }, [user?.fullName, editingId]);

  const accessDenied = !can('critical_values.view');
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);
  if (accessDenied) return null;

  const openAddDialog = () => {
    setEditingId(null);
    setForm(emptyCriticalValueForm(user?.fullName ?? ''));
    resetAutoTubeGuard();
    setDialogOpen(true);
  };

  const openEditDialog = (record: CriticalValue) => {
    setEditingId(record.id);
    setForm(recordToForm(record));
    resetAutoTubeGuard();
    setDialogOpen(true);
  };

  const handleAccessionLookup = async (accession: string) => {
    const trimmed = accession.trim();
    if (!trimmed) return;

    setLookupLoading(true);
    const result = await lookupPatientByAccession(trimmed);
    setLookupLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    if (result.data) {
      setForm((prev) => ({
        ...prev,
        patientAccNumber: result.data!.accession,
        patientId: result.data!.patientId,
        patientName: result.data!.patientName,
      }));
      toast.success('Patient details loaded from prior record');
    }
  };

  const toggleReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveRecord = async () => {
    if (!canManage || !user) return;

    const parsed = criticalValueFormSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Please complete all required fields');
      return;
    }

    setSaving(true);
    const result = editingId
      ? await updateCriticalValue(editingId, user.id, parsed.data)
      : await createCriticalValue(user.id, parsed.data);
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(editingId ? 'Critical value updated' : 'Critical value recorded');
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyCriticalValueForm(user.fullName));
    await loadRecords();
  };

  const openDeleteDialog = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async (deleteReason?: string) => {
    if (!deletingId || !user) return;
    setDeleteSaving(true);
    const staff = await resolveStaffContext(user);
    const result = await deleteCriticalValue(deletingId, staff, deleteReason);
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

  const openReviewDialog = (record: CriticalValue) => {
    setReviewingRecord(record);
    setReviewForm({
      reviewStatus: record.reviewStatus === 'Needs Follow-up' ? 'Needs Follow-up' : 'Reviewed',
      reviewComment: record.reviewComment ?? '',
    });
    setReviewDialogOpen(true);
  };

  const saveReview = async () => {
    if (!user || !reviewingRecord || !role) return;

    const parsed = criticalValueReviewSchema.safeParse(reviewForm);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Please complete review fields');
      return;
    }

    if (!canReviewCriticalValue(can, reviewingRecord)) {
      toast.error('You are not authorized to review this record');
      return;
    }

    setSaving(true);
    const result = await reviewCriticalValue(reviewingRecord.id, user.id, parsed.data);
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success('Critical value review saved');
    setReviewDialogOpen(false);
    setReviewingRecord(null);
    await loadRecords();
  };

  const exportCsv = () => {
    const headers = [
      'Date', 'Patient ID', 'Patient Name', 'Lab Accession', 'Tests', 'Critical Value',
      'Informed to Dr', 'Dr ID', 'Department', 'Escalation To', 'Verify Time', 'Informed Time', 'Read Back', 'Initial',
    ];
    const rows = records.map((r) => [
      r.date, r.patientId, r.patientName, r.patientAccNumber, formatTestsList(r.tests), r.criticalValue,
      r.informedToDr, r.drId, r.department, displayEscalationTo(r.escalationTo),
      r.verifyTime, r.informedTime, formatReadBack(r.readBack), r.initial,
    ]);
    downloadCSV('critical-values.csv', headers, rows);
    toast.success('CSV exported');
  };

  const openReportExportDialog = (action: ReportExportAction) => {
    setExportAction(action);
    setDateRangeDialogOpen(true);
  };

  const handleReportDateRangeConfirm = (range: ReportDateRange, filteredRecords: CriticalValue[]) => {
    const period = formatReportingPeriodLabel(range, locale);
    setDateRangeDialogOpen(false);

    if (exportAction === 'pdf') {
      void createCriticalValuesPdf(filteredRecords, period).then((doc) => {
        doc.save('critical-values.pdf');
        toast.success('PDF exported');
      });
      return;
    }

    setPrintExport({ records: filteredRecords, period });
    window.setTimeout(() => window.print(), 50);
  };

  const getCriticalValueRecordDate = useCallback((record: CriticalValue) => record.date, []);

  const columns: ColumnDef<CriticalValue>[] = useMemo(() => [
    { accessorKey: 'date', header: 'Date', cell: ({ row }) => formatDate(row.original.date, locale) },
    {
      accessorKey: 'patientId',
      header: 'Patient ID',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-mono">{revealed.has(row.original.id) ? row.original.patientId : maskPatientId(row.original.patientId)}</span>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 print:hidden" onClick={() => toggleReveal(row.original.id)}>
            {revealed.has(row.original.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </Button>
        </div>
      ),
    },
    { accessorKey: 'patientName', header: 'Patient Name' },
    { accessorKey: 'patientAccNumber', header: 'Lab Accession' },
    {
      accessorKey: 'tests',
      header: 'Tests',
      cell: ({ row }) => formatTestsList(row.original.tests, ', '),
    },
    {
      accessorKey: 'readBack',
      header: 'Read Back',
      cell: ({ row }) => formatReadBack(row.original.readBack),
    },
    { accessorKey: 'criticalValue', header: 'Critical Value' },
    { accessorKey: 'informedToDr', header: 'Informed to Dr' },
    { accessorKey: 'department', header: 'Department' },
    {
      accessorKey: 'escalationTo',
      header: 'Escalation To',
      cell: ({ row }) => displayEscalationTo(row.original.escalationTo),
    },
    { accessorKey: 'verifyTime', header: 'Verify Time' },
    { accessorKey: 'informedTime', header: 'Informed Time' },
    { accessorKey: 'initial', header: 'Initial' },
    {
      accessorKey: 'reviewStatus',
      header: 'Review',
      cell: ({ row }) => (
        <Badge variant={row.original.reviewStatus === 'Reviewed' ? 'success' : row.original.reviewStatus === 'Needs Follow-up' ? 'warning' : 'secondary'}>
          {row.original.reviewStatus}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: tc('actions'),
      cell: ({ row }) => (
        <div className="flex gap-1 print:hidden">
          {canReviewCriticalValue(can, row.original) && (
            <Button size="sm" variant="ghost" onClick={() => openReviewDialog(row.original)} title="Review">
              <ClipboardCheck className="h-4 w-4" />
            </Button>
          )}
          {canManage ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => openEditDialog(row.original)}>
                <Pencil className="h-4 w-4" />
              </Button>
              {canDelete && (
                <Button size="sm" variant="ghost" onClick={() => openDeleteDialog(row.original.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </>
          ) : null}
        </div>
      ),
    },
  ], [can, canDelete, canManage, locale, revealed, role, tc]);

  const unifiedTube = getTubeForTests(form.tests);
  const applicableTubes = getTubesForTestsList(form.tests);

  const formFields = (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto pe-1">
      <CreatableDepartmentCombobox
        id="cv-department"
        label="Department"
        value={form.department}
        options={departmentOptions}
        required
        onChange={(department) => setForm({ ...form, department })}
      />
      <AccessionFieldWithScan
        id="cv-lab-accession"
        value={form.patientAccNumber}
        required
        onChange={(patientAccNumber) => setForm({ ...form, patientAccNumber })}
        onScanComplete={(accession) => void handleAccessionLookup(accession)}
      />
      {lookupLoading && (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          Looking up accession…
        </p>
      )}
      <div>
        <Label htmlFor="cv-patient-id">Patient ID *</Label>
        <Input id="cv-patient-id" value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} required />
      </div>
      <div>
        <Label htmlFor="cv-patient-name">Patient Name *</Label>
        <Input id="cv-patient-name" value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} required />
      </div>
      <div>
        <Label htmlFor="cv-date">Date *</Label>
        <Input id="cv-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
        <MultiSelectField
          id="cv-tests"
          label="Tests"
          options={CRITICAL_VALUE_TESTS}
          selected={form.tests}
          required
          onChange={(tests) => {
            setForm({ ...form, tests });
            applyTubeForTests(tests);
          }}
        />
        <div>
          <Label htmlFor="cv-read-back">Read Back *</Label>
          <Select
            value={form.readBack ?? ''}
            onValueChange={(readBack) => setForm({ ...form, readBack: readBack as CriticalValueFormData['readBack'] })}
          >
            <SelectTrigger id="cv-read-back"><SelectValue placeholder="Select Yes or No" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Yes">Yes</SelectItem>
              <SelectItem value="No">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="cv-sample-tube">Sample Tube *</Label>
        <Input
          id="cv-sample-tube"
          list="cv-sample-tube-options"
          value={form.sampleTube}
          placeholder="Auto-filled from test or enter manually"
          onChange={(e) => setForm({ ...form, sampleTube: e.target.value })}
          required
        />
        <datalist id="cv-sample-tube-options">
          {CRITICAL_VALUE_TUBES.map((tube) => (
            <option key={tube} value={tube} />
          ))}
        </datalist>
        {unifiedTube && form.sampleTube !== unifiedTube && (
          <p className="mt-1 text-xs text-muted-foreground">Suggested tube for selected tests: {unifiedTube}</p>
        )}
        {!unifiedTube && applicableTubes.length > 1 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Selected tests require: {applicableTubes.join(', ')}
          </p>
        )}
        {form.tests.length > 0 && applicableTubes.length === 0 && (
          <p className="mt-1 text-xs text-muted-foreground">No tube mapping for selected tests — enter manually.</p>
        )}
      </div>
      <div>
        <Label htmlFor="cv-critical-value">Critical Value *</Label>
        <Input id="cv-critical-value" value={form.criticalValue} onChange={(e) => setForm({ ...form, criticalValue: e.target.value })} required />
      </div>
      <div>
        <Label htmlFor="cv-informed-dr">Informed to Dr *</Label>
        <Input id="cv-informed-dr" value={form.informedToDr} onChange={(e) => setForm({ ...form, informedToDr: e.target.value })} required />
      </div>
      <div>
        <Label htmlFor="cv-escalation">In Case of Escalation *</Label>
        <Select
          value={form.escalationTo}
          onValueChange={(escalationTo) => setForm({ ...form, escalationTo: escalationTo as CriticalValueFormData['escalationTo'] })}
        >
          <SelectTrigger id="cv-escalation"><SelectValue placeholder="Select escalation contact" /></SelectTrigger>
          <SelectContent>
            {CRITICAL_VALUE_ESCALATION_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="cv-dr-id">Dr ID *</Label>
        <Input id="cv-dr-id" value={form.drId} onChange={(e) => setForm({ ...form, drId: e.target.value })} required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="cv-verify-time">Verify Time *</Label>
          <Input id="cv-verify-time" type="time" value={form.verifyTime} onChange={(e) => setForm({ ...form, verifyTime: e.target.value })} required />
        </div>
        <div>
          <Label htmlFor="cv-informed-time">Informed Time *</Label>
          <Input id="cv-informed-time" type="time" value={form.informedTime} onChange={(e) => setForm({ ...form, informedTime: e.target.value })} required />
        </div>
      </div>
      <div>
        <Label htmlFor="cv-comment">Comment</Label>
        <Textarea id="cv-comment" value={form.comment ?? ''} onChange={(e) => setForm({ ...form, comment: e.target.value })} rows={3} />
      </div>
      <div>
        <Label htmlFor="cv-initial">Initial *</Label>
        <Input id="cv-initial" value={form.initial} readOnly disabled className="bg-muted" />
      </div>
      <Button onClick={() => void saveRecord()} className="w-full" disabled={saving}>
        {saving ? tc('loading') : tc('save')}
      </Button>
    </div>
  );

  return (
    <div className="clinical-print-report critical-values-print-report space-y-6">
      <CriticalValuesPrintHeader />

      <div className="print:hidden">
        <PageContentSections
          pageKey="critical_values"
          fallbackTitle={tc('criticalValues')}
          fallbackSubtitle="Patient IDs are masked by default"
        >
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportCsv} disabled={loading || !!error || records.length === 0}>
              <Download className="h-4 w-4 me-2" />CSV
            </Button>
            <Button variant="outline" onClick={() => openReportExportDialog('pdf')} disabled={loading || !!error || records.length === 0}>
              <Download className="h-4 w-4 me-2" />PDF
            </Button>
            <Button variant="outline" onClick={() => openReportExportDialog('print')} disabled={loading || !!error || records.length === 0}>
              <Printer className="h-4 w-4 me-2" />Print
            </Button>
            {canViewDeleted && <ViewDeletedRecordsLink module="critical_values" locale={locale} />}
            {canManage && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openAddDialog}>
                    <Plus className="h-4 w-4 me-2" />Add Critical Value
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl">
                  <DialogHeader>
                    <DialogTitle>{editingId ? 'Edit Critical Value' : 'Add Critical Value'}</DialogTitle>
                  </DialogHeader>
                  {formFields}
                </DialogContent>
              </Dialog>
            )}
          </div>
        </PageContentSections>

        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Review Critical Value</DialogTitle>
            </DialogHeader>
            {reviewingRecord && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {reviewingRecord.patientName} · {formatTestsList(reviewingRecord.tests, ', ')} · {reviewingRecord.criticalValue}
                </p>
                <div>
                  <Label htmlFor="cv-review-status">Review Status *</Label>
                  <Select
                    value={reviewForm.reviewStatus}
                    onValueChange={(value) => setReviewForm({ ...reviewForm, reviewStatus: value as CriticalValueReviewData['reviewStatus'] })}
                  >
                    <SelectTrigger id="cv-review-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CRITICAL_VALUE_REVIEW_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="cv-review-comment">Review Comment</Label>
                  <Textarea
                    id="cv-review-comment"
                    value={reviewForm.reviewComment ?? ''}
                    onChange={(e) => setReviewForm({ ...reviewForm, reviewComment: e.target.value })}
                    rows={3}
                  />
                </div>
                <Button onClick={() => void saveReview()} className="w-full" disabled={saving}>
                  {saving ? tc('loading') : 'Save Review'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin me-2" />
            {tc('loading')}
          </div>
        )}

        {!loading && error && (
          <EmptyState title="Unable to load critical values" description={error} />
        )}

        {!loading && !error && records.length === 0 && (
          <EmptyState title="No critical values recorded" description="Critical value records will appear here once added." />
        )}
      </div>

      <ReportDateRangeDialog
        open={dateRangeDialogOpen}
        onOpenChange={setDateRangeDialogOpen}
        moduleName="Critical Values Report"
        records={records}
        getRecordDate={getCriticalValueRecordDate}
        action={exportAction}
        onConfirm={handleReportDateRangeConfirm}
      />

      {!loading && !error && records.length > 0 && (
        <>
          <div className="print:hidden">
            <DataTable data={records} columns={columns} searchKey="test" searchPlaceholder="Search critical values..." />
          </div>
          {printExport && (
            <CriticalValuesPrintTable records={printExport.records} reportingPeriod={printExport.period} />
          )}
        </>
      )}

      <CriticalValuesPrintFooter />

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
