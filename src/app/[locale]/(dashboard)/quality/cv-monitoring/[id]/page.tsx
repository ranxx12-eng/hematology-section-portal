'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';
import { CvMonthlyForm } from '@/components/cv-monitoring/cv-monthly-form';
import { CvMonitoringStepper } from '@/components/cv-monitoring/cv-monitoring-stepper';
import { Button } from '@/components/ui/button';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { fetchCvMonitoringRecordById } from '@/lib/clinical/cv-monitoring';
import { canViewCvMonitoring } from '@/lib/cv-monitoring/permissions';
import type { CvMonitoringRecord } from '@/types/cv-monitoring';

export default function CvMonitoringDetailPage() {
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const { can, user } = useAuth();
  const accessDenied = !canViewCvMonitoring(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<CvMonitoringRecord | null>(null);

  const reload = useCallback(async () => {
    if (!params.id) return;
    setLoading(true);
    const result = await fetchCvMonitoringRecordById(params.id);
    setRecord(result.data);
    setLoading(false);
    if (result.error) toast.error(result.error);
  }, [params.id]);

  useEffect(() => { void reload(); }, [reload]);

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!record || !user) return <p className="text-muted-foreground p-6">Record not found.</p>;

  return (
    <PageContentSections pageKey="dashboard" fallbackTitle="CV Monitoring Record">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/${locale}/quality/cv-monitoring`}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{record.monitoringNumber}</h1>
            <p className="text-muted-foreground">{record.instrumentNameSnapshot}</p>
          </div>
        </div>
        <CvMonitoringStepper current="review" />
        <CvMonthlyForm record={record} user={user} can={can} onRefresh={setRecord} />
      </div>
    </PageContentSections>
  );
}
