'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, Clock, CheckCircle2, PackageCheck, Archive, History, Loader2, Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/components/providers/auth-provider';
import { maskPatientId, statusBadgeVariant } from '@/lib/page-utils';
import { formatDateTime } from '@/lib/utils';
import {
  createPendingSample,
  fetchPendingSamples,
  updatePendingSample,
} from '@/lib/clinical/pending-samples';
import { canConfirmDiscard } from '@/lib/sample-rejections/permissions';
import {
  emptyPendingSampleForm,
  PENDING_SAMPLE_STATUSES,
  pendingSampleFormSchema,
  REJECTED_TESTS,
  type PendingSampleFormData,
} from '@/lib/pending-samples/schema';
import type { PendingSample } from '@/types';
import { cn } from '@/lib/utils';

function toLocalDateTime(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function sampleToForm(sample: PendingSample): PendingSampleFormData {
  return {
    sourceType: sample.sourceType,
    patientId: sample.patientId,
    patientName: sample.patientName ?? '',
    patientLabAccNumber: sample.patientLabAccNumber ?? '',
    department: sample.department ?? '',
    test: sample.test,
    priority: sample.priority,
    receivedTime: toLocalDateTime(sample.receivedTime),
    currentStatus: sample.currentStatus,
    isActive: sample.isActive,
    assignedStaffName: sample.assignedStaffName ?? '',
    delayReason: sample.delayReason ?? '',
  };
}

export default function PendingSamplesPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can, role, user } = useAuth();
  const canManage = can('tat.manage')
    || role === 'senior_lab_technologist'
    || role === 'section_supervisor';
  const [samples, setSamples] = useState<PendingSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('active');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PendingSampleFormData>(() => emptyPendingSampleForm());

  const loadSamples = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchPendingSamples();
    setSamples(result.data);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSamples();
  }, [loadSamples]);

  const accessDenied = !can('tat.view');
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);
  if (accessDenied) return null;

  const activeSamples = useMemo(() => samples.filter((p) => p.isActive), [samples]);
  const historySamples = useMemo(() => samples.filter((p) => !p.isActive), [samples]);
  const rejectionActive = activeSamples.filter((p) => p.sourceType === 'rejection');
  const tatActive = activeSamples.filter((p) => p.sourceType === 'tat');
  const discardDue = rejectionActive.filter((p) => p.currentStatus === 'Discard Due');

  const notifyWorkflowLater = () => {
    toast.info('Replacement and discard workflow actions will be enabled in a later phase.');
  };

  const openAddDialog = () => {
    setEditingId(null);
    setForm(emptyPendingSampleForm());
    setDialogOpen(true);
  };

  const openEditDialog = (sample: PendingSample) => {
    setEditingId(sample.id);
    setForm(sampleToForm(sample));
    setDialogOpen(true);
  };

  const saveSample = async () => {
    if (!canManage || !user) return;

    const parsed = pendingSampleFormSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Please complete all required fields');
      return;
    }

    setSaving(true);
    const result = editingId
      ? await updatePendingSample(editingId, parsed.data)
      : await createPendingSample(user.id, parsed.data);
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(editingId ? 'Pending sample updated' : 'Pending sample created');
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyPendingSampleForm());
    await loadSamples();
  };

  const getAlertLevel = (sample: PendingSample) => {
    if (sample.sourceType === 'rejection') {
      if (sample.currentStatus === 'Discard Due') return 'critical';
      if (sample.replacementSampleStatus === 'Awaiting Replacement Sample' && sample.elapsedMinutes > 1440) return 'warning';
      return 'normal';
    }
    if (sample.priority === 'stat' && sample.elapsedMinutes > 45) return 'critical';
    if (sample.priority === 'stat' && sample.elapsedMinutes > 30) return 'warning';
    if (sample.priority === 'routine' && sample.elapsedMinutes > 180) return 'critical';
    if (sample.priority === 'routine' && sample.elapsedMinutes > 120) return 'warning';
    return 'normal';
  };

  const renderSampleCard = (sample: PendingSample, showActions: boolean) => {
    const level = getAlertLevel(sample);
    return (
      <Card key={sample.id} className={cn(
        'relative overflow-hidden',
        level === 'critical' && 'border-red-500 shadow-red-100 shadow-md',
        level === 'warning' && 'border-amber-500',
      )}>
        {level === 'critical' && <div className="absolute top-0 inset-x-0 h-1 bg-red-500 animate-pulse" />}
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">{sample.test}</CardTitle>
            <div className="flex items-center gap-1">
              <Badge variant={sample.sourceType === 'rejection' ? 'warning' : sample.priority === 'stat' ? 'destructive' : 'secondary'}>
                {sample.sourceType === 'rejection' ? 'Rejection' : sample.priority}
              </Badge>
              {canManage && (
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditDialog(sample)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="font-mono">{maskPatientId(sample.patientId)}</p>
          {sample.patientName && <p>{sample.patientName}</p>}
          {sample.patientLabAccNumber && <p>ACC#: {sample.patientLabAccNumber}</p>}
          {sample.department && <p>Department: {sample.department}</p>}
          {sample.rejectedTube && <p>Tube: {sample.rejectedTube}</p>}
          {sample.rejectionReasons && <p>Reasons: {sample.rejectionReasons.join(', ')}</p>}
          <p className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" />{sample.elapsedMinutes} min elapsed</p>
          <Badge variant={statusBadgeVariant(sample.replacementSampleStatus ?? sample.currentStatus)}>{sample.replacementSampleStatus ?? sample.currentStatus}</Badge>
          <p>Staff: {sample.assignedStaffName ?? 'Unassigned'}</p>
          <p className="text-xs text-muted-foreground">Received: {formatDateTime(sample.receivedTime, locale)}</p>
          {showActions && sample.sourceType === 'rejection' && canManage && (
            <div className="flex flex-col gap-2 pt-2">
              {sample.replacementSampleStatus === 'Awaiting Replacement Sample' && (
                <Button size="sm" onClick={notifyWorkflowLater}>
                  <PackageCheck className="h-4 w-4 me-2" />Mark Replacement Sample as Received
                </Button>
              )}
              {sample.replacementSampleStatus === 'Replacement Sample Received' && (
                <Button size="sm" onClick={notifyWorkflowLater}>
                  <CheckCircle2 className="h-4 w-4 me-2" />Mark as Completed
                </Button>
              )}
              {sample.currentStatus === 'Discard Due' && role && canConfirmDiscard(role) && (
                <Button size="sm" variant="destructive" onClick={notifyWorkflowLater}>
                  <Archive className="h-4 w-4 me-2" />Confirm Sample Discard
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const formFields = (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto pe-1">
      <div>
        <Label htmlFor="ps-source">Source Type *</Label>
        <Select value={form.sourceType} onValueChange={(v) => setForm({ ...form, sourceType: v as PendingSampleFormData['sourceType'] })}>
          <SelectTrigger id="ps-source"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tat">TAT Queue</SelectItem>
            <SelectItem value="rejection">Rejection Follow-up</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="ps-patient-id">Patient ID *</Label>
          <Input id="ps-patient-id" value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="ps-patient-name">Patient Name</Label>
          <Input id="ps-patient-name" value={form.patientName ?? ''} onChange={(e) => setForm({ ...form, patientName: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="ps-acc">Lab ACC#</Label>
          <Input id="ps-acc" value={form.patientLabAccNumber ?? ''} onChange={(e) => setForm({ ...form, patientLabAccNumber: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="ps-department">Department</Label>
          <Input id="ps-department" value={form.department ?? ''} onChange={(e) => setForm({ ...form, department: e.target.value })} />
        </div>
      </div>
      <div>
        <Label htmlFor="ps-test">Test *</Label>
        <Select value={form.test} onValueChange={(v) => setForm({ ...form, test: v })}>
          <SelectTrigger id="ps-test"><SelectValue placeholder="Select test" /></SelectTrigger>
          <SelectContent>
            {REJECTED_TESTS.map((test) => <SelectItem key={test} value={test}>{test}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="ps-priority">Priority *</Label>
          <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as PendingSampleFormData['priority'] })}>
            <SelectTrigger id="ps-priority"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="stat">Stat</SelectItem>
              <SelectItem value="routine">Routine</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="ps-received">Received Time *</Label>
          <Input id="ps-received" type="datetime-local" value={form.receivedTime} onChange={(e) => setForm({ ...form, receivedTime: e.target.value })} />
        </div>
      </div>
      <div>
        <Label htmlFor="ps-status">Current Status *</Label>
        <Select value={form.currentStatus} onValueChange={(v) => setForm({ ...form, currentStatus: v })}>
          <SelectTrigger id="ps-status"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PENDING_SAMPLE_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="ps-staff">Assigned Staff</Label>
        <Input id="ps-staff" value={form.assignedStaffName ?? ''} onChange={(e) => setForm({ ...form, assignedStaffName: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="ps-delay">Delay Reason</Label>
        <Textarea id="ps-delay" value={form.delayReason ?? ''} onChange={(e) => setForm({ ...form, delayReason: e.target.value })} rows={2} />
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <Label htmlFor="ps-active">Active Sample</Label>
        <Switch id="ps-active" checked={form.isActive} onCheckedChange={(checked) => setForm({ ...form, isActive: checked })} />
      </div>
      <Button onClick={() => void saveSample()} className="w-full" disabled={saving}>
        {saving ? tc('loading') : tc('save')}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tc('pendingSamples')}</h1>
          <p className="text-muted-foreground">{loading ? 'Loading…' : `${activeSamples.length} active samples`}</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog}><Plus className="h-4 w-4 me-2" />Add Pending Sample</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editingId ? 'Edit Pending Sample' : 'Add Pending Sample'}</DialogTitle></DialogHeader>
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
        <EmptyState title="Unable to load pending samples" description={error} />
      )}

      {!loading && !error && samples.length === 0 && (
        <EmptyState title="No pending samples" description="Active and historical pending samples will appear here once recorded." />
      )}

      {!loading && !error && samples.length > 0 && (
        <>
          {discardDue.length > 0 && (
            <Card className="border-amber-500">
              <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" />Samples Due for Discard ({discardDue.length})</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {discardDue.map((sample) => renderSampleCard(sample, true))}
              </CardContent>
            </Card>
          )}

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="active">Active ({activeSamples.length})</TabsTrigger>
              <TabsTrigger value="history"><History className="h-4 w-4 me-1" />History ({historySamples.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="space-y-6 mt-4">
              {activeSamples.length === 0 ? (
                <p className="text-muted-foreground">No active pending samples.</p>
              ) : (
                <>
                  {rejectionActive.length > 0 && (
                    <section>
                      <h2 className="text-lg font-semibold mb-3">Rejected Sample Replacements</h2>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {rejectionActive.map((sample) => renderSampleCard(sample, true))}
                      </div>
                    </section>
                  )}
                  {tatActive.length > 0 && (
                    <section>
                      <h2 className="text-lg font-semibold mb-3">Processing Queue (TAT)</h2>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {tatActive.map((sample) => renderSampleCard(sample, false))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </TabsContent>
            <TabsContent value="history" className="mt-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {historySamples.length === 0 ? (
                  <p className="text-muted-foreground">No history records yet.</p>
                ) : historySamples.map((sample) => renderSampleCard(sample, false))}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
