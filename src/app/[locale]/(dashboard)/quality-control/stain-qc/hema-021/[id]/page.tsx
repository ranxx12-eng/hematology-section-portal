'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';
import { StainQcMonthlyForm } from '@/components/stain-qc/stain-qc-monthly-form';
import { Button } from '@/components/ui/button';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { fetchStainQcSheetDetail } from '@/lib/clinical/stain-qc';
import { FORM_HEMA_021_CODE, FORM_HEMA_021_TITLE } from '@/lib/stain-qc/constants';
import { canViewStainQc } from '@/lib/stain-qc/permissions';
import type { StainQcMonthlySheetDetail } from '@/types/stain-qc';
import { monthName } from '@/lib/cv-monitoring/constants';

export default function StainQcRapiDetailPage() {
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const { can, user } = useAuth();
  const accessDenied = !canViewStainQc(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<StainQcMonthlySheetDetail | null>(null);

  const reload = useCallback(async () => {
    if (!params.id) return;
    setLoading(true);
    const result = await fetchStainQcSheetDetail(params.id);
    setSheet(result.data);
    setLoading(false);
    if (result.error) toast.error(result.error);
  }, [params.id]);

  useEffect(() => { void reload(); }, [reload]);

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!sheet || !user) return <p className="text-muted-foreground p-6">Sheet not found.</p>;
  if (sheet.formCode !== FORM_HEMA_021_CODE) return <p className="text-muted-foreground p-6">This record is not Form-Hema-021.</p>;

  return (
    <PageContentSections pageKey="dashboard" fallbackTitle={FORM_HEMA_021_TITLE}>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/${locale}/quality-control/stain-qc/hema-021`}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{sheet.sheetNumber}</h1>
            <p className="text-muted-foreground">{FORM_HEMA_021_CODE} · {monthName(sheet.sheetMonth)} {sheet.sheetYear}</p>
          </div>
        </div>
        <StainQcMonthlyForm sheet={sheet} user={user} can={can} onRefresh={setSheet} />
      </div>
    </PageContentSections>
  );
}
