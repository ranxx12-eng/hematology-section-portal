'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Eye, Download, Printer, Loader2, Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import autoTable from 'jspdf-autotable';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { StatCard } from '@/components/shared/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SampleRejectionFormFields, rejectionToForm, useRejectionDepartmentOptions } from '@/components/sample-rejections/rejection-form';
import { useAuth } from '@/components/providers/auth-provider';
import { maskPatientId, statusBadgeVariant } from '@/lib/page-utils';
import { downloadCSV, formatDate } from '@/lib/utils';
import {
  createSampleRejection,
  fetchSampleRejections,
  updateSampleRejection,
} from '@/lib/clinical/sample-rejections';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import {
  REJECTED_TESTS,
  REJECTED_TUBES,
  REJECTION_DEPARTMENTS,
  REJECTION_REASONS,
  REPLACEMENT_SAMPLE_STATUSES,
} from '@/lib/sample-rejections/constants';
import {
  emptySampleRejectionForm,
  sampleRejectionFormSchema,
  type SampleRejectionFormData,
} from '@/lib/sample-rejections/schema';
import { BRAND_COLORS } from '@/lib/brand/colors';
import { XCircle } from 'lucide-react';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { PrintReportFooter } from '@/components/print/print-report-footer';
import { PrintReportHeader } from '@/components/print/print-report-header';
import {
  createPdfWithReportChrome,
  getPdfAutoTableMargins,
} from '@/lib/print/pdf-report-chrome';
import type { SampleRejection } from '@/types';

export default function SampleRejectionsPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can, user } = useAuth();
  const canManage = can('sample_rejections.manage');
  const [records, setRecords] = useState<SampleRejection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewRecord, setViewRecord] = useState<SampleRejection | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SampleRejectionFormData>(() => emptySampleRejectionForm());
  const [staffContext, setStaffContext] = useState({ fullName: '', staffId: '', recordCreatedDate: '', recordCreatedTime: '' });
  const [filters, setFilters] = useState({
    dateFrom: '', dateTo: '', department: 'all', reason: 'all', test: 'all', tube: 'all',
    replacementStatus: 'all', reviewStatus: 'all', staff: 'all',
  });

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchSampleRejections();
    setRecords(result.data);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    if (!user) return;
    void resolveStaffContext(user).then((staff) => {
      const now = new Date();
      setStaffContext({
        fullName: staff.fullName,
        staffId: staff.staffId,
        recordCreatedDate: now.toISOString().slice(0, 10),
        recordCreatedTime: now.toTimeString().slice(0, 5),
      });
    });
  }, [user]);

  const accessDenied = !can('sample_rejections.view');
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);
  if (accessDenied) return null;

  const openAddDialog = () => {
    setEditingId(null);
    setForm(emptySampleRejectionForm());
    setDialogOpen(true);
  };

  const openEditDialog = (record: SampleRejection) => {
    setEditingId(record.id);
    setForm(rejectionToForm(record));
    setStaffContext({
      fullName: record.createdByStaffName,
      staffId: record.createdByStaffId,
      recordCreatedDate: record.recordCreatedDate,
      recordCreatedTime: record.recordCreatedTime,
    });
    setDialogOpen(true);
  };

  const saveRecord = async () => {
    if (!canManage || !user) return;

    const parsed = sampleRejectionFormSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Please complete all required fields');
      return;
    }

    setSaving(true);
    const result = editingId
      ? await updateSampleRejection(editingId, parsed.data)
      : await createSampleRejection(await resolveStaffContext(user), parsed.data);
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(editingId ? 'Sample rejection updated' : 'Sample rejection recorded');
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptySampleRejectionForm());
    await loadRecords();
  };

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (filters.dateFrom && r.rejectionDate < filters.dateFrom) return false;
      if (filters.dateTo && r.rejectionDate > filters.dateTo) return false;
      if (filters.department !== 'all' && r.department !== filters.department) return false;
      if (filters.reason !== 'all' && !r.rejectionReasons.includes(filters.reason)) return false;
      if (filters.test !== 'all' && !r.rejectedTests.includes(filters.test)) return false;
      if (filters.tube !== 'all' && r.rejectedTube !== filters.tube) return false;
      if (filters.replacementStatus !== 'all' && r.replacementSampleStatus !== filters.replacementStatus) return false;
      if (filters.reviewStatus !== 'all' && r.supervisorReviewStatus !== filters.reviewStatus) return false;
      if (filters.staff !== 'all' && r.createdByStaffName !== filters.staff) return false;
      return true;
    });
  }, [records, filters]);

  const reasonStats = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((r) => r.rejectionReasons.forEach((reason) => { counts[reason] = (counts[reason] || 0) + 1; }));
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const staffOptions = useMemo(
    () => [...new Set(records.map((r) => r.createdByStaffName))].sort(),
    [records],
  );

  const departmentOptions = useRejectionDepartmentOptions(records);

  const exportCsv = () => {
    const headers = ['Patient ID', 'Patient Name', 'ACC#', 'Department', 'Date', 'Time', 'Tests', 'Tube', 'Reasons', 'Replacement Status', 'Review Status'];
    const rows = filtered.map((r) => [
      r.patientId, r.patientName, r.patientLabAccNumber, r.department, r.rejectionDate, r.rejectionTime,
      r.rejectedTests.join('; '), r.rejectedTube, r.rejectionReasons.join('; '),
      r.replacementSampleStatus, r.supervisorReviewStatus,
    ]);
    downloadCSV('sample-rejections.csv', headers, rows);
    toast.success('CSV exported');
  };

  const exportPdf = async () => {
    const { doc, tableStartY, onDrawPage } = await createPdfWithReportChrome('sampleRejections');
    autoTable(doc, {
      startY: tableStartY,
      margin: getPdfAutoTableMargins(),
      head: [['Patient', 'ACC#', 'Department', 'Date', 'Tests', 'Tube', 'Reasons', 'Status']],
      body: filtered.map((r) => [
        r.patientName, r.patientLabAccNumber, r.department, r.rejectionDate,
        r.rejectedTests.join(', '), r.rejectedTube, r.rejectionReasons.join(', '), r.replacementSampleStatus,
      ]),
      didDrawPage: onDrawPage,
    });
    doc.save('sample-rejections.pdf');
    toast.success('PDF exported');
  };

  const columns: ColumnDef<SampleRejection>[] = useMemo(() => [
    { accessorKey: 'rejectionDate', header: 'Date', cell: ({ row }) => formatDate(row.original.rejectionDate, locale) },
    { accessorKey: 'patientId', header: 'Patient ID', cell: ({ row }) => <span className="font-mono">{maskPatientId(row.original.patientId)}</span> },
    { accessorKey: 'patientName', header: 'Patient Name' },
    { accessorKey: 'patientLabAccNumber', header: 'ACC#' },
    { accessorKey: 'department', header: 'Department' },
    { accessorKey: 'rejectedTests', header: 'Tests', cell: ({ row }) => row.original.rejectedTests.join(', ') },
    { accessorKey: 'rejectedTube', header: 'Tube' },
    { accessorKey: 'rejectionReasons', header: 'Reasons', cell: ({ row }) => row.original.rejectionReasons.join(', ') },
    { accessorKey: 'supervisorReviewStatus', header: 'Review', cell: ({ row }) => (
      <Badge variant={row.original.supervisorReviewStatus === 'reviewed' ? 'success' : 'warning'}>
        {row.original.supervisorReviewStatus === 'reviewed' ? 'Reviewed' : 'Pending'}
      </Badge>
    )},
    { accessorKey: 'replacementSampleStatus', header: 'Replacement', cell: ({ row }) => (
      <Badge variant={statusBadgeVariant(row.original.replacementSampleStatus)}>{row.original.replacementSampleStatus}</Badge>
    )},
    {
      id: 'actions', header: tc('actions'),
      cell: ({ row }) => (
        <div className="flex gap-1 print:hidden">
          <Button size="sm" variant="ghost" onClick={() => setViewRecord(row.original)}>
            <Eye className="h-4 w-4" />
          </Button>
          {canManage && (
            <Button size="sm" variant="ghost" onClick={() => openEditDialog(row.original)}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ], [canManage, locale, tc]);

  return (
    <div className="clinical-print-report space-y-6">
      <PrintReportHeader />

      <div className="print:hidden">
        <PageContentSections
          pageKey="sample_rejections"
          fallbackTitle={tc('sampleRejections')}
          fallbackSubtitle="Document rejected samples and track replacement sample status."
        >
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportCsv} disabled={loading || !!error}><Download className="h-4 w-4 me-2" />CSV</Button>
            <Button variant="outline" onClick={() => void exportPdf()} disabled={loading || !!error}><Download className="h-4 w-4 me-2" />PDF</Button>
            <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 me-2" />Print</Button>
            {canManage && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openAddDialog}>
                    <Plus className="h-4 w-4 me-2" />Add Sample Rejection
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingId ? 'Edit Sample Rejection' : 'Add Sample Rejection'}</DialogTitle>
                  </DialogHeader>
                  <SampleRejectionFormFields
                    key={editingId ?? 'new-sample-rejection'}
                    form={form}
                    staffName={staffContext.fullName}
                    staffId={staffContext.staffId}
                    recordCreatedDate={staffContext.recordCreatedDate}
                    recordCreatedTime={staffContext.recordCreatedTime}
                    departmentOptions={departmentOptions}
                    onChange={setForm}
                  />
                  <Button onClick={() => void saveRecord()} className="w-full" disabled={saving}>
                    {saving ? tc('loading') : tc('save')}
                  </Button>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </PageContentSections>

        {!loading && !error && (
          <p className="text-sm text-muted-foreground">{filtered.length} rejections</p>
        )}

        <Card>
          <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div><Label>Date From</Label><Input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} /></div>
            <div><Label>Date To</Label><Input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} /></div>
            <div><Label>Department</Label>
              <Select value={filters.department} onValueChange={(v) => setFilters({ ...filters, department: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All</SelectItem>{REJECTION_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Reason</Label>
              <Select value={filters.reason} onValueChange={(v) => setFilters({ ...filters, reason: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All</SelectItem>{REJECTION_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Test</Label>
              <Select value={filters.test} onValueChange={(v) => setFilters({ ...filters, test: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All</SelectItem>{REJECTED_TESTS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Tube</Label>
              <Select value={filters.tube} onValueChange={(v) => setFilters({ ...filters, tube: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All</SelectItem>{REJECTED_TUBES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Replacement Status</Label>
              <Select value={filters.replacementStatus} onValueChange={(v) => setFilters({ ...filters, replacementStatus: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All</SelectItem>{REPLACEMENT_SAMPLE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Review Status</Label>
              <Select value={filters.reviewStatus} onValueChange={(v) => setFilters({ ...filters, reviewStatus: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending_supervisor_review">Pending</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Staff</Label>
              <Select value={filters.staff} onValueChange={(v) => setFilters({ ...filters, staff: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {staffOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
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
          <EmptyState title="Unable to load sample rejections" description={error} />
        )}

        {!loading && !error && (
          <>
            <div className="grid gap-4 sm:grid-cols-4">
              <StatCard title="Total Rejections" value={filtered.length} icon={XCircle} iconClassName="bg-destructive/10 text-destructive" />
              <StatCard title="Pending Review" value={filtered.filter((r) => r.supervisorReviewStatus === 'pending_supervisor_review').length} icon={XCircle} iconClassName="bg-warning/10 text-warning" />
              <StatCard title="Awaiting Replacement" value={filtered.filter((r) => r.replacementSampleStatus === 'Awaiting Replacement Sample').length} icon={XCircle} iconClassName="bg-accent/10 text-accent" />
              <StatCard title="Discard Due" value={filtered.filter((r) => r.discardStatus === 'discard_due').length} icon={XCircle} iconClassName="bg-warning/10 text-warning" />
            </div>

            {filtered.length === 0 ? (
              <EmptyState title="No sample rejections" description="Sample rejection records will appear here once recorded in Supabase." />
            ) : (
              <Card>
                <CardHeader><CardTitle>Rejection Reasons</CardTitle></CardHeader>
                <CardContent>
                  {reasonStats.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No reason data for current filters.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={reasonStats} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                          {reasonStats.map((_, i) => <Cell key={i} fill={BRAND_COLORS.chart[i % BRAND_COLORS.chart.length]} />)}
                        </Pie>
                        <Tooltip /><Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        <Dialog open={!!viewRecord} onOpenChange={(open) => !open && setViewRecord(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Sample Rejection Details</DialogTitle></DialogHeader>
            {viewRecord && (
              <div className="space-y-4 text-sm">
                <SampleRejectionFormFields
                  form={rejectionToForm(viewRecord)}
                  staffName={viewRecord.createdByStaffName}
                  staffId={viewRecord.createdByStaffId}
                  recordCreatedDate={viewRecord.recordCreatedDate}
                  recordCreatedTime={viewRecord.recordCreatedTime}
                  departmentOptions={departmentOptions}
                  readOnly
                  onChange={() => undefined}
                />
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <p><strong>Supervisor Review:</strong> {viewRecord.supervisorReviewStatus === 'reviewed' ? `Reviewed by ${viewRecord.reviewedByName} on ${viewRecord.reviewedDate} at ${viewRecord.reviewedTime}` : 'Pending Supervisor Review'}</p>
                  {viewRecord.replacementReceivedDate && <p><strong>Replacement Received:</strong> {viewRecord.replacementReceivedDate} at {viewRecord.replacementReceivedTime} by {viewRecord.replacementReceivedByName}</p>}
                  {viewRecord.completionDate && <p><strong>Completed:</strong> {viewRecord.completionDate} at {viewRecord.completionTime} by {viewRecord.completedByName}</p>}
                  {viewRecord.discardDate && <p><strong>Discarded:</strong> {viewRecord.discardDate} at {viewRecord.discardTime} by {viewRecord.discardedByName}</p>}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {!loading && !error && filtered.length > 0 && (
        <DataTable data={filtered} columns={columns} searchKey="patientName" searchPlaceholder="Search rejections..." />
      )}

      <PrintReportFooter formKey="sampleRejections" />
    </div>
  );
}
