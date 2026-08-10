'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, Clock, CheckCircle2, PackageCheck, Archive, History, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/components/providers/auth-provider';
import { maskPatientId, statusBadgeVariant } from '@/lib/page-utils';
import { formatDateTime } from '@/lib/utils';
import { fetchPendingSamples } from '@/lib/clinical/pending-samples';
import { CLINICAL_WRITE_DISABLED_MESSAGE } from '@/lib/clinical/constants';
import { canConfirmDiscard } from '@/lib/sample-rejections/permissions';
import type { PendingSample } from '@/types';
import { cn } from '@/lib/utils';

export default function PendingSamplesPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can, role } = useAuth();
  const canManage = can('tat.manage') || can('sample_rejections.manage');
  const [samples, setSamples] = useState<PendingSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('active');

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

  const notifyWriteDisabled = () => toast.info(CLINICAL_WRITE_DISABLED_MESSAGE);

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
                <Button size="sm" onClick={notifyWriteDisabled}>
                  <PackageCheck className="h-4 w-4 me-2" />Mark Replacement Sample as Received
                </Button>
              )}
              {sample.replacementSampleStatus === 'Replacement Sample Received' && (
                <Button size="sm" onClick={notifyWriteDisabled}>
                  <CheckCircle2 className="h-4 w-4 me-2" />Mark as Completed
                </Button>
              )}
              {sample.currentStatus === 'Discard Due' && role && canConfirmDiscard(role) && (
                <Button size="sm" variant="destructive" onClick={notifyWriteDisabled}>
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
        <p className="text-muted-foreground">{loading ? 'Loading…' : `${activeSamples.length} active samples`}</p>
      </div>

      {canManage && (
        <p className="text-sm text-muted-foreground rounded-md border border-border bg-muted/40 px-4 py-3">
          {CLINICAL_WRITE_DISABLED_MESSAGE}
        </p>
      )}

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
        <EmptyState title="No pending samples" description="Active and historical pending samples will appear here once recorded in Supabase." />
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
