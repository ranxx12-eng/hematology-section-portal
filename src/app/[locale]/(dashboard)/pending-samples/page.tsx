'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, Clock, Zap, CheckCircle2, PackageCheck, Archive, History } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { appendAuditLog, maskPatientId, statusBadgeVariant } from '@/lib/page-utils';
import { formatDateTime } from '@/lib/utils';
import { calculateElapsedMinutes, getRetentionDays, resolveStaffContext, syncDiscardDueStatuses } from '@/lib/sample-rejections/workflow';
import { canConfirmDiscard } from '@/lib/sample-rejections/permissions';
import type { PendingSample } from '@/types';
import { cn } from '@/lib/utils';

export default function PendingSamplesPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user, role } = useAuth();
  const canManage = can('tat.manage') || can('sample_rejections.manage');
  const [db, setDb] = useState(() => getMockDatabase());
  const [tab, setTab] = useState('active');
  const refresh = useCallback(() => {
    const next = getMockDatabase();
    syncDiscardDueStatuses(next.sampleRejections, next.pendingSamples, next.employees, next.notifications, getRetentionDays(next.settings));
    saveMockDatabase(next);
    setDb(next);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const staff = useMemo(() => {
    if (!user) return { userId: '', fullName: '', staffId: '' };
    return resolveStaffContext(user.id, user.fullName, db.employees);
  }, [user, db.employees]);

  const accessDenied = !can('tat.view');


  useRouteReplace(accessDenied, `/${locale}/unauthorized`);


  if (accessDenied) return null;

  const activeSamples = useMemo(() => db.pendingSamples.filter((p) => p.isActive), [db.pendingSamples]);
  const historySamples = useMemo(() => db.pendingSamples.filter((p) => !p.isActive), [db.pendingSamples]);
  const rejectionActive = activeSamples.filter((p) => p.sourceType === 'rejection');
  const tatActive = activeSamples.filter((p) => p.sourceType === 'tat');
  const discardDue = rejectionActive.filter((p) => p.currentStatus === 'Discard Due');

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

  const markReplacementReceived = (sample: PendingSample) => {
    if (!canManage || !user || sample.sourceType !== 'rejection' || !sample.sampleRejectionId) return;
    if (sample.replacementSampleStatus !== 'Awaiting Replacement Sample') {
      toast.error('Replacement can only be marked received from Awaiting status');
      return;
    }
    if (!confirm('Mark replacement sample as received?')) return;

    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 5);
    const pendingIdx = db.pendingSamples.findIndex((p) => p.id === sample.id);
    const rejectionIdx = db.sampleRejections.findIndex((r) => r.id === sample.sampleRejectionId);

    if (pendingIdx >= 0) {
      db.pendingSamples[pendingIdx] = {
        ...db.pendingSamples[pendingIdx],
        replacementSampleStatus: 'Replacement Sample Received',
        currentStatus: 'Replacement Sample Received',
        elapsedMinutes: calculateElapsedMinutes(sample.rejectionDate ?? date, sample.rejectionTime ?? time),
        updatedAt: now.toISOString(),
      };
    }
    if (rejectionIdx >= 0) {
      db.sampleRejections[rejectionIdx] = {
        ...db.sampleRejections[rejectionIdx],
        replacementSampleStatus: 'Replacement Sample Received',
        replacementReceivedDate: date,
        replacementReceivedTime: time,
        replacementReceivedByUserId: user.id,
        replacementReceivedByName: staff.fullName,
        replacementReceivedByStaffId: staff.staffId,
        updatedAt: now.toISOString(),
      };
    }
    appendAuditLog(db, user.id, 'update', 'pending_samples', sample.id, undefined, 'replacement_received');
    saveMockDatabase(db);
    refresh();
    toast.success('Replacement sample marked as received');
  };

  const markCompleted = (sample: PendingSample) => {
    if (!canManage || !user || sample.sourceType !== 'rejection' || !sample.sampleRejectionId) return;
    if (sample.replacementSampleStatus !== 'Replacement Sample Received') {
      toast.error('Sample must be marked received before completion');
      return;
    }
    if (!confirm('Mark this sample as completed?')) return;

    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 5);
    const pendingIdx = db.pendingSamples.findIndex((p) => p.id === sample.id);
    const rejectionIdx = db.sampleRejections.findIndex((r) => r.id === sample.sampleRejectionId);

    if (pendingIdx >= 0) {
      db.pendingSamples[pendingIdx] = {
        ...db.pendingSamples[pendingIdx],
        replacementSampleStatus: 'Completed',
        currentStatus: 'Completed',
        isActive: false,
        updatedAt: now.toISOString(),
      };
    }
    if (rejectionIdx >= 0) {
      db.sampleRejections[rejectionIdx] = {
        ...db.sampleRejections[rejectionIdx],
        replacementSampleStatus: 'Completed',
        completionDate: date,
        completionTime: time,
        completedByUserId: user.id,
        completedByName: staff.fullName,
        completedByStaffId: staff.staffId,
        updatedAt: now.toISOString(),
      };
    }
    appendAuditLog(db, user.id, 'update', 'pending_samples', sample.id, undefined, 'completed');
    saveMockDatabase(db);
    refresh();
    toast.success('Sample marked as completed');
  };

  const confirmDiscardFromPending = (sample: PendingSample) => {
    if (!user || !role || !canConfirmDiscard(role) || !sample.sampleRejectionId) return;
    const rejection = db.sampleRejections.find((r) => r.id === sample.sampleRejectionId);
    if (rejection?.replacementSampleStatus === 'Completed') {
      toast.error('Completed samples cannot be discarded');
      return;
    }
    if (!confirm('Confirm sample discard?')) return;

    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 5);
    const pendingIdx = db.pendingSamples.findIndex((p) => p.id === sample.id);
    const rejectionIdx = db.sampleRejections.findIndex((r) => r.id === sample.sampleRejectionId);

    if (pendingIdx >= 0) {
      db.pendingSamples[pendingIdx] = {
        ...db.pendingSamples[pendingIdx],
        replacementSampleStatus: 'Discarded',
        currentStatus: 'Discarded',
        isActive: false,
        updatedAt: now.toISOString(),
      };
    }
    if (rejectionIdx >= 0) {
      db.sampleRejections[rejectionIdx] = {
        ...db.sampleRejections[rejectionIdx],
        replacementSampleStatus: 'Discarded',
        discardStatus: 'discarded',
        discardDate: date,
        discardTime: time,
        discardedByUserId: user.id,
        discardedByName: staff.fullName,
        discardedByStaffId: staff.staffId,
        updatedAt: now.toISOString(),
      };
    }
    appendAuditLog(db, user.id, 'update', 'pending_samples', sample.id, undefined, 'discarded');
    saveMockDatabase(db);
    refresh();
    toast.success('Sample discard confirmed');
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
            <Badge variant={sample.sourceType === 'rejection' ? 'warning' : sample.priority === 'stat' ? 'destructive' : 'secondary'}>
              {sample.sourceType === 'rejection' ? 'Rejection' : sample.priority}
            </Badge>
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
                <Button size="sm" onClick={() => markReplacementReceived(sample)}>
                  <PackageCheck className="h-4 w-4 me-2" />Mark Replacement Sample as Received
                </Button>
              )}
              {sample.replacementSampleStatus === 'Replacement Sample Received' && (
                <Button size="sm" onClick={() => markCompleted(sample)}>
                  <CheckCircle2 className="h-4 w-4 me-2" />Mark as Completed
                </Button>
              )}
              {sample.currentStatus === 'Discard Due' && role && canConfirmDiscard(role) && (
                <Button size="sm" variant="destructive" onClick={() => confirmDiscardFromPending(sample)}>
                  <Archive className="h-4 w-4 me-2" />Confirm Sample Discard
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tc('pendingSamples')}</h1>
        <p className="text-muted-foreground">{activeSamples.length} active samples</p>
      </div>

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
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {historySamples.length === 0 ? (
              <p className="text-muted-foreground">No history records yet.</p>
            ) : historySamples.map((sample) => renderSampleCard(sample, false))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
