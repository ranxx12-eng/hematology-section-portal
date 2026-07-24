'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { appendAuditLog, maskPatientId } from '@/lib/page-utils';
import { formatDate, generateId } from '@/lib/utils';
import type { CorrectedResult } from '@/types';

export default function CorrectedResultsPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const canManage = can('corrected_results.manage');
  const [db, setDb] = useState(() => getMockDatabase());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ patientId: '', test: '', originalResult: '', correctedResult: '', reason: '' });
  const refresh = useCallback(() => setDb(getMockDatabase()), []);

  if (!can('corrected_results.view')) {
    router.replace(`/${locale}/unauthorized`);
    return null;
  }

  const addRecord = () => {
    if (!form.patientId || !form.test || !canManage) return;
    const now = new Date().toISOString();
    const record: CorrectedResult = {
      id: generateId(),
      date: now,
      patientId: form.patientId,
      test: form.test,
      originalResult: form.originalResult,
      correctedResult: form.correctedResult,
      reason: form.reason || 'Transcription error',
      correctedBy: user?.id || '',
      physicianNotified: false,
      createdAt: now,
    };
    db.correctedResults.unshift(record);
    if (user) appendAuditLog(db, user.id, 'create', 'corrected_results', record.id);
    saveMockDatabase(db);
    refresh();
    setDialogOpen(false);
    toast.success('Corrected result recorded');
  };

  const deleteRecord = (id: string) => {
    if (!canManage || !confirm(tc('confirmDelete'))) return;
    db.correctedResults = db.correctedResults.filter((r) => r.id !== id);
    if (user) appendAuditLog(db, user.id, 'delete', 'corrected_results', id);
    saveMockDatabase(db);
    refresh();
    toast.success('Record deleted');
  };

  const columns: ColumnDef<CorrectedResult>[] = useMemo(() => [
    { accessorKey: 'date', header: 'Date', cell: ({ row }) => formatDate(row.original.date, locale) },
    { accessorKey: 'patientId', header: 'Patient ID', cell: ({ row }) => <span className="font-mono">{maskPatientId(row.original.patientId)}</span> },
    { accessorKey: 'test', header: 'Test' },
    { accessorKey: 'originalResult', header: 'Original' },
    { accessorKey: 'correctedResult', header: 'Corrected' },
    { accessorKey: 'reason', header: 'Reason' },
    { accessorKey: 'physicianNotified', header: 'Physician Notified', cell: ({ row }) => row.original.physicianNotified ? <Badge variant="success">Yes</Badge> : <Badge variant="warning">No</Badge> },
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
          <h1 className="text-2xl font-bold">{tc('correctedResults')}</h1>
          <p className="text-muted-foreground">{db.correctedResults.length} corrections on file</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{tc('add')}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record Corrected Result</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Patient ID</Label><Input value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} /></div>
                <div><Label>Test</Label><Input value={form.test} onChange={(e) => setForm({ ...form, test: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Original</Label><Input value={form.originalResult} onChange={(e) => setForm({ ...form, originalResult: e.target.value })} /></div>
                  <div><Label>Corrected</Label><Input value={form.correctedResult} onChange={(e) => setForm({ ...form, correctedResult: e.target.value })} /></div>
                </div>
                <div><Label>Reason</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
                <Button onClick={addRecord} className="w-full">{tc('save')}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <DataTable data={db.correctedResults} columns={columns} searchKey="test" searchPlaceholder="Search corrected results..." />
    </div>
  );
}
