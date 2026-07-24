'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, Clock, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { appendAuditLog, maskPatientId } from '@/lib/page-utils';
import { formatDateTime, generateId } from '@/lib/utils';
import type { PendingSample } from '@/types';
import { cn } from '@/lib/utils';

export default function PendingSamplesPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const canManage = can('tat.manage');
  const [db, setDb] = useState(() => getMockDatabase());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ patientId: '', test: 'CBC', priority: 'routine' as PendingSample['priority'] });
  const refresh = useCallback(() => setDb(getMockDatabase()), []);

  if (!can('tat.view')) {
    router.replace(`/${locale}/unauthorized`);
    return null;
  }

  const getAlertLevel = (sample: PendingSample) => {
    if (sample.priority === 'stat' && sample.elapsedMinutes > 45) return 'critical';
    if (sample.priority === 'stat' && sample.elapsedMinutes > 30) return 'warning';
    if (sample.priority === 'routine' && sample.elapsedMinutes > 180) return 'critical';
    if (sample.priority === 'routine' && sample.elapsedMinutes > 120) return 'warning';
    return 'normal';
  };

  const addSample = () => {
    if (!form.patientId || !canManage) return;
    const now = new Date().toISOString();
    const sample: PendingSample = {
      id: generateId(),
      patientId: form.patientId,
      test: form.test,
      priority: form.priority,
      receivedTime: now,
      elapsedMinutes: 0,
      currentStatus: 'Processing',
      createdAt: now,
    };
    db.pendingSamples.unshift(sample);
    if (user) appendAuditLog(db, user.id, 'create', 'pending_samples', sample.id);
    saveMockDatabase(db);
    refresh();
    setDialogOpen(false);
    toast.success('Pending sample added');
  };

  const removeSample = (id: string) => {
    if (!canManage) return;
    db.pendingSamples = db.pendingSamples.filter((s) => s.id !== id);
    if (user) appendAuditLog(db, user.id, 'delete', 'pending_samples', id);
    saveMockDatabase(db);
    refresh();
    toast.success('Sample removed');
  };

  const getInstrumentName = (id?: string) => id ? db.instruments.find((i) => i.id === id)?.name ?? '—' : '—';
  const getEmployeeName = (id?: string) => id ? db.employees.find((e) => e.id === id)?.fullName ?? '—' : 'Unassigned';

  const alertCounts = useMemo(() => ({
    critical: db.pendingSamples.filter((s) => getAlertLevel(s) === 'critical').length,
    warning: db.pendingSamples.filter((s) => getAlertLevel(s) === 'warning').length,
  }), [db.pendingSamples]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tc('pendingSamples')}</h1>
          <p className="text-muted-foreground">{db.pendingSamples.length} samples pending</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button>{tc('add')} Sample</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{tc('add')} Pending Sample</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Patient ID</Label><Input value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} /></div>
                <div><Label>Test</Label><Input value={form.test} onChange={(e) => setForm({ ...form, test: e.target.value })} /></div>
                <div><Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as PendingSample['priority'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="stat">STAT</SelectItem><SelectItem value="routine">Routine</SelectItem></SelectContent>
                  </Select>
                </div>
                <Button onClick={addSample} className="w-full">{tc('save')}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {(alertCounts.critical > 0 || alertCounts.warning > 0) && (
        <div className="flex gap-3">
          {alertCounts.critical > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 px-4 py-2 text-sm">
              <AlertTriangle className="h-4 w-4" />{alertCounts.critical} critical alert(s)
            </div>
          )}
          {alertCounts.warning > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-4 py-2 text-sm">
              <Clock className="h-4 w-4" />{alertCounts.warning} warning(s)
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {db.pendingSamples.map((sample) => {
          const level = getAlertLevel(sample);
          return (
            <Card key={sample.id} className={cn(
              'relative overflow-hidden',
              level === 'critical' && 'border-red-500 shadow-red-100 shadow-md',
              level === 'warning' && 'border-amber-500',
            )}>
              {level === 'critical' && <div className="absolute top-0 inset-x-0 h-1 bg-red-500 animate-pulse" />}
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{sample.test}</CardTitle>
                  <Badge variant={sample.priority === 'stat' ? 'destructive' : 'secondary'}>
                    {sample.priority === 'stat' ? <Zap className="h-3 w-3 me-1" /> : null}{sample.priority}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-mono">{maskPatientId(sample.patientId)}</p>
                <p className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" />{sample.elapsedMinutes} min elapsed</p>
                <p>Status: {sample.currentStatus}</p>
                <p>Instrument: {getInstrumentName(sample.instrumentId)}</p>
                <p>Staff: {getEmployeeName(sample.assignedStaffId)}</p>
                <p className="text-xs text-muted-foreground">Received: {formatDateTime(sample.receivedTime, locale)}</p>
                {canManage && (
                  <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => removeSample(sample.id)}>Mark Complete</Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
