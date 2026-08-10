'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Pencil, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { BRAND_COLORS } from '@/lib/brand/colors';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/providers/auth-provider';
import { statusBadgeVariant } from '@/lib/page-utils';
import { formatDateTime } from '@/lib/utils';
import {
  createQCRecord,
  fetchInstrumentNameMap,
  fetchQCRecords,
  updateQCRecord,
} from '@/lib/clinical/qc-records';
import {
  calculateCvPercent,
  emptyQCRecordForm,
  QC_CONTROL_LEVELS,
  QC_STATUSES,
  QC_TESTS,
  qcRecordFormSchema,
  type QCRecordFormData,
} from '@/lib/qc-records/schema';
import type { QCRecord } from '@/types';

function toLocalDateTime(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function recordToForm(record: QCRecord): QCRecordFormData {
  return {
    instrumentId: record.instrumentId,
    test: record.test,
    controlLevel: record.controlLevel,
    lotNumber: record.lotNumber,
    expiryDate: record.expiryDate,
    recordedAt: toLocalDateTime(record.recordedAt),
    result: record.result,
    mean: record.mean,
    standardDeviation: record.standardDeviation,
    rangeMin: record.rangeMin,
    rangeMax: record.rangeMax,
    status: record.status,
    correctiveAction: record.correctiveAction ?? '',
  };
}

export default function QualityControlPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can, user } = useAuth();
  const canManage = can('qc.manage');
  const [records, setRecords] = useState<QCRecord[]>([]);
  const [instrumentNames, setInstrumentNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedTest, setSelectedTest] = useState('CBC');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<QCRecordFormData>(() => emptyQCRecordForm());

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [qcResult, names] = await Promise.all([fetchQCRecords(), fetchInstrumentNameMap()]);
    setRecords(qcResult.data);
    setInstrumentNames(names);
    setError(qcResult.error);
    if (qcResult.data.length > 0) {
      setSelectedTest((current) => (
        qcResult.data.some((r) => r.test === current) ? current : qcResult.data[0].test
      ));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const accessDenied = !can('qc.view');
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);
  if (accessDenied) return null;

  const instrumentOptions = useMemo(
    () => Object.entries(instrumentNames).map(([id, name]) => ({ id, name })),
    [instrumentNames],
  );

  const tests = useMemo(() => [...new Set(records.map((r) => r.test))], [records]);

  const chartData = useMemo(() => {
    return records
      .filter((r) => r.test === selectedTest)
      .slice(0, 20)
      .reverse()
      .map((r, i) => ({
        index: i + 1,
        result: r.result,
        mean: r.mean,
        plus2sd: r.mean + 2 * r.standardDeviation,
        minus2sd: r.mean - 2 * r.standardDeviation,
      }));
  }, [records, selectedTest]);

  const getInstrumentName = (id: string) => instrumentNames[id] ?? id;

  const openAddDialog = () => {
    setEditingId(null);
    setForm(emptyQCRecordForm());
    setDialogOpen(true);
  };

  const openEditDialog = (record: QCRecord) => {
    setEditingId(record.id);
    setForm(recordToForm(record));
    setDialogOpen(true);
  };

  const saveRecord = async () => {
    if (!canManage || !user) return;

    const parsed = qcRecordFormSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Please complete all required fields');
      return;
    }

    setSaving(true);
    const result = editingId
      ? await updateQCRecord(editingId, parsed.data)
      : await createQCRecord(user.id, parsed.data);
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(editingId ? 'QC record updated' : 'QC record created');
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyQCRecordForm());
    await loadRecords();
  };

  const computedCv = calculateCvPercent(form.mean, form.standardDeviation);

  const columns: ColumnDef<QCRecord>[] = useMemo(() => [
    { accessorKey: 'test', header: 'Test' },
    { accessorKey: 'instrumentId', header: 'Instrument', cell: ({ row }) => getInstrumentName(row.original.instrumentId) },
    { accessorKey: 'controlLevel', header: 'Level' },
    { accessorKey: 'result', header: 'Result', cell: ({ row }) => row.original.result.toFixed(2) },
    { accessorKey: 'cvPercent', header: 'CV%', cell: ({ row }) => `${row.original.cvPercent}%` },
    { accessorKey: 'recordedAt', header: 'Recorded', cell: ({ row }) => formatDateTime(row.original.recordedAt, locale) },
    { accessorKey: 'status', header: tc('status'), cell: ({ row }) => <Badge variant={statusBadgeVariant(row.original.status)}>{row.original.status}</Badge> },
    {
      id: 'actions',
      header: tc('actions'),
      cell: ({ row }) => canManage ? (
        <Button size="sm" variant="ghost" onClick={() => openEditDialog(row.original)}>
          <Pencil className="h-4 w-4" />
        </Button>
      ) : null,
    },
  ], [canManage, instrumentNames, locale, tc]);

  const formFields = (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto pe-1">
      <div>
        <Label htmlFor="qc-instrument">Instrument *</Label>
        <Select value={form.instrumentId} onValueChange={(v) => setForm({ ...form, instrumentId: v })}>
          <SelectTrigger id="qc-instrument"><SelectValue placeholder="Select instrument" /></SelectTrigger>
          <SelectContent>
            {instrumentOptions.map(({ id, name }) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="qc-test">Test *</Label>
        <Select value={form.test} onValueChange={(v) => setForm({ ...form, test: v })}>
          <SelectTrigger id="qc-test"><SelectValue placeholder="Select test" /></SelectTrigger>
          <SelectContent>
            {QC_TESTS.map((test) => <SelectItem key={test} value={test}>{test}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="qc-level">Control Level *</Label>
          <Select value={form.controlLevel} onValueChange={(v) => setForm({ ...form, controlLevel: v })}>
            <SelectTrigger id="qc-level"><SelectValue placeholder="Select level" /></SelectTrigger>
            <SelectContent>
              {QC_CONTROL_LEVELS.map((level) => <SelectItem key={level} value={level}>{level}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="qc-lot">Lot Number *</Label>
          <Input id="qc-lot" value={form.lotNumber} onChange={(e) => setForm({ ...form, lotNumber: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="qc-expiry">Expiry Date *</Label>
          <Input id="qc-expiry" type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="qc-recorded">Recorded At *</Label>
          <Input id="qc-recorded" type="datetime-local" value={form.recordedAt} onChange={(e) => setForm({ ...form, recordedAt: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label htmlFor="qc-result">Result *</Label>
          <Input id="qc-result" type="number" step="0.0001" value={form.result} onChange={(e) => setForm({ ...form, result: Number(e.target.value) })} />
        </div>
        <div>
          <Label htmlFor="qc-mean">Mean *</Label>
          <Input id="qc-mean" type="number" step="0.0001" value={form.mean} onChange={(e) => setForm({ ...form, mean: Number(e.target.value) })} />
        </div>
        <div>
          <Label htmlFor="qc-sd">Standard Deviation *</Label>
          <Input id="qc-sd" type="number" step="0.0001" min="0" value={form.standardDeviation} onChange={(e) => setForm({ ...form, standardDeviation: Number(e.target.value) })} />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">Calculated CV%: {computedCv}%</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="qc-range-min">Range Min *</Label>
          <Input id="qc-range-min" type="number" step="0.0001" value={form.rangeMin} onChange={(e) => setForm({ ...form, rangeMin: Number(e.target.value) })} />
        </div>
        <div>
          <Label htmlFor="qc-range-max">Range Max *</Label>
          <Input id="qc-range-max" type="number" step="0.0001" value={form.rangeMax} onChange={(e) => setForm({ ...form, rangeMax: Number(e.target.value) })} />
        </div>
      </div>
      <div>
        <Label htmlFor="qc-status">Status *</Label>
        <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as QCRecordFormData['status'] })}>
          <SelectTrigger id="qc-status"><SelectValue /></SelectTrigger>
          <SelectContent>
            {QC_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="qc-corrective">Corrective Action</Label>
        <Textarea id="qc-corrective" value={form.correctiveAction ?? ''} onChange={(e) => setForm({ ...form, correctiveAction: e.target.value })} rows={2} />
      </div>
      <Button onClick={() => void saveRecord()} className="w-full" disabled={saving || instrumentOptions.length === 0}>
        {saving ? tc('loading') : tc('save')}
      </Button>
      {instrumentOptions.length === 0 && (
        <p className="text-xs text-muted-foreground">Add instruments in the Instruments module before creating QC records.</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tc('qualityControl')}</h1>
          <p className="text-muted-foreground">{loading ? 'Loading…' : `${records.length} QC records`}</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog}><Plus className="h-4 w-4 me-2" />Add QC Record</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editingId ? 'Edit QC Record' : 'Add QC Record'}</DialogTitle></DialogHeader>
              {formFields}
            </DialogContent>
          </Dialog>
        )}
      </div>

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

      {!loading && !error && records.length > 0 && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Levey-Jennings Chart — {selectedTest}</CardTitle>
              <Select value={selectedTest} onValueChange={setSelectedTest}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>{tests.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No chart data for {selectedTest}.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="index" label={{ value: 'Run', position: 'insideBottom', offset: -5 }} />
                    <YAxis domain={['auto', 'auto']} />
                    <Tooltip />
                    <Legend />
                    <ReferenceLine y={chartData[0]?.mean} stroke={BRAND_COLORS.primary} strokeDasharray="5 5" label="Mean" />
                    <Line type="monotone" dataKey="plus2sd" stroke={BRAND_COLORS.warning} dot={false} name="+2SD" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="minus2sd" stroke={BRAND_COLORS.warning} dot={false} name="-2SD" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="result" stroke={BRAND_COLORS.accent} name="Result" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <DataTable data={records} columns={columns} searchKey="test" searchPlaceholder="Search QC records..." />
        </>
      )}
    </div>
  );
}
