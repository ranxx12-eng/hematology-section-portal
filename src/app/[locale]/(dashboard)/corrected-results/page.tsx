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
import { maskPatientId } from '@/lib/page-utils';
import { formatDate, formatDateTime } from '@/lib/utils';
import {
  createCorrectedResult,
  fetchCorrectedResults,
  updateCorrectedResult,
} from '@/lib/clinical/corrected-results';
import {
  CORRECTED_RESULT_TESTS,
  correctedResultFormSchema,
  correctedResultUpdateFormSchema,
  emptyCorrectedResultForm,
  type CorrectedResultFormData,
  type CorrectedResultUpdateFormData,
} from '@/lib/corrected-results/schema';
import type { CorrectedResult } from '@/types';

function toLocalDateTime(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function recordToForm(record: CorrectedResult): CorrectedResultFormData {
  return {
    date: record.date,
    patientId: record.patientId,
    test: record.test,
    originalResult: record.originalResult,
    correctedResult: record.correctedResult,
    reason: record.reason,
    physicianNotified: record.physicianNotified,
    notificationTime: toLocalDateTime(record.notificationTime),
    notes: record.notes ?? '',
  };
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
  const [labAccession, setLabAccession] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CorrectedResultFormData>(() => emptyCorrectedResultForm());
  const [filters, setFilters] = useState({ notified: 'all' as 'all' | 'yes' | 'no', test: 'all' });

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchCorrectedResults();
    setRecords(result.data);
    setError(result.error);
    setLoading(false);
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
      if (filters.test !== 'all' && record.test !== filters.test) return false;
      return true;
    });
  }, [records, filters]);

  const stats = useMemo(() => ({
    total: records.length,
    notified: records.filter((record) => record.physicianNotified).length,
    pending: records.filter((record) => !record.physicianNotified).length,
  }), [records]);

  const testOptions = useMemo(
    () => [...new Set([...CORRECTED_RESULT_TESTS, ...records.map((record) => record.test)])].sort(),
    [records],
  );

  const openAddDialog = useCallback(() => {
    setEditingId(null);
    setLabAccession('');
    setForm(emptyCorrectedResultForm());
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((record: CorrectedResult) => {
    setEditingId(record.id);
    setLabAccession('');
    setForm(recordToForm(record));
    setDialogOpen(true);
  }, []);

  const columns: ColumnDef<CorrectedResult>[] = useMemo(() => [
    { accessorKey: 'date', header: 'Date', cell: ({ row }) => formatDate(row.original.date, locale) },
    {
      accessorKey: 'patientId',
      header: 'Patient ID',
      cell: ({ row }) => <span className="font-mono">{maskPatientId(row.original.patientId)}</span>,
    },
    { accessorKey: 'test', header: 'Test/Parameter' },
    { accessorKey: 'originalResult', header: 'Original Result' },
    { accessorKey: 'correctedResult', header: 'Corrected Result' },
    { accessorKey: 'reason', header: 'Reason' },
    {
      accessorKey: 'correctedByName',
      header: 'Corrected By',
      cell: ({ row }) => row.original.correctedByName ?? '—',
    },
    {
      accessorKey: 'physicianNotified',
      header: 'Physician Notified',
      cell: ({ row }) => row.original.physicianNotified
        ? <Badge variant="success">Yes</Badge>
        : <Badge variant="warning">No</Badge>,
    },
    {
      accessorKey: 'notificationTime',
      header: 'Notification Time',
      cell: ({ row }) => row.original.notificationTime
        ? formatDateTime(row.original.notificationTime, locale)
        : '—',
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
      setForm((prev) => ({ ...prev, patientId: result.data!.patientId }));
      toast.success('Patient ID loaded from prior record');
    }
  };

  const saveRecord = async () => {
    if (!canManage || !user) return;

    if (editingId) {
      const updatePayload: CorrectedResultUpdateFormData = {
        date: form.date,
        patientId: form.patientId,
        test: form.test,
        correctedResult: form.correctedResult,
        reason: form.reason,
        physicianNotified: form.physicianNotified,
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
    setLabAccession('');
    setForm(emptyCorrectedResultForm());
    await loadRecords();
  };

  const formFields = (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto pe-1">
      <div>
        <Label htmlFor="cr-date">Correction Date *</Label>
        <Input id="cr-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
      </div>
      {!editingId && (
        <>
          <AccessionFieldWithScan
            id="cr-lab-accession"
            label="Lab Accession"
            value={labAccession}
            onChange={setLabAccession}
            onScanComplete={(accession) => void handleAccessionLookup(accession)}
          />
          {lookupLoading && (
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Looking up accession…
            </p>
          )}
        </>
      )}
      <div>
        <Label htmlFor="cr-patient-id">Patient ID / MRN *</Label>
        <Input id="cr-patient-id" value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} required />
      </div>
      <div>
        <Label htmlFor="cr-test">Test/Parameter *</Label>
        <Select value={form.test || undefined} onValueChange={(v) => setForm({ ...form, test: v })}>
          <SelectTrigger id="cr-test"><SelectValue placeholder="Select test" /></SelectTrigger>
          <SelectContent>
            {CORRECTED_RESULT_TESTS.map((test) => (
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
        <Label htmlFor="cr-corrected-by">Corrected By</Label>
        <Input id="cr-corrected-by" value={user?.fullName ?? ''} readOnly disabled className="bg-muted" />
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <Label htmlFor="cr-physician-notified">Physician Notified</Label>
        <Switch
          id="cr-physician-notified"
          checked={form.physicianNotified}
          onCheckedChange={(checked) => setForm({ ...form, physicianNotified: checked, notificationTime: checked ? form.notificationTime : '' })}
        />
      </div>
      {form.physicianNotified && (
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
          <Select value={filters.notified} onValueChange={(value: 'all' | 'yes' | 'no') => setFilters((prev) => ({ ...prev, notified: value }))}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Notification status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All notification statuses</SelectItem>
              <SelectItem value="yes">Physician notified</SelectItem>
              <SelectItem value="no">Not notified</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.test} onValueChange={(value) => setFilters((prev) => ({ ...prev, test: value }))}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Test" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tests</SelectItem>
              {testOptions.map((test) => (
                <SelectItem key={test} value={test}>{test}</SelectItem>
              ))}
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
        <DataTable data={filtered} columns={columns} searchKey="test" searchPlaceholder="Search corrected results..." />
      )}
    </div>
  );
}
