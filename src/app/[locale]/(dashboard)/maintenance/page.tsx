'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useRouteReplace } from '@/hooks/use-route-replace';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { appendAuditLog, statusBadgeVariant } from '@/lib/page-utils';
import { formatDate, generateId } from '@/lib/utils';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import type { MaintenanceRecord } from '@/types';

export default function MaintenancePage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const canManage = can('maintenance.manage');
  const [db, setDb] = useState(() => getMockDatabase());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ instrumentId: '', maintenanceType: 'daily' as MaintenanceRecord['maintenanceType'], result: 'pass' as MaintenanceRecord['result'] });
  const refresh = useCallback(() => setDb(getMockDatabase()), []);

  const accessDenied = !can('maintenance.view');


  useRouteReplace(accessDenied, `/${locale}/unauthorized`);


  if (accessDenied) return null;

  const stats = useMemo(() => ({
    total: db.maintenanceRecords.length,
    pass: db.maintenanceRecords.filter((m) => m.result === 'pass').length,
    fail: db.maintenanceRecords.filter((m) => m.result === 'fail').length,
    reviewed: db.maintenanceRecords.filter((m) => m.supervisorReview).length,
  }), [db.maintenanceRecords]);

  const complianceRate = stats.total ? Math.round((stats.pass / stats.total) * 100) : 0;

  const addRecord = () => {
    if (!form.instrumentId || !canManage) return;
    const now = new Date().toISOString();
    const record: MaintenanceRecord = {
      id: generateId(),
      instrumentId: form.instrumentId,
      maintenanceType: form.maintenanceType,
      date: now,
      shift: 'morning',
      performedBy: user?.id || db.employees[0]?.id || '',
      checklist: [{ item: 'Visual inspection', completed: true }],
      result: form.result,
      supervisorReview: false,
      createdAt: now,
    };
    db.maintenanceRecords.unshift(record);
    if (user) appendAuditLog(db, user.id, 'create', 'maintenance', record.id);
    saveMockDatabase(db);
    refresh();
    setDialogOpen(false);
    toast.success('Maintenance record added');
  };

  const deleteRecord = (id: string) => {
    if (!canManage || !confirm(tc('confirmDelete'))) return;
    db.maintenanceRecords = db.maintenanceRecords.filter((m) => m.id !== id);
    if (user) appendAuditLog(db, user.id, 'delete', 'maintenance', id);
    saveMockDatabase(db);
    refresh();
    toast.success('Record deleted');
  };

  const getInstrumentName = (id: string) => db.instruments.find((i) => i.id === id)?.name ?? id;
  const getEmployeeName = (id: string) => db.employees.find((e) => e.id === id)?.fullName ?? id;

  const columns: ColumnDef<MaintenanceRecord>[] = useMemo(() => [
    { accessorKey: 'instrumentId', header: 'Instrument', cell: ({ row }) => getInstrumentName(row.original.instrumentId) },
    { accessorKey: 'maintenanceType', header: 'Type' },
    { accessorKey: 'date', header: 'Date', cell: ({ row }) => formatDate(row.original.date, locale) },
    { accessorKey: 'performedBy', header: 'Performed By', cell: ({ row }) => getEmployeeName(row.original.performedBy) },
    { accessorKey: 'result', header: 'Result', cell: ({ row }) => <Badge variant={statusBadgeVariant(row.original.result)}>{row.original.result}</Badge> },
    { accessorKey: 'supervisorReview', header: 'Reviewed', cell: ({ row }) => row.original.supervisorReview ? <Badge variant="success">Yes</Badge> : <Badge variant="secondary">No</Badge> },
    {
      id: 'actions', header: tc('actions'),
      cell: ({ row }) => canManage ? (
        <Button size="sm" variant="ghost" onClick={() => deleteRecord(row.original.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
      ) : null,
    },
  ], [canManage, locale, tc, db.instruments, db.employees]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tc('maintenance')}</h1>
          <p className="text-muted-foreground">Maintenance records & compliance</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{tc('add')}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{tc('add')} Maintenance Record</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Instrument</Label>
                  <Select value={form.instrumentId} onValueChange={(v) => setForm({ ...form, instrumentId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select instrument" /></SelectTrigger>
                    <SelectContent>{db.instruments.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Type</Label>
                  <Select value={form.maintenanceType} onValueChange={(v) => setForm({ ...form, maintenanceType: v as MaintenanceRecord['maintenanceType'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(['daily', 'weekly', 'monthly', 'preventive', 'corrective', 'emergency'] as const).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Result</Label>
                  <Select value={form.result} onValueChange={(v) => setForm({ ...form, result: v as MaintenanceRecord['result'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pass">Pass</SelectItem>
                      <SelectItem value="fail">Fail</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={addRecord} className="w-full">{tc('save')}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Records" value={stats.total} icon={CheckCircle} />
        <StatCard title="Pass Rate" value={`${complianceRate}%`} icon={CheckCircle} iconClassName="bg-emerald-100 text-emerald-600" />
        <StatCard title="Failed" value={stats.fail} icon={XCircle} iconClassName="bg-red-100 text-red-600" />
        <StatCard title="Supervisor Reviewed" value={stats.reviewed} icon={AlertTriangle} iconClassName="bg-amber-100 text-amber-600" />
      </div>

      <Card>
        <CardHeader><CardTitle>Compliance Dashboard</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1 h-4 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${complianceRate}%` }} />
            </div>
            <span className="text-sm font-medium">{complianceRate}% compliant</span>
          </div>
        </CardContent>
      </Card>

      <DataTable data={db.maintenanceRecords} columns={columns} searchKey="maintenanceType" searchPlaceholder="Search maintenance..." />
    </div>
  );
}
