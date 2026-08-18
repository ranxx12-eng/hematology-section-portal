'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2, Eye, EyeOff, Pencil, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { AccessionFieldWithScan } from '@/components/clinical/accession-field-with-scan';
import { CreatableDepartmentCombobox } from '@/components/clinical/creatable-department-combobox';
import { getTubeForTest, useSampleTubeAutoFill } from '@/components/clinical/sample-test-tube-fields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { lookupPatientByAccession } from '@/lib/clinical/accession-lookup';
import { maskPatientId } from '@/lib/page-utils';
import { formatDate } from '@/lib/utils';
import {
  createCriticalValue,
  deleteCriticalValue,
  fetchCriticalValues,
  updateCriticalValue,
} from '@/lib/clinical/critical-values';
import {
  CRITICAL_VALUE_DEPARTMENTS,
  CRITICAL_VALUE_TESTS,
  CRITICAL_VALUE_TUBES,
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
    sampleTube: '',
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
  const { can, user } = useAuth();
  const canManage = can('critical_values.manage');
  const [records, setRecords] = useState<CriticalValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CriticalValueFormData>(() => emptyCriticalValueForm(user?.fullName ?? ''));

  const { resetAutoTubeGuard, applyTubeForTest } = useSampleTubeAutoFill({
    onTubeChange: (sampleTube) => setForm((prev) => ({ ...prev, sampleTube })),
  });

  const departmentOptions = useMemo(() => {
    const fromRecords = records.map((record) => record.department);
    return [...new Set([...CRITICAL_VALUE_DEPARTMENTS, ...fromRecords])].sort();
  }, [records]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchCriticalValues();
    setRecords(result.data);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    if (user?.fullName && !editingId) {
      setForm((prev) => ({ ...prev, initial: user.fullName }));
    }
  }, [user?.fullName, editingId]);

  const accessDenied = !can('critical_values.view');
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);
  if (accessDenied) return null;

  const openAddDialog = () => {
    setEditingId(null);
    setForm(emptyCriticalValueForm(user?.fullName ?? ''));
    resetAutoTubeGuard();
    setDialogOpen(true);
  };

  const openEditDialog = (record: CriticalValue) => {
    setEditingId(record.id);
    setForm(recordToForm(record));
    resetAutoTubeGuard();
    setDialogOpen(true);
  };

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
      setForm((prev) => ({
        ...prev,
        patientAccNumber: result.data!.accession,
        patientId: result.data!.patientId,
        patientName: result.data!.patientName,
      }));
      toast.success('Patient details loaded from prior record');
    }
  };

  const toggleReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveRecord = async () => {
    if (!canManage || !user) return;

    const parsed = criticalValueFormSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Please complete all required fields');
      return;
    }

    setSaving(true);
    const result = editingId
      ? await updateCriticalValue(editingId, user.id, parsed.data)
      : await createCriticalValue(user.id, parsed.data);
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(editingId ? 'Critical value updated' : 'Critical value recorded');
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyCriticalValueForm(user.fullName));
    await loadRecords();
  };

  const deleteRecord = async (id: string) => {
    if (!canManage || !confirm(tc('confirmDelete'))) return;
    const result = await deleteCriticalValue(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Record deleted');
    await loadRecords();
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
    { accessorKey: 'patientAccNumber', header: 'Lab Accession' },
    { accessorKey: 'test', header: 'Sample Test' },
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
          <Button size="sm" variant="ghost" onClick={() => void deleteRecord(row.original.id)}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ) : null,
    },
  ], [canManage, locale, revealed, tc]);

  const suggestedTube = getTubeForTest(form.test);

  const formFields = (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto pe-1">
      <CreatableDepartmentCombobox
        id="cv-department"
        label="Department"
        value={form.department}
        options={departmentOptions}
        required
        onChange={(department) => setForm({ ...form, department })}
      />
      <AccessionFieldWithScan
        id="cv-lab-accession"
        value={form.patientAccNumber}
        required
        onChange={(patientAccNumber) => setForm({ ...form, patientAccNumber })}
        onScanComplete={(accession) => void handleAccessionLookup(accession)}
      />
      {lookupLoading && (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          Looking up accession…
        </p>
      )}
      <div>
        <Label htmlFor="cv-patient-id">Patient ID *</Label>
        <Input id="cv-patient-id" value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} required />
      </div>
      <div>
        <Label htmlFor="cv-patient-name">Patient Name *</Label>
        <Input id="cv-patient-name" value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} required />
      </div>
      <div>
        <Label htmlFor="cv-date">Date *</Label>
        <Input id="cv-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
      </div>
      <div>
        <Label htmlFor="cv-test">Sample Test *</Label>
        <Select
          value={form.test}
          onValueChange={(test) => {
            setForm({ ...form, test });
            applyTubeForTest(test);
          }}
        >
          <SelectTrigger id="cv-test"><SelectValue placeholder="Select test" /></SelectTrigger>
          <SelectContent>
            {CRITICAL_VALUE_TESTS.map((test) => (
              <SelectItem key={test} value={test}>{test}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="cv-sample-tube">Sample Tube *</Label>
        <Input
          id="cv-sample-tube"
          list="cv-sample-tube-options"
          value={form.sampleTube}
          placeholder="Auto-filled from test or enter manually"
          onChange={(e) => setForm({ ...form, sampleTube: e.target.value })}
          required
        />
        <datalist id="cv-sample-tube-options">
          {CRITICAL_VALUE_TUBES.map((tube) => (
            <option key={tube} value={tube} />
          ))}
        </datalist>
        {suggestedTube && form.sampleTube !== suggestedTube && (
          <p className="mt-1 text-xs text-muted-foreground">Suggested tube for {form.test}: {suggestedTube}</p>
        )}
        {!suggestedTube && form.test && (
          <p className="mt-1 text-xs text-muted-foreground">No tube mapping for this test — enter manually.</p>
        )}
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
        <Label htmlFor="cv-comment">Comment</Label>
        <Textarea id="cv-comment" value={form.comment ?? ''} onChange={(e) => setForm({ ...form, comment: e.target.value })} rows={3} />
      </div>
      <div>
        <Label htmlFor="cv-initial">Initial *</Label>
        <Input id="cv-initial" value={form.initial} readOnly disabled className="bg-muted" />
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

      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin me-2" />
          {tc('loading')}
        </div>
      )}

      {!loading && error && (
        <EmptyState title="Unable to load critical values" description={error} />
      )}

      {!loading && !error && records.length === 0 && (
        <EmptyState title="No critical values recorded" description="Critical value records will appear here once added." />
      )}

      {!loading && !error && records.length > 0 && (
        <DataTable data={records} columns={columns} searchKey="test" searchPlaceholder="Search critical values..." />
      )}
    </div>
  );
}
