'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { appendAuditLog, maskPatientId, statusBadgeVariant } from '@/lib/page-utils';
import { formatDateTime, generateId } from '@/lib/utils';
import type { CriticalValue } from '@/types';

export default function CriticalValuesPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const canManage = can('critical_values.manage');
  const [db, setDb] = useState(() => getMockDatabase());
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ patientId: '', test: '', result: '', unit: '', department: 'ER', notificationStatus: 'pending' as CriticalValue['notificationStatus'] });
  const refresh = useCallback(() => setDb(getMockDatabase()), []);

  if (!can('critical_values.view')) {
    router.replace(`/${locale}/unauthorized`);
    return null;
  }

  const toggleReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const addRecord = () => {
    if (!form.patientId || !form.test || !canManage) return;
    const now = new Date().toISOString();
    const record: CriticalValue = {
      id: generateId(),
      recordedAt: now,
      patientId: form.patientId,
      test: form.test,
      result: form.result,
      unit: form.unit,
      criticalLimit: '< 20',
      department: form.department,
      readBackCompleted: false,
      reportedBy: user?.id || '',
      notificationStatus: form.notificationStatus,
      createdAt: now,
    };
    db.criticalValues.unshift(record);
    if (user) appendAuditLog(db, user.id, 'create', 'critical_values', record.id);
    saveMockDatabase(db);
    refresh();
    setDialogOpen(false);
    toast.success('Critical value recorded');
  };

  const deleteRecord = (id: string) => {
    if (!canManage || !confirm(tc('confirmDelete'))) return;
    db.criticalValues = db.criticalValues.filter((r) => r.id !== id);
    if (user) appendAuditLog(db, user.id, 'delete', 'critical_values', id);
    saveMockDatabase(db);
    refresh();
    toast.success('Record deleted');
  };

  const columns: ColumnDef<CriticalValue>[] = useMemo(() => [
    { accessorKey: 'recordedAt', header: 'Recorded', cell: ({ row }) => formatDateTime(row.original.recordedAt, locale) },
    {
      accessorKey: 'patientId', header: 'Patient ID',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-mono">{revealed.has(row.original.id) ? row.original.patientId : maskPatientId(row.original.patientId)}</span>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => toggleReveal(row.original.id)}>
            {revealed.has(row.original.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </Button>
        </div>
      ),
    },
    { accessorKey: 'test', header: 'Test' },
    { accessorKey: 'result', header: 'Result', cell: ({ row }) => `${row.original.result} ${row.original.unit}` },
    { accessorKey: 'department', header: 'Department' },
    { accessorKey: 'notificationStatus', header: 'Notification', cell: ({ row }) => <Badge variant={statusBadgeVariant(row.original.notificationStatus)}>{row.original.notificationStatus}</Badge> },
    { accessorKey: 'readBackCompleted', header: 'Read-back', cell: ({ row }) => row.original.readBackCompleted ? <Badge variant="success">Done</Badge> : <Badge variant="warning">Pending</Badge> },
    {
      id: 'actions', header: tc('actions'),
      cell: ({ row }) => canManage ? (
        <Button size="sm" variant="ghost" onClick={() => deleteRecord(row.original.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
      ) : null,
    },
  ], [canManage, locale, revealed, tc]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tc('criticalValues')}</h1>
          <p className="text-muted-foreground">Patient IDs are masked by default</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{tc('add')}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record Critical Value</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Patient ID</Label><Input value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} /></div>
                <div><Label>Test</Label><Input value={form.test} onChange={(e) => setForm({ ...form, test: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Result</Label><Input value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} /></div>
                  <div><Label>Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
                </div>
                <div><Label>Department</Label>
                  <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['ER', 'ICU', 'Ward', 'OPD'].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={addRecord} className="w-full">{tc('save')}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <DataTable data={db.criticalValues} columns={columns} searchKey="test" searchPlaceholder="Search critical values..." />
    </div>
  );
}
