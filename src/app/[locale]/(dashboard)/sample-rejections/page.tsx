'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DataTable } from '@/components/shared/data-table';
import { StatCard } from '@/components/shared/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { appendAuditLog, maskPatientId, statusBadgeVariant } from '@/lib/page-utils';
import { formatDateTime, generateId } from '@/lib/utils';
import { XCircle } from 'lucide-react';
import type { SampleRejection } from '@/types';

const COLORS = ['#2563eb', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#0ea5e9', '#ec4899', '#64748b'];

export default function SampleRejectionsPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const canManage = can('sample_rejections.manage');
  const [db, setDb] = useState(() => getMockDatabase());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ patientId: '', sampleType: 'EDTA', testRequested: 'CBC', rejectionReason: 'clotted', collectionArea: 'ER' });
  const refresh = useCallback(() => setDb(getMockDatabase()), []);

  if (!can('sample_rejections.view')) {
    router.replace(`/${locale}/unauthorized`);
    return null;
  }

  const reasonStats = useMemo(() => {
    const counts: Record<string, number> = {};
    db.sampleRejections.forEach((r) => { counts[r.rejectionReason] = (counts[r.rejectionReason] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [db.sampleRejections]);

  const addRecord = () => {
    if (!form.patientId || !canManage) return;
    const now = new Date().toISOString();
    const record: SampleRejection = {
      id: generateId(),
      recordedAt: now,
      patientId: form.patientId,
      sampleType: form.sampleType,
      testRequested: form.testRequested,
      rejectionReason: form.rejectionReason,
      collectionArea: form.collectionArea,
      rejectedBy: user?.id || '',
      recollectionRequested: true,
      finalStatus: 'open',
      createdAt: now,
    };
    db.sampleRejections.unshift(record);
    if (user) appendAuditLog(db, user.id, 'create', 'sample_rejections', record.id);
    saveMockDatabase(db);
    refresh();
    setDialogOpen(false);
    toast.success('Rejection recorded');
  };

  const deleteRecord = (id: string) => {
    if (!canManage || !confirm(tc('confirmDelete'))) return;
    db.sampleRejections = db.sampleRejections.filter((r) => r.id !== id);
    if (user) appendAuditLog(db, user.id, 'delete', 'sample_rejections', id);
    saveMockDatabase(db);
    refresh();
    toast.success('Record deleted');
  };

  const columns: ColumnDef<SampleRejection>[] = useMemo(() => [
    { accessorKey: 'recordedAt', header: 'Recorded', cell: ({ row }) => formatDateTime(row.original.recordedAt, locale) },
    { accessorKey: 'patientId', header: 'Patient ID', cell: ({ row }) => <span className="font-mono">{maskPatientId(row.original.patientId)}</span> },
    { accessorKey: 'sampleType', header: 'Sample' },
    { accessorKey: 'testRequested', header: 'Test' },
    { accessorKey: 'rejectionReason', header: 'Reason' },
    { accessorKey: 'collectionArea', header: 'Area' },
    { accessorKey: 'finalStatus', header: tc('status'), cell: ({ row }) => <Badge variant={statusBadgeVariant(row.original.finalStatus)}>{row.original.finalStatus}</Badge> },
    {
      id: 'actions', header: tc('actions'),
      cell: ({ row }) => canManage ? (
        <Button size="sm" variant="ghost" onClick={() => deleteRecord(row.original.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
      ) : null,
    },
  ], [canManage, locale, tc]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tc('sampleRejections')}</h1>
          <p className="text-muted-foreground">{db.sampleRejections.length} rejections recorded</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{tc('add')}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record Sample Rejection</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Patient ID</Label><Input value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} /></div>
                <div><Label>Sample Type</Label>
                  <Select value={form.sampleType} onValueChange={(v) => setForm({ ...form, sampleType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{['EDTA', 'Citrate', 'Serum'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Test Requested</Label><Input value={form.testRequested} onChange={(e) => setForm({ ...form, testRequested: e.target.value })} /></div>
                <div><Label>Rejection Reason</Label>
                  <Select value={form.rejectionReason} onValueChange={(v) => setForm({ ...form, rejectionReason: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['clotted', 'hemolyzed', 'insufficient_volume', 'wrong_tube', 'unlabeled', 'mislabeled', 'leaking', 'delayed_transport'].map((r) => (
                        <SelectItem key={r} value={r}>{r.replace('_', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={addRecord} className="w-full">{tc('save')}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total Rejections" value={db.sampleRejections.length} icon={XCircle} iconClassName="bg-red-100 text-red-600" />
        <StatCard title="Open" value={db.sampleRejections.filter((r) => r.finalStatus === 'open').length} icon={XCircle} />
        <StatCard title="Recollected" value={db.sampleRejections.filter((r) => r.finalStatus === 'recollected').length} icon={XCircle} iconClassName="bg-emerald-100 text-emerald-600" />
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

      <DataTable data={db.sampleRejections} columns={columns} searchKey="rejectionReason" searchPlaceholder="Search rejections..." />
    </div>
  );
}
