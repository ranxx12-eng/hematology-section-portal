'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Pencil, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { StatCard } from '@/components/shared/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { statusBadgeVariant } from '@/lib/page-utils';
import { formatDateTime } from '@/lib/utils';
import { fetchInstrumentNameMap } from '@/lib/clinical/qc-records';
import {
  createTATRecord,
  fetchTATRecords,
  updateTATRecord,
} from '@/lib/clinical/tat-records';
import {
  deriveTATFields,
  emptyTATRecordForm,
  TAT_DEPARTMENTS,
  TAT_SHIFTS,
  TAT_TEST_TYPES,
  tatRecordFormSchema,
  type TATRecordFormData,
} from '@/lib/tat-records/schema';
import { Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import type { TATRecord } from '@/types';

function toLocalDateTime(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function recordToForm(record: TATRecord): TATRecordFormData {
  return {
    sampleReceivedTime: toLocalDateTime(record.sampleReceivedTime),
    resultReleasedTime: toLocalDateTime(record.resultReleasedTime),
    targetTatMinutes: record.targetTat,
    testType: record.testType,
    priority: record.priority,
    department: record.department,
    shift: record.shift as TATRecordFormData['shift'],
    instrumentId: record.instrumentId ?? '',
    delayReason: record.delayReason ?? '',
  };
}

export default function TATPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can, user } = useAuth();
  const canManage = can('tat.manage');
  const [records, setRecords] = useState<TATRecord[]>([]);
  const [instrumentNames, setInstrumentNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TATRecordFormData>(() => emptyTATRecordForm());

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [result, names] = await Promise.all([fetchTATRecords(), fetchInstrumentNameMap()]);
    setRecords(result.data);
    setInstrumentNames(names);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const accessDenied = !can('tat.view');
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);
  if (accessDenied) return null;

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return records;
    return records.filter((r) => r.status === statusFilter);
  }, [records, statusFilter]);

  const stats = useMemo(() => ({
    within: records.filter((r) => r.status === 'within_target').length,
    near: records.filter((r) => r.status === 'near_breach').length,
    breached: records.filter((r) => r.status === 'breached').length,
  }), [records]);

  const instrumentOptions = useMemo(
    () => Object.entries(instrumentNames).map(([id, name]) => ({ id, name })),
    [instrumentNames],
  );

  const derived = deriveTATFields(form);

  const openAddDialog = () => {
    setEditingId(null);
    setForm(emptyTATRecordForm());
    setDialogOpen(true);
  };

  const openEditDialog = (record: TATRecord) => {
    setEditingId(record.id);
    setForm(recordToForm(record));
    setDialogOpen(true);
  };

  const saveRecord = async () => {
    if (!canManage || !user) return;

    const parsed = tatRecordFormSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Please complete all required fields');
      return;
    }

    setSaving(true);
    const result = editingId
      ? await updateTATRecord(editingId, parsed.data)
      : await createTATRecord(user.id, parsed.data);
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(editingId ? 'TAT record updated' : 'TAT record created');
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyTATRecordForm());
    await loadRecords();
  };

  const columns: ColumnDef<TATRecord>[] = useMemo(() => [
    { accessorKey: 'testType', header: 'Test' },
    { accessorKey: 'priority', header: 'Priority', cell: ({ row }) => <Badge variant={row.original.priority === 'stat' ? 'destructive' : 'secondary'}>{row.original.priority}</Badge> },
    { accessorKey: 'department', header: 'Department' },
    { accessorKey: 'calculatedTat', header: 'TAT (min)' },
    { accessorKey: 'targetTat', header: 'Target (min)' },
    { accessorKey: 'status', header: tc('status'), cell: ({ row }) => <Badge variant={statusBadgeVariant(row.original.status)}>{row.original.status.replace('_', ' ')}</Badge> },
    { accessorKey: 'sampleReceivedTime', header: 'Received', cell: ({ row }) => formatDateTime(row.original.sampleReceivedTime, locale) },
    {
      id: 'actions',
      header: tc('actions'),
      cell: ({ row }) => canManage ? (
        <Button size="sm" variant="ghost" onClick={() => openEditDialog(row.original)}>
          <Pencil className="h-4 w-4" />
        </Button>
      ) : null,
    },
  ], [canManage, locale, tc]);

  const formFields = (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto pe-1">
      <div>
        <Label htmlFor="tat-test">Test Type *</Label>
        <Select value={form.testType} onValueChange={(v) => setForm({ ...form, testType: v })}>
          <SelectTrigger id="tat-test"><SelectValue placeholder="Select test" /></SelectTrigger>
          <SelectContent>
            {TAT_TEST_TYPES.map((test) => <SelectItem key={test} value={test}>{test}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="tat-received">Sample Received *</Label>
          <Input id="tat-received" type="datetime-local" value={form.sampleReceivedTime} onChange={(e) => setForm({ ...form, sampleReceivedTime: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="tat-released">Result Released *</Label>
          <Input id="tat-released" type="datetime-local" value={form.resultReleasedTime} onChange={(e) => setForm({ ...form, resultReleasedTime: e.target.value })} />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Calculated TAT: {derived.calculatedTatMinutes} min ({derived.status.replace('_', ' ')})
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="tat-target">Target TAT (minutes) *</Label>
          <Input id="tat-target" type="number" min="1" value={form.targetTatMinutes} onChange={(e) => setForm({ ...form, targetTatMinutes: Number(e.target.value) })} />
        </div>
        <div>
          <Label htmlFor="tat-priority">Priority *</Label>
          <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as TATRecordFormData['priority'] })}>
            <SelectTrigger id="tat-priority"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="stat">Stat</SelectItem>
              <SelectItem value="routine">Routine</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="tat-department">Department *</Label>
          <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
            <SelectTrigger id="tat-department"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TAT_DEPARTMENTS.map((dept) => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="tat-shift">Shift *</Label>
          <Select value={form.shift} onValueChange={(v) => setForm({ ...form, shift: v as TATRecordFormData['shift'] })}>
            <SelectTrigger id="tat-shift"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TAT_SHIFTS.map((shift) => <SelectItem key={shift} value={shift}>{shift}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="tat-instrument">Instrument</Label>
        <Select value={form.instrumentId || 'none'} onValueChange={(v) => setForm({ ...form, instrumentId: v === 'none' ? '' : v })}>
          <SelectTrigger id="tat-instrument"><SelectValue placeholder="Optional instrument" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {instrumentOptions.map(({ id, name }) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="tat-delay">Delay Reason</Label>
        <Textarea id="tat-delay" value={form.delayReason ?? ''} onChange={(e) => setForm({ ...form, delayReason: e.target.value })} rows={2} />
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
          <h1 className="text-2xl font-bold">{tc('tat')}</h1>
          <p className="text-muted-foreground">Turnaround time monitoring</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog}><Plus className="h-4 w-4 me-2" />Add TAT Record</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editingId ? 'Edit TAT Record' : 'Add TAT Record'}</DialogTitle></DialogHeader>
              {formFields}
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Within Target" value={loading ? '—' : stats.within} icon={CheckCircle} iconClassName="bg-emerald-100 text-emerald-600" />
        <StatCard title="Near Breach" value={loading ? '—' : stats.near} icon={AlertTriangle} iconClassName="bg-amber-100 text-amber-600" />
        <StatCard title="Breached" value={loading ? '—' : stats.breached} icon={Clock} iconClassName="bg-red-100 text-red-600" />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin me-2" />
          {tc('loading')}
        </div>
      )}

      {!loading && error && (
        <EmptyState title="Unable to load TAT records" description={error} />
      )}

      {!loading && !error && records.length === 0 && (
        <EmptyState
          title="No TAT records yet"
          description="Turnaround time metrics will appear here once TAT records are added."
        />
      )}

      {!loading && !error && records.length > 0 && (
        <>
          <div className="flex gap-3 items-center">
            <Label>{tc('filter')}:</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="within_target">Within Target</SelectItem>
                <SelectItem value="near_breach">Near Breach</SelectItem>
                <SelectItem value="breached">Breached</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DataTable data={filtered} columns={columns} searchKey="testType" searchPlaceholder="Search TAT records..." />
        </>
      )}
    </div>
  );
}
