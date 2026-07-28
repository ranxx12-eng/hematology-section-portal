'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { BRAND_COLORS } from '@/lib/brand/colors';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { appendAuditLog, statusBadgeVariant } from '@/lib/page-utils';
import { formatDateTime, generateId } from '@/lib/utils';
import type { QCRecord } from '@/types';

export default function QualityControlPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const canManage = can('qc.manage');
  const [db, setDb] = useState(() => getMockDatabase());
  const [selectedTest, setSelectedTest] = useState('CBC');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ instrumentId: '', test: 'CBC', result: '', status: 'accepted' as QCRecord['status'] });
  const refresh = useCallback(() => setDb(getMockDatabase()), []);

  if (!can('qc.view')) {
    router.replace(`/${locale}/unauthorized`);
    return null;
  }

  const chartData = useMemo(() => {
    return db.qcRecords
      .filter((r) => r.test === selectedTest)
      .slice(0, 20)
      .reverse()
      .map((r, i) => ({
        index: i + 1,
        result: r.result,
        mean: r.mean,
        plus2sd: r.mean + 2 * r.standardDeviation,
        minus2sd: r.mean - 2 * r.standardDeviation,
        plus3sd: r.mean + 3 * r.standardDeviation,
        minus3sd: r.mean - 3 * r.standardDeviation,
      }));
  }, [db.qcRecords, selectedTest]);

  const addRecord = () => {
    if (!form.instrumentId || !form.result || !canManage) return;
    const now = new Date().toISOString();
    const result = parseFloat(form.result);
    const record: QCRecord = {
      id: generateId(),
      instrumentId: form.instrumentId,
      test: form.test,
      controlLevel: 'Level 2',
      lotNumber: `LOT-${Date.now()}`,
      expiryDate: now,
      recordedAt: now,
      result,
      mean: 12,
      standardDeviation: 0.5,
      cvPercent: 4.2,
      rangeMin: 10,
      rangeMax: 14,
      status: form.status,
      createdAt: now,
    };
    db.qcRecords.unshift(record);
    if (user) appendAuditLog(db, user.id, 'create', 'qc', record.id);
    saveMockDatabase(db);
    refresh();
    setDialogOpen(false);
    toast.success('QC record added');
  };

  const deleteRecord = (id: string) => {
    if (!canManage || !confirm(tc('confirmDelete'))) return;
    db.qcRecords = db.qcRecords.filter((r) => r.id !== id);
    if (user) appendAuditLog(db, user.id, 'delete', 'qc', id);
    saveMockDatabase(db);
    refresh();
    toast.success('QC record deleted');
  };

  const getInstrumentName = (id: string) => db.instruments.find((i) => i.id === id)?.name ?? id;
  const tests = [...new Set(db.qcRecords.map((r) => r.test))];

  const columns: ColumnDef<QCRecord>[] = useMemo(() => [
    { accessorKey: 'test', header: 'Test' },
    { accessorKey: 'instrumentId', header: 'Instrument', cell: ({ row }) => getInstrumentName(row.original.instrumentId) },
    { accessorKey: 'controlLevel', header: 'Level' },
    { accessorKey: 'result', header: 'Result', cell: ({ row }) => row.original.result.toFixed(2) },
    { accessorKey: 'cvPercent', header: 'CV%', cell: ({ row }) => `${row.original.cvPercent}%` },
    { accessorKey: 'recordedAt', header: 'Recorded', cell: ({ row }) => formatDateTime(row.original.recordedAt, locale) },
    { accessorKey: 'status', header: tc('status'), cell: ({ row }) => <Badge variant={statusBadgeVariant(row.original.status)}>{row.original.status}</Badge> },
    {
      id: 'actions', header: tc('actions'),
      cell: ({ row }) => canManage ? (
        <Button size="sm" variant="ghost" onClick={() => deleteRecord(row.original.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
      ) : null,
    },
  ], [canManage, locale, tc, db.instruments]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tc('qualityControl')}</h1>
          <p className="text-muted-foreground">{db.qcRecords.length} QC records</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{tc('add')}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{tc('add')} QC Record</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Instrument</Label>
                  <Select value={form.instrumentId} onValueChange={(v) => setForm({ ...form, instrumentId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{db.instruments.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Test</Label><Input value={form.test} onChange={(e) => setForm({ ...form, test: e.target.value })} /></div>
                <div><Label>Result</Label><Input type="number" step="0.01" value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} /></div>
                <div><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as QCRecord['status'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(['accepted', 'warning', 'rejected', 'pending_review'] as const).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={addRecord} className="w-full">{tc('save')}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Levey-Jennings Chart — {selectedTest}</CardTitle>
          <Select value={selectedTest} onValueChange={setSelectedTest}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{tests.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <DataTable data={db.qcRecords} columns={columns} searchKey="test" searchPlaceholder="Search QC records..." />
    </div>
  );
}
