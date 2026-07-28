'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Eye, Pencil, Download, Printer, ShieldCheck, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DataTable } from '@/components/shared/data-table';
import { StatCard } from '@/components/shared/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SampleRejectionFormFields, rejectionToForm } from '@/components/sample-rejections/rejection-form';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { appendAuditLog, maskPatientId, statusBadgeVariant } from '@/lib/page-utils';
import { downloadCSV, formatDate } from '@/lib/utils';
import {
  REJECTED_TESTS,
  REJECTED_TUBES,
  REJECTION_DEPARTMENTS,
  REJECTION_REASONS,
  REPLACEMENT_SAMPLE_STATUSES,
} from '@/lib/sample-rejections/constants';
import {
  canConfirmDiscard,
  canConfirmSupervisorReview,
  isWorkflowLocked,
} from '@/lib/sample-rejections/permissions';
import {
  emptySampleRejectionForm,
  sampleRejectionFormSchema,
  type SampleRejectionFormData,
} from '@/lib/sample-rejections/schema';
import {
  buildSampleRejection,
  createPendingSampleFromRejection,
  getRetentionDays,
  resolveStaffContext,
  syncDiscardDueStatuses,
} from '@/lib/sample-rejections/workflow';
import { XCircle } from 'lucide-react';
import type { SampleRejection } from '@/types';

const COLORS = ['#2563eb', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#0ea5e9', '#ec4899', '#64748b'];

export default function SampleRejectionsPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user, role } = useAuth();
  const canManage = can('sample_rejections.manage');
  const [db, setDb] = useState(() => getMockDatabase());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState<SampleRejection | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SampleRejectionFormData>(emptySampleRejectionForm());
  const [filters, setFilters] = useState({
    dateFrom: '', dateTo: '', department: 'all', reason: 'all', test: 'all', tube: 'all',
    replacementStatus: 'all', reviewStatus: 'all', staff: 'all',
  });

  const refresh = useCallback(() => {
    const next = getMockDatabase();
    syncDiscardDueStatuses(next.sampleRejections, next.pendingSamples, next.employees, next.notifications, getRetentionDays(next.settings));
    saveMockDatabase(next);
    setDb(next);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const staff = useMemo(() => {
    if (!user) return { userId: '', fullName: '', staffId: '' };
    return resolveStaffContext(user.id, user.fullName, db.employees);
  }, [user, db.employees]);

  const nowMeta = useMemo(() => {
    const now = new Date();
    return { date: now.toISOString().slice(0, 10), time: now.toTimeString().slice(0, 5) };
  }, [dialogOpen]);

  if (!can('sample_rejections.view')) {
    router.replace(`/${locale}/unauthorized`);
    return null;
  }

  const filtered = useMemo(() => {
    return db.sampleRejections.filter((r) => {
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
  }, [db.sampleRejections, filters]);

  const reasonStats = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((r) => r.rejectionReasons.forEach((reason) => { counts[reason] = (counts[reason] || 0) + 1; }));
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptySampleRejectionForm());
    setDialogOpen(true);
  };

  const openEdit = (record: SampleRejection) => {
    if (isWorkflowLocked(record)) {
      toast.error('Completed or discarded records cannot be edited');
      return;
    }
    setEditingId(record.id);
    setForm(rejectionToForm(record));
    setDialogOpen(true);
  };

  const saveRecord = () => {
    if (!canManage || !user) return;
    const parsed = sampleRejectionFormSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Validation failed');
      return;
    }

    const retentionDays = getRetentionDays(db.settings);
    const now = new Date().toISOString();

    if (editingId) {
      const idx = db.sampleRejections.findIndex((r) => r.id === editingId);
      if (idx < 0) return;
      const existing = db.sampleRejections[idx];
      db.sampleRejections[idx] = {
        ...buildSampleRejection(parsed.data, staff, retentionDays, editingId),
        supervisorReviewStatus: existing.supervisorReviewStatus,
        reviewedByUserId: existing.reviewedByUserId,
        reviewedByName: existing.reviewedByName,
        reviewedByStaffId: existing.reviewedByStaffId,
        reviewedDate: existing.reviewedDate,
        reviewedTime: existing.reviewedTime,
        replacementSampleStatus: existing.replacementSampleStatus,
        pendingSampleId: existing.pendingSampleId,
        createdAt: existing.createdAt,
        updatedAt: now,
      };
      appendAuditLog(db, user.id, 'update', 'sample_rejections', editingId, undefined, JSON.stringify(parsed.data));
      toast.success('Rejection updated');
    } else {
      const duplicateAcc = db.sampleRejections.some((r) => r.patientLabAccNumber === parsed.data.patientLabAccNumber && r.replacementSampleStatus !== 'Completed' && r.replacementSampleStatus !== 'Discarded');
      if (duplicateAcc) {
        toast.error('An active rejection already exists for this Patient Lab ACC#');
        return;
      }
      const rejection = buildSampleRejection(parsed.data, staff, retentionDays);
      const pending = createPendingSampleFromRejection(rejection, staff);
      rejection.pendingSampleId = pending.id;
      db.sampleRejections.unshift(rejection);
      db.pendingSamples.unshift(pending);
      appendAuditLog(db, user.id, 'create', 'sample_rejections', rejection.id);
      appendAuditLog(db, user.id, 'create', 'pending_samples', pending.id);
      toast.success('Rejection recorded and pending sample created');
    }

    syncDiscardDueStatuses(db.sampleRejections, db.pendingSamples, db.employees, db.notifications, retentionDays);
    saveMockDatabase(db);
    refresh();
    setDialogOpen(false);
    setEditingId(null);
  };

  const confirmSupervisorReview = (record: SampleRejection) => {
    if (!user || !role || !canConfirmSupervisorReview(role, user.id, record)) return;
    if (!confirm('Confirm supervisor review for this rejection?')) return;
    const now = new Date();
    const idx = db.sampleRejections.findIndex((r) => r.id === record.id);
    if (idx < 0) return;
    db.sampleRejections[idx] = {
      ...db.sampleRejections[idx],
      supervisorReviewStatus: 'reviewed',
      reviewedByUserId: user.id,
      reviewedByName: staff.fullName,
      reviewedByStaffId: staff.staffId,
      reviewedDate: now.toISOString().slice(0, 10),
      reviewedTime: now.toTimeString().slice(0, 5),
      updatedAt: now.toISOString(),
    };
    appendAuditLog(db, user.id, 'approve', 'sample_rejections', record.id);
    saveMockDatabase(db);
    refresh();
    toast.success('Supervisor review confirmed');
  };

  const confirmDiscard = (record: SampleRejection) => {
    if (!user || !role || !canConfirmDiscard(role)) return;
    if (record.replacementSampleStatus === 'Completed') {
      toast.error('Completed samples cannot be discarded');
      return;
    }
    if (!confirm('Confirm sample discard?')) return;
    const now = new Date();
    const idx = db.sampleRejections.findIndex((r) => r.id === record.id);
    if (idx < 0) return;
    db.sampleRejections[idx] = {
      ...db.sampleRejections[idx],
      replacementSampleStatus: 'Discarded',
      discardStatus: 'discarded',
      discardDate: now.toISOString().slice(0, 10),
      discardTime: now.toTimeString().slice(0, 5),
      discardedByUserId: user.id,
      discardedByName: staff.fullName,
      discardedByStaffId: staff.staffId,
      updatedAt: now.toISOString(),
    };
    const pending = db.pendingSamples.find((p) => p.sampleRejectionId === record.id && p.isActive);
    if (pending) {
      pending.isActive = false;
      pending.replacementSampleStatus = 'Discarded';
      pending.currentStatus = 'Discarded';
      pending.updatedAt = now.toISOString();
    }
    appendAuditLog(db, user.id, 'update', 'sample_rejections', record.id, undefined, 'discarded');
    saveMockDatabase(db);
    refresh();
    toast.success('Sample discard confirmed');
  };

  const exportCsv = () => {
    const headers = ['Patient ID', 'Patient Name', 'ACC#', 'Department', 'Date', 'Time', 'Tests', 'Tube', 'Reasons', 'Replacement Status', 'Review Status'];
    const rows = filtered.map((r) => [
      r.patientId, r.patientName, r.patientLabAccNumber, r.department, r.rejectionDate, r.rejectionTime,
      r.rejectedTests.join('; '), r.rejectedTube, r.rejectionReasons.join('; '),
      r.replacementSampleStatus, r.supervisorReviewStatus,
    ]);
    downloadCSV('sample-rejections.csv', headers, rows);
    if (user) appendAuditLog(db, user.id, 'export', 'sample_rejections');
    saveMockDatabase(db);
    toast.success('CSV exported');
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.text('Sample Rejection Report', 14, 15);
    autoTable(doc, {
      startY: 22,
      head: [['Patient', 'ACC#', 'Department', 'Date', 'Tests', 'Tube', 'Reasons', 'Status']],
      body: filtered.map((r) => [
        r.patientName, r.patientLabAccNumber, r.department, r.rejectionDate,
        r.rejectedTests.join(', '), r.rejectedTube, r.rejectionReasons.join(', '), r.replacementSampleStatus,
      ]),
    });
    doc.save('sample-rejections.pdf');
    if (user) appendAuditLog(db, user.id, 'export', 'sample_rejections');
    saveMockDatabase(db);
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
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setViewRecord(row.original)}><Eye className="h-4 w-4" /></Button>
          {canManage && !isWorkflowLocked(row.original) && (
            <Button size="sm" variant="ghost" onClick={() => openEdit(row.original)}><Pencil className="h-4 w-4" /></Button>
          )}
          {role && user && canConfirmSupervisorReview(role, user.id, row.original) && (
            <Button size="sm" variant="ghost" onClick={() => confirmSupervisorReview(row.original)} title="Confirm Supervisor Review">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </Button>
          )}
          {role && canConfirmDiscard(role) && row.original.discardStatus === 'discard_due' && row.original.replacementSampleStatus !== 'Completed' && (
            <Button size="sm" variant="ghost" onClick={() => confirmDiscard(row.original)} title="Confirm Sample Discard">
              <Archive className="h-4 w-4 text-red-600" />
            </Button>
          )}
        </div>
      ),
    },
  ], [canManage, locale, role, tc, user]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tc('sampleRejections')}</h1>
          <p className="text-muted-foreground">{filtered.length} rejections</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 me-2" />CSV</Button>
          <Button variant="outline" onClick={exportPdf}><Download className="h-4 w-4 me-2" />PDF</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 me-2" />Print</Button>
          {canManage && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openAdd}><Plus className="h-4 w-4 me-2" />Add Sample Rejection</Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editingId ? 'Edit Sample Rejection' : 'Add Sample Rejection'}</DialogTitle></DialogHeader>
                <SampleRejectionFormFields
                  form={form}
                  staffName={staff.fullName}
                  staffId={staff.staffId}
                  recordCreatedDate={nowMeta.date}
                  recordCreatedTime={nowMeta.time}
                  readOnly={false}
                  onChange={setForm}
                />
                <Button onClick={saveRecord} className="w-full">{tc('save')}</Button>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

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
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard title="Total Rejections" value={filtered.length} icon={XCircle} iconClassName="bg-red-100 text-red-600" />
        <StatCard title="Pending Review" value={filtered.filter((r) => r.supervisorReviewStatus === 'pending_supervisor_review').length} icon={XCircle} />
        <StatCard title="Awaiting Replacement" value={filtered.filter((r) => r.replacementSampleStatus === 'Awaiting Replacement Sample').length} icon={XCircle} />
        <StatCard title="Discard Due" value={filtered.filter((r) => r.discardStatus === 'discard_due').length} icon={XCircle} iconClassName="bg-amber-100 text-amber-600" />
      </div>

      <Card>
        <CardHeader><CardTitle>Rejection Reasons</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={reasonStats} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {reasonStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <DataTable data={filtered} columns={columns} searchKey="patientName" searchPlaceholder="Search rejections..." />

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
  );
}
