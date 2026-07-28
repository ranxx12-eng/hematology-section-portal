'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2, Eye, EyeOff, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { appendAuditLog, maskPatientId } from '@/lib/page-utils';
import { formatDate, generateId } from '@/lib/utils';
import {
  CRITICAL_VALUE_DEPARTMENTS,
  CRITICAL_VALUE_TESTS,
  criticalValueFormSchema,
  emptyCriticalValueForm,
  type CriticalValueFormData,
} from '@/lib/critical-values/schema';
import type { CriticalValue } from '@/types';

function recordToForm(record: CriticalValue): CriticalValueFormData {
  return {
    date: record.date,
    patientId: record.patientId,
    patientName: record.patientName,
    patientAccNumber: record.patientAccNumber,
    test: record.test,
    criticalValue: record.criticalValue,
    informedToDr: record.informedToDr,
    drId: record.drId,
    verifyTime: record.verifyTime,
    informedTime: record.informedTime,
    department: record.department,
    comment: record.comment ?? '',
    initial: record.initial,
  };
}

export default function CriticalValuesPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const canManage = can('critical_values.manage');
  const [db, setDb] = useState(() => getMockDatabase());
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CriticalValueFormData>(() => emptyCriticalValueForm(user?.fullName ?? ''));
  const refresh = useCallback(() => setDb(getMockDatabase()), []);

  useEffect(() => {
    if (user?.fullName && !editingId) {
      setForm((prev) => ({ ...prev, initial: user.fullName }));
    }
  }, [user?.fullName, editingId]);

  if (!can('critical_values.view')) {
    router.replace(`/${locale}/unauthorized`);
    return null;
  }

  const openAddDialog = () => {
    setEditingId(null);
    setForm(emptyCriticalValueForm(user?.fullName ?? ''));
    setDialogOpen(true);
  };

  const openEditDialog = (record: CriticalValue) => {
    setEditingId(record.id);
    setForm(recordToForm(record));
    setDialogOpen(true);
  };

  const toggleReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveRecord = () => {
    if (!canManage) return;

    const parsed = criticalValueFormSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Please complete all required fields');
      return;
    }

    const now = new Date().toISOString();
    const data = parsed.data;

    if (editingId) {
      const idx = db.criticalValues.findIndex((r) => r.id === editingId);
      if (idx >= 0) {
        db.criticalValues[idx] = {
          ...db.criticalValues[idx],
          ...data,
          comment: data.comment || undefined,
          updatedAt: now,
        };
        if (user) appendAuditLog(db, user.id, 'update', 'critical_values', editingId);
        toast.success('Critical value updated');
      }
    } else {
      const record: CriticalValue = {
        id: generateId(),
        ...data,
        comment: data.comment || undefined,
        reportedBy: user?.id || '',
        createdAt: now,
        updatedAt: now,
      };
      db.criticalValues.unshift(record);
      if (user) appendAuditLog(db, user.id, 'create', 'critical_values', record.id);
      toast.success('Critical value recorded');
    }

    saveMockDatabase(db);
    refresh();
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyCriticalValueForm(user?.fullName ?? ''));
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
    { accessorKey: 'date', header: 'Date', cell: ({ row }) => formatDate(row.original.date, locale) },
    {
      accessorKey: 'patientId',
      header: 'Patient ID',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-mono">{revealed.has(row.original.id) ? row.original.patientId : maskPatientId(row.original.patientId)}</span>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => toggleReveal(row.original.id)}>
            {revealed.has(row.original.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </Button>
        </div>
      ),
    },
    { accessorKey: 'patientName', header: 'Patient Name' },
    { accessorKey: 'patientAccNumber', header: 'ACC#' },
    { accessorKey: 'test', header: 'Test' },
    { accessorKey: 'criticalValue', header: 'Critical Value' },
    { accessorKey: 'informedToDr', header: 'Informed to Dr' },
    { accessorKey: 'department', header: 'Department' },
    { accessorKey: 'verifyTime', header: 'Verify Time' },
    { accessorKey: 'informedTime', header: 'Informed Time' },
    { accessorKey: 'initial', header: 'Initial' },
    {
      id: 'actions',
      header: tc('actions'),
      cell: ({ row }) => canManage ? (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => openEditDialog(row.original)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => deleteRecord(row.original.id)}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ) : null,
    },
  ], [canManage, locale, revealed, tc]);

  const formFields = (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto pe-1">
      <div>
        <Label htmlFor="cv-date">Date *</Label>
        <Input id="cv-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
      </div>
      <div>
        <Label htmlFor="cv-patient-id">Patient ID *</Label>
        <Input id="cv-patient-id" value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} required />
      </div>
      <div>
        <Label htmlFor="cv-patient-name">Patient Name *</Label>
        <Input id="cv-patient-name" value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} required />
      </div>
      <div>
        <Label htmlFor="cv-patient-acc">Patient ACC# *</Label>
        <Input id="cv-patient-acc" value={form.patientAccNumber} onChange={(e) => setForm({ ...form, patientAccNumber: e.target.value })} required />
      </div>
      <div>
        <Label htmlFor="cv-test">Test *</Label>
        <Select value={form.test} onValueChange={(v) => setForm({ ...form, test: v })}>
          <SelectTrigger id="cv-test"><SelectValue placeholder="Select test" /></SelectTrigger>
          <SelectContent>
            {CRITICAL_VALUE_TESTS.map((test) => (
              <SelectItem key={test} value={test}>{test}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="cv-critical-value">Critical Value *</Label>
        <Input id="cv-critical-value" value={form.criticalValue} onChange={(e) => setForm({ ...form, criticalValue: e.target.value })} required />
      </div>
      <div>
        <Label htmlFor="cv-informed-dr">Informed to Dr *</Label>
        <Input id="cv-informed-dr" value={form.informedToDr} onChange={(e) => setForm({ ...form, informedToDr: e.target.value })} required />
      </div>
      <div>
        <Label htmlFor="cv-dr-id">Dr ID *</Label>
        <Input id="cv-dr-id" value={form.drId} onChange={(e) => setForm({ ...form, drId: e.target.value })} required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="cv-verify-time">Verify Time *</Label>
          <Input id="cv-verify-time" type="time" value={form.verifyTime} onChange={(e) => setForm({ ...form, verifyTime: e.target.value })} required />
        </div>
        <div>
          <Label htmlFor="cv-informed-time">Informed Time *</Label>
          <Input id="cv-informed-time" type="time" value={form.informedTime} onChange={(e) => setForm({ ...form, informedTime: e.target.value })} required />
        </div>
      </div>
      <div>
        <Label htmlFor="cv-department">Department *</Label>
        <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
          <SelectTrigger id="cv-department"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CRITICAL_VALUE_DEPARTMENTS.map((dept) => (
              <SelectItem key={dept} value={dept}>{dept}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="cv-comment">Comment</Label>
        <Textarea id="cv-comment" value={form.comment ?? ''} onChange={(e) => setForm({ ...form, comment: e.target.value })} rows={3} />
      </div>
      <div>
        <Label htmlFor="cv-initial">Initial *</Label>
        <Input id="cv-initial" value={form.initial} readOnly disabled className="bg-muted" />
      </div>
      <Button onClick={saveRecord} className="w-full">{tc('save')}</Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tc('criticalValues')}</h1>
          <p className="text-muted-foreground">Patient IDs are masked by default</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog}>
                <Plus className="h-4 w-4 me-2" />Add Critical Value
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit Critical Value' : 'Add Critical Value'}</DialogTitle>
              </DialogHeader>
              {formFields}
            </DialogContent>
          </Dialog>
        )}
      </div>
      <DataTable data={db.criticalValues} columns={columns} searchKey="test" searchPlaceholder="Search critical values..." />
    </div>
  );
}
