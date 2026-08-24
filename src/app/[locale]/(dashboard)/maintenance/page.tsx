'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Pencil, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { StatCard } from '@/components/shared/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { statusBadgeVariant } from '@/lib/page-utils';
import { formatDateTime } from '@/lib/utils';
import {
  computeMaintenanceSummary,
  emptyMaintenanceRecordForm,
  maintenanceRecordFormSchema,
  recordToForm,
  type MaintenanceRecordFormData,
} from '@/lib/maintenance-records/schema';
import {
  MAINTENANCE_RESULTS,
  MAINTENANCE_SHIFTS,
  MAINTENANCE_TYPES,
  MAINTENANCE_TYPE_OPTIONS,
} from '@/lib/maintenance-records/constants';
import {
  createMaintenanceRecord,
  fetchInstrumentNameMap,
  fetchMaintenanceInstruments,
  fetchMaintenanceRecords,
  updateMaintenanceRecord,
} from '@/lib/clinical/maintenance-records';
import { fetchStaffIdentityMap } from '@/lib/clinical/staff-profiles';
import { StaffIdentity } from '@/components/shared/staff-identity';
import { STAFF_ID_NOT_ASSIGNED } from '@/lib/staff/identity';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import type { MaintenanceRecord } from '@/types';

export default function MaintenancePage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can, user } = useAuth();
  const canManage = can('maintenance.manage');
  const canPerform = can('maintenance.perform');
  const canAdd = canManage || canPerform;
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [instrumentOptions, setInstrumentOptions] = useState<{ id: string; name: string }[]>([]);
  const [instrumentNames, setInstrumentNames] = useState<Record<string, string>>({});
  const [staffIdentities, setStaffIdentities] = useState<Record<string, { fullName: string; staffId: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MaintenanceRecordFormData>(() => emptyMaintenanceRecordForm());
  const [performerName, setPerformerName] = useState('');

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [recordsResult, instruments, names, staffMap] = await Promise.all([
      fetchMaintenanceRecords(),
      fetchMaintenanceInstruments(),
      fetchInstrumentNameMap(),
      fetchStaffIdentityMap(),
    ]);
    setRecords(recordsResult.data);
    setError(recordsResult.error);
    setInstrumentOptions(instruments);
    setInstrumentNames(names);
    setStaffIdentities(staffMap);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    if (!user) return;
    void resolveStaffContext(user).then((ctx) => {
      setPerformerName(ctx.fullName);
    });
  }, [user]);

  const accessDenied = !can('maintenance.view');

  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  const stats = useMemo(() => computeMaintenanceSummary(records), [records]);

  const resetForm = useCallback(() => {
    setForm(emptyMaintenanceRecordForm());
    setEditingId(null);
  }, []);

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (record: MaintenanceRecord) => {
    setEditingId(record.id);
    setForm(recordToForm(record));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (editingId ? !canManage : !canAdd) return;

    const parsed = maintenanceRecordFormSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid form');
      return;
    }

    setSaving(true);

    if (editingId) {
      const result = await updateMaintenanceRecord(editingId, parsed.data);
      setSaving(false);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Maintenance record updated');
    } else {
      if (!user) {
        setSaving(false);
        toast.error('You must be signed in to add a record');
        return;
      }
      const staff = await resolveStaffContext(user);
      const result = await createMaintenanceRecord(staff, parsed.data);
      setSaving(false);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Maintenance record added');
    }

    setDialogOpen(false);
    resetForm();
    void loadRecords();
  };

  const getInstrumentName = (id: string) => instrumentNames[id] ?? id;
  const getPerformerIdentity = (profileId: string) => staffIdentities[profileId] ?? {
    fullName: 'Unknown staff',
    staffId: null,
  };

  const columns: ColumnDef<MaintenanceRecord>[] = useMemo(() => [
    {
      accessorKey: 'instrumentId',
      header: 'Instrument',
      cell: ({ row }) => getInstrumentName(row.original.instrumentId),
    },
    { accessorKey: 'maintenanceType', header: 'Type' },
    {
      accessorKey: 'date',
      header: 'Completed',
      cell: ({ row }) => formatDateTime(row.original.date, locale),
    },
    {
      accessorKey: 'performedBy',
      header: 'Performed By',
      cell: ({ row }) => {
        const identity = getPerformerIdentity(row.original.performedBy);
        return <StaffIdentity fullName={identity.fullName} staffId={identity.staffId} />;
      },
    },
    {
      accessorKey: 'result',
      header: 'Result',
      cell: ({ row }) => (
        <Badge variant={statusBadgeVariant(row.original.result)}>{row.original.result}</Badge>
      ),
    },
    {
      accessorKey: 'supervisorReview',
      header: 'Reviewed',
      cell: ({ row }) => row.original.supervisorReview
        ? <Badge variant="success">Yes</Badge>
        : <Badge variant="secondary">No</Badge>,
    },
    {
      id: 'actions',
      header: tc('actions'),
      cell: ({ row }) => canManage ? (
        <Button size="sm" variant="ghost" onClick={() => openEditDialog(row.original)}>
          <Pencil className="h-4 w-4" />
        </Button>
      ) : null,
    },
  ], [canManage, locale, tc, instrumentNames, staffIdentities]);

  if (accessDenied) return null;

  return (
    <div className="space-y-6">
      <PageContentSections
        pageKey="maintenance"
        fallbackTitle={tc('maintenance')}
        fallbackSubtitle="Maintenance records & compliance"
      >
        {canAdd && (
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 me-2" />
                Add Maintenance Record
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? 'Edit Maintenance Record' : 'Add Maintenance Record'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Instrument</Label>
                  <Select
                    value={form.instrumentId}
                    onValueChange={(v) => setForm({ ...form, instrumentId: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select instrument" /></SelectTrigger>
                    <SelectContent>
                      {instrumentOptions.map((i) => (
                        <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Type</Label>
                  <Select
                    value={form.maintenanceType}
                    onValueChange={(v) => setForm({
                      ...form,
                      maintenanceType: v as MaintenanceRecordFormData['maintenanceType'],
                    })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(editingId
                        ? MAINTENANCE_TYPE_OPTIONS
                        : (canManage ? MAINTENANCE_TYPE_OPTIONS : MAINTENANCE_TYPES)
                      ).map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Completion Date</Label>
                    <Input
                      type="date"
                      value={form.maintenanceDate}
                      onChange={(e) => setForm({ ...form, maintenanceDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Completion Time</Label>
                    <Input
                      type="time"
                      value={form.maintenanceTime}
                      onChange={(e) => setForm({ ...form, maintenanceTime: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Shift</Label>
                  <Select
                    value={form.shift}
                    onValueChange={(v) => setForm({
                      ...form,
                      shift: v as MaintenanceRecordFormData['shift'],
                    })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MAINTENANCE_SHIFTS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Result</Label>
                  <Select
                    value={form.result}
                    onValueChange={(v) => setForm({
                      ...form,
                      result: v as MaintenanceRecordFormData['result'],
                    })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MAINTENANCE_RESULTS.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Comments</Label>
                  <Textarea
                    value={form.comments ?? ''}
                    onChange={(e) => setForm({ ...form, comments: e.target.value })}
                    placeholder="Optional notes about this maintenance activity"
                    rows={3}
                  />
                </div>
                {!editingId && (
                  <p className="text-sm text-muted-foreground">
                    Performed by: {performerName || user?.fullName}
                    {user?.staffId ? ` (${user.staffId})` : ` (${STAFF_ID_NOT_ASSIGNED})`}
                  </p>
                )}
                <Button onClick={() => void handleSave()} className="w-full" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                  {tc('save')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </PageContentSections>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <EmptyState
          title="Unable to load maintenance records"
          description={error}
          action={<Button onClick={() => void loadRecords()}>Retry</Button>}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Records" value={stats.total} icon={CheckCircle} />
            <StatCard title="Pass Rate" value={`${stats.complianceRate}%`} icon={CheckCircle} iconClassName="bg-emerald-100 text-emerald-600" />
            <StatCard title="Failed" value={stats.fail} icon={XCircle} iconClassName="bg-red-100 text-red-600" />
            <StatCard title="Supervisor Reviewed" value={stats.reviewed} icon={AlertTriangle} iconClassName="bg-amber-100 text-amber-600" />
          </div>

          <Card>
            <CardHeader><CardTitle>Compliance Dashboard</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-4 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${stats.complianceRate}%` }} />
                </div>
                <span className="text-sm font-medium">{stats.complianceRate}% compliant</span>
              </div>
            </CardContent>
          </Card>

          {records.length === 0 ? (
            <EmptyState
              title="No maintenance records yet"
              description="Maintenance activity will appear here once records are logged."
              action={canAdd ? (
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 me-2" />
                  Add Maintenance Record
                </Button>
              ) : undefined}
            />
          ) : (
            <DataTable
              data={records}
              columns={columns}
              searchKey="maintenanceType"
              searchPlaceholder="Search maintenance..."
            />
          )}
        </>
      )}
    </div>
  );
}
