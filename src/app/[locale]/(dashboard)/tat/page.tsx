'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { StatCard } from '@/components/shared/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { appendAuditLog, statusBadgeVariant } from '@/lib/page-utils';
import { formatDateTime, generateId } from '@/lib/utils';
import { Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import type { TATRecord } from '@/types';

export default function TATPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const canManage = can('tat.manage');
  const [db, setDb] = useState(() => getMockDatabase());
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ testType: 'CBC', priority: 'routine' as TATRecord['priority'], calculatedTat: '120', targetTat: '240', department: 'ER' });
  const refresh = useCallback(() => setDb(getMockDatabase()), []);

  if (!can('tat.view')) {
    router.replace(`/${locale}/unauthorized`);
    return null;
  }

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return db.tatRecords;
    return db.tatRecords.filter((r) => r.status === statusFilter);
  }, [db.tatRecords, statusFilter]);

  const stats = useMemo(() => ({
    within: db.tatRecords.filter((r) => r.status === 'within_target').length,
    near: db.tatRecords.filter((r) => r.status === 'near_breach').length,
    breached: db.tatRecords.filter((r) => r.status === 'breached').length,
  }), [db.tatRecords]);

  const addRecord = () => {
    if (!canManage) return;
    const now = new Date().toISOString();
    const tat = parseInt(form.calculatedTat, 10);
    const target = parseInt(form.targetTat, 10);
    const record: TATRecord = {
      id: generateId(),
      sampleReceivedTime: now,
      resultReleasedTime: new Date(Date.now() + tat * 60000).toISOString(),
      calculatedTat: tat,
      targetTat: target,
      testType: form.testType,
      priority: form.priority,
      department: form.department,
      shift: 'morning',
      status: tat > target ? 'breached' : tat > target * 0.85 ? 'near_breach' : 'within_target',
      createdAt: now,
    };
    db.tatRecords.unshift(record);
    if (user) appendAuditLog(db, user.id, 'create', 'tat', record.id);
    saveMockDatabase(db);
    refresh();
    setDialogOpen(false);
    toast.success('TAT record added');
  };

  const deleteRecord = (id: string) => {
    if (!canManage || !confirm(tc('confirmDelete'))) return;
    db.tatRecords = db.tatRecords.filter((r) => r.id !== id);
    if (user) appendAuditLog(db, user.id, 'delete', 'tat', id);
    saveMockDatabase(db);
    refresh();
    toast.success('Record deleted');
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
          <h1 className="text-2xl font-bold">{tc('tat')}</h1>
          <p className="text-muted-foreground">Turnaround time monitoring</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{tc('add')}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{tc('add')} TAT Record</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Test Type</Label><Input value={form.testType} onChange={(e) => setForm({ ...form, testType: e.target.value })} /></div>
                <div><Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as TATRecord['priority'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="stat">STAT</SelectItem><SelectItem value="routine">Routine</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>TAT (min)</Label><Input type="number" value={form.calculatedTat} onChange={(e) => setForm({ ...form, calculatedTat: e.target.value })} /></div>
                  <div><Label>Target (min)</Label><Input type="number" value={form.targetTat} onChange={(e) => setForm({ ...form, targetTat: e.target.value })} /></div>
                </div>
                <Button onClick={addRecord} className="w-full">{tc('save')}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Within Target" value={stats.within} icon={CheckCircle} iconClassName="bg-emerald-100 text-emerald-600" />
        <StatCard title="Near Breach" value={stats.near} icon={AlertTriangle} iconClassName="bg-amber-100 text-amber-600" />
        <StatCard title="Breached" value={stats.breached} icon={Clock} iconClassName="bg-red-100 text-red-600" />
      </div>

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
    </div>
  );
}
