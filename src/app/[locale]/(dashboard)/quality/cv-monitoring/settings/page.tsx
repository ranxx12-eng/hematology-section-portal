'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { fetchCvMonitoringDefinitions, updateCvMonitoringDefinition } from '@/lib/clinical/cv-monitoring';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import { analytePrintCode } from '@/lib/cv-monitoring/constants';
import { canManageCvDefinitions, canViewCvMonitoring } from '@/lib/cv-monitoring/permissions';
import type { CvMonitoringDefinition } from '@/types/cv-monitoring';

export default function CvMonitoringSettingsPage() {
  const locale = useLocale();
  const { can, user } = useAuth();
  const accessDenied = !canViewCvMonitoring(can) || !canManageCvDefinitions(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  const [loading, setLoading] = useState(true);
  const [definitions, setDefinitions] = useState<CvMonitoringDefinition[]>([]);
  const [reason, setReason] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await fetchCvMonitoringDefinitions();
    setDefinitions(result.data);
    setLoading(false);
    if (result.error) toast.error(result.error);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const saveLimit = async (def: CvMonitoringDefinition, newLimit: number) => {
    if (!user || !reason.trim()) {
      toast.error('Change reason is required');
      return;
    }
    setSavingId(def.id);
    const staff = await resolveStaffContext(user);
    const result = await updateCvMonitoringDefinition(def.id, staff, { cvLimitPercent: newLimit }, reason);
    setSavingId(null);
    if (result.error) toast.error(result.error);
    else { toast.success('Definition updated'); void reload(); }
  };

  return (
    <PageContentSections pageKey="dashboard" fallbackTitle="CV Monitoring Settings">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/${locale}/quality/cv-monitoring`}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">CV Monitoring Settings</h1>
            <p className="text-muted-foreground">Manage instrument analyte CV limits</p>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Change Reason (required for updates)</CardTitle></CardHeader>
          <CardContent>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Document why limits or settings are changing" />
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            {definitions.map((def) => (
              <Card key={def.id}>
                <CardContent className="pt-6 grid gap-3 sm:grid-cols-4 items-end">
                  <div>
                    <div className="text-sm text-muted-foreground">Instrument</div>
                    <div className="font-medium">{def.instrumentName ?? def.instrumentId}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Level / Analyte</div>
                    <div className="font-medium">Level {def.qcLevel} · {analytePrintCode(def.analyteCode)} ({def.analyteName})</div>
                  </div>
                  <div className="space-y-1">
                    <Label>CV Limit %</Label>
                    <Input type="number" step="any" defaultValue={def.cvLimitPercent} id={`limit-${def.id}`} />
                  </div>
                  <Button
                    disabled={savingId === def.id}
                    onClick={() => {
                      const input = document.getElementById(`limit-${def.id}`) as HTMLInputElement;
                      void saveLimit(def, Number(input.value));
                    }}
                  >
                    {savingId === def.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageContentSections>
  );
}
