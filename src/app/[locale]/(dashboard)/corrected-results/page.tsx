'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Pencil, Loader2, FileCheck, Bell, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { StatCard } from '@/components/shared/stat-card';
import { AccessionFieldWithScan } from '@/components/clinical/accession-field-with-scan';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { lookupPatientByAccession } from '@/lib/clinical/accession-lookup';
import { maskPatientId, statusBadgeVariant } from '@/lib/page-utils';
import { formatDate } from '@/lib/utils';
import {
  createCorrectedResult,
  fetchCorrectedResults,
  updateCorrectedResult,
} from '@/lib/clinical/corrected-results';
import {
  CORRECTED_RESULT_STATUSES,
  CORRECTED_RESULT_TESTS,
  correctedResultFormSchema,
  correctedResultUpdateFormSchema,
  emptyCorrectedResultForm,
  type CorrectedResultFormData,
  type CorrectedResultUpdateFormData,
} from '@/lib/corrected-results/schema';
import type { CorrectedResult, CorrectedResultStatus } from '@/types';

function toLocalDateTime(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function recordToForm(record: CorrectedResult): CorrectedResultFormData {
  return {
    date: record.date,
    patientName: record.patientName ?? '',
    patientId: record.patientId ?? '',
    labAccession: record.labAccession ?? '',
    test: record.test ?? '',
    originalResult: record.originalResult ?? '',
    correctedResult: record.correctedResult ?? '',
    reason: record.reason ?? '',
    status: record.status ?? 'Open',
    physicianNotified: record.physicianNotified ?? false,
    notifiedTo: record.notifiedTo ?? '',
    notificationTime: toLocalDateTime(record.notificationTime),
    notes: record.notes ?? '',
  };
}

function matchesSearch(record: CorrectedResult, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const fields = [
    record.patientName,
    record.patientId,
    record.labAccession,
    record.test,
  ];
  return fields.some((value) => value?.toLowerCase().includes(normalized));
}

function displayStatus(status: CorrectedResultStatus | null | undefined): CorrectedResultStatus {
  if (status === 'Completed' || status === 'Pending Review') return status;
  return 'Open';
}

export default function CorrectedResultsPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can, user, isLoading: authLoading } = useAuth();
  const canManage = can('corrected_results.manage');
  const [records, setRecords] = useState<CorrectedResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CorrectedResultFormData>(() => emptyCorrectedResultForm());
  const [filters, setFilters] = useState({
    notified: 'all' as 'all' | 'yes' | 'no',
    status: 'all' as 'all' | CorrectedResultStatus,
    search: '',
  });

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCorrectedResults();
      setRecords(result.data);
      setError(result.error);
    } catch (err) {
      setRecords([]);
      setError(err instanceof Error ? err.message : 'Failed to load corrected results');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const accessDenied = !authLoading && !can('corrected_results.view');
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  const filtered = useMemo(() => {
    return records.filter((record) => {
      if (filters.notified === 'yes' && !record.physicianNotified) return false;
      if (filters.notified === 'no' && record.physicianNotified) return false;
      if (filters.status !== 'all' && displayStatus(record.status) !== filters.status) return false;
      if (!matchesSearch(record, filters.search)) return false;
      return true;
    });
  }, [records, filters]);

  const stats = useMemo(() => ({
    total: records.length,
    notified: records.filter((record) => record.physicianNotified).length,
    pending: records.filter((record) => !record.physicianNotified).length,
  }), [records]);

  const testOptions = useMemo(
    () => [...new Set([
      ...CORRECTED_RESULT_TESTS,
      ...records.map((record) => record.test).filter((test): test is string => Boolean(test?.trim())),
    ])].sort(),
    [records],
  );

  const openAddDialog = useCallback(() => {
    setEditingId(null);
    setForm(emptyCorrectedResultForm());
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((record: CorrectedResult) => {
    setEditingId(record.id);
    setForm(recordToForm(record));
    setDialogOpen(true);
  }, []);

  const handleAccessionLookup = useCallback(async (accession: string) => {
    const trimmed = accession.trim();
    if (!trimmed) return;

    setLookupLoading(true);
    try {
      const result = await lookupPatientByAccession(trimmed);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.data) {
        setForm((prev) => ({
          ...prev,
          patientId: result.data!.patientId,
          patientName: result.data!.patientName,
          labAccession: result.data!.accession,
        }));
        toast.success('Patient details loaded from prior record');
      }
    } finally {
      setLookupLoading(false);
    }
  }, []);

  const saveRecord = useCallback(async () => {
    if (!canManage || !user) return;

    if (editingId) {
      const updatePayload: CorrectedResultUpdateFormData = {
        date: form.date,
        patientName: form.patientName,
        patientId: form.patientId,
        labAccession: form.labAccession,
        test: form.test,
        correctedResult: form.correctedResult,
        reason: form.reason,
        status: form.status,
        physicianNotified: form.physicianNotified,
        notifiedTo: form.notifiedTo,
        notificationTime: form.notificationTime,
        notes: form.notes,
      };
      const parsed = correctedResultUpdateFormSchema.safeParse(updatePayload);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? 'Please complete all required fields');
        return;
      }
      setSaving(true);
      const result = await updateCorrectedResult(editingId, parsed.data);
      setSaving(false);
      if (result.error) {
        toast.error(result.error);
        return;
      }
    } else {
      const parsed = correctedResultFormSchema.safeParse(form);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? 'Please complete all required fields');
        return;
      }
      setSaving(true);
      const result = await createCorrectedResult(user.id, parsed.data);
      setSaving(false);
      if (result.error) {
        toast.error(result.error);
        return;
      }
    }

    toast.success(editingId ? 'Corrected result updated' : 'Corrected result recorded');
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyCorrectedResultForm());
    await loadRecords();
  }, [canManage, editingId, form, loadRecords, user]);

  const columns: ColumnDef<CorrectedResult>[] = useMemo(() => [
    {
      accessorKey: 'date',
      header: 'Date',
      cell: ({ row }) => (row.original.date ? formatDate(row.original.date, locale) : '—'),
    },
    {
      accessorKey: 'patientName',
      header: 'Patient Name',
      cell: ({ row }) => row.original.patientName?.trim() || '—',
    },
    {
      accessorKey: 'patientId',
      header: 'MRN',
      cell: ({ row }) => <span className="font-mono">{maskPatientId(row.original.patientId)}</span>,
    },
    {
      accessorKey: 'labAccession',
      header: 'Lab Accession',
      cell: ({ row }) => row.original.labAccession?.trim() || '—',
    },
    {
      accessorKey: 'test',
      header: 'Test',
      cell: ({ row }) => row.original.test?.trim() || '—',
    },
    {
      accessorKey: 'originalResult',
      header: 'Original',
      cell: ({ row }) => row.original.originalResult?.trim() || '—',
    },
    {
      accessorKey: 'correctedResult',
      header: 'Corrected',
      cell: ({ row }) => row.original.correctedResult?.trim() || '—',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = displayStatus(row.original.status);
        return <Badge variant={statusBadgeVariant(status)}>{status}</Badge>;
      },
    },
    {
      accessorKey: 'correctedByName',
      header: 'Corrected By',
      cell: ({ row }) => row.original.correctedByName?.trim() || '—',
    },
    {
      accessorKey: 'physicianNotified',
      header: 'Notification',
      cell: ({ row }) => row.original.physicianNotified
        ? <Badge variant="success">Notified</Badge>
        : <Badge variant="warning">Pending</Badge>,
    },
    {
      id: 'actions',
      header: tc('actions'),
      cell: ({ row }) => canManage ? (
        <Button size="sm" variant="ghost" onClick={() => openEditDialog(row.original)}>
          <Pencil className="h-4 w-4" />
        </Button>
      ) : null,
    },
  ], [canManage, locale, openEditDialog, tc]);

  if (accessDenied || authLoading) {
    return authLoading ? (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin me-2" />
        {tc('loading')}
      </div>
    ) : null;
  }

  const formFields = (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto pe-1">
      <div>
        <Label htmlFor="cr-date">Correction Date *</Label>
        <Input id="cr-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
      </div>
      <div>
        <Label htmlFor="cr-patient-name">Patient Name</Label>
        <Input id="cr-patient-name" value={form.patientName ?? ''} onChange={(e) => setForm({ ...form, patientName: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="cr-patient-id">Patient ID / MRN *</Label>
        <Input id="cr-patient-id" value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} required />
      </div>
      <AccessionFieldWithScan
        id="cr-lab-accession"
        label="Lab Accession"
        value={form.labAccession ?? ''}
        onChange={(value) => setForm({ ...form, labAccession: value })}
        onScanComplete={(accession) => void handleAccessionLookup(accession)}
      />
      {lookupLoading && (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          Looking up accession…
        </p>
      )}
      <div>
        <Label htmlFor="cr-test">Test/Parameter *</Label>
        <Select value={form.test?.trim() ? form.test : undefined} onValueChange={(v) => setForm({ ...form, test: v })}>
          <SelectTrigger id="cr-test"><SelectValue placeholder="Select test" /></SelectTrigger>
          <SelectContent>
            {testOptions.map((test) => (
              <SelectItem key={test} value={test}>{test}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="cr-original">Original Result *</Label>
        <Input
          id="cr-original"
          value={form.originalResult}
          onChange={(e) => setForm({ ...form, originalResult: e.target.value })}
          readOnly={!!editingId}
          disabled={!!editingId}
          className={editingId ? 'bg-muted' : undefined}
          required
        />
        {editingId && <p className="text-xs text-muted-foreground mt-1">Original result is preserved and cannot be changed.</p>}
      </div>
      <div>
        <Label htmlFor="cr-corrected">Corrected Result *</Label>
        <Input id="cr-corrected" value={form.correctedResult} onChange={(e) => setForm({ ...form, correctedResult: e.target.value })} required />
      </div>
      <div>
        <Label htmlFor="cr-reason">Reason for Correction *</Label>
        <Textarea id="cr-reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} required />
      </div>
      <div>
        <Label htmlFor="cr-status">Status *</Label>
        <Select
          value={displayStatus(form.status)}
          onValueChange={(v: CorrectedResultStatus) => setForm({ ...form, status: v })}
        >
          <SelectTrigger id="cr-status"><SelectValue placeholder="Select status" /></SelectTrigger>
          <SelectContent>
            {CORRECTED_RESULT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="cr-corrected-by">Corrected By</Label>
        <Input id="cr-corrected-by" value={user?.fullName ?? ''} readOnly disabled className="bg-muted" />
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <Label htmlFor="cr-physician-notified">Physician Notified</Label>
        <Switch
          id="cr-physician-notified"
          checked={form.physicianNotified}
          onCheckedChange={(checked) => setForm({
            ...form,
            physicianNotified: checked,
            notificationTime: checked ? form.notificationTime : '',
            notifiedTo: checked ? form.notifiedTo : '',
          })}
        />
      </div>
      {form.physicianNotified && (
        <>
          <div>
            <Label htmlFor="cr-notified-to">Notified To *</Label>
            <Input
              id="cr-notified-to"
              value={form.notifiedTo ?? ''}
              onChange={(e) => setForm({ ...form, notifiedTo: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="cr-notification-time">Notification Date/Time *</Label>
            <Input
              id="cr-notification-time"
              type="datetime-local"
              value={form.notificationTime ?? ''}
              onChange={(e) => setForm({ ...form, notificationTime: e.target.value })}
              required
            />
          </div>
        </>
      )}
      <div>
        <Label htmlFor="cr-notes">Notes</Label>
        <Textarea id="cr-notes" value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
      </div>
      <Button onClick={() => void saveRecord()} className="w-full" disabled={saving}>
        {saving ? tc('loading') : tc('save')}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tc('correctedResults')}</h1>
          <p className="text-muted-foreground">
            {loading ? 'Loading…' : `${filtered.length} correction${filtered.length === 1 ? '' : 's'} on file`}
          </p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog}><Plus className="h-4 w-4 me-2" />Add Corrected Result</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editingId ? 'Edit Corrected Result' : 'Add Corrected Result'}</DialogTitle></DialogHeader>
              {formFields}
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!loading && !error && records.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title="Total Corrections" value={stats.total} icon={FileCheck} />
          <StatCard title="Physician Notified" value={stats.notified} icon={Bell} iconClassName="text-emerald-600" />
          <StatCard title="Pending Notification" value={stats.pending} icon={BellOff} iconClassName="text-amber-600" />
        </div>
      )}

      {!loading && records.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Search by patient name, MRN, accession, or test…"
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            className="w-full sm:max-w-sm"
          />
          <Select value={filters.status} onValueChange={(value: 'all' | CorrectedResultStatus) => setFilters((prev) => ({ ...prev, status: value }))}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {CORRECTED_RESULT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.notified} onValueChange={(value: 'all' | 'yes' | 'no') => setFilters((prev) => ({ ...prev, notified: value }))}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Notification status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All notification statuses</SelectItem>
              <SelectItem value="yes">Physician notified</SelectItem>
              <SelectItem value="no">Not notified</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin me-2" />
          {tc('loading')}
        </div>
      )}

      {!loading && error && (
        <EmptyState title="Unable to load corrected results" description={error} />
      )}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          title={records.length === 0 ? 'No corrected results' : 'No matching records'}
          description={records.length === 0
            ? 'Corrected result records will appear here once recorded.'
            : 'Try adjusting your filters to see more records.'}
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <DataTable data={filtered} columns={columns} />
      )}
    </div>
  );
}
