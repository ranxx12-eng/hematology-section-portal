'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { fetchStainQcSheets } from '@/lib/clinical/stain-qc';
import { monthName } from '@/lib/shared/month-names';
import {
  FORM_HEMA_021_CODE,
  FORM_HEMA_021_TITLE,
  STAIN_QC_STATUS_LABELS,
} from '@/lib/stain-qc/constants';
import { canRecordStainQc, canViewStainQc } from '@/lib/stain-qc/permissions';
import type { StainQcListItem } from '@/types/stain-qc';

export default function StainQcRapiPage() {
  const locale = useLocale();
  const router = useRouter();
  const { can } = useAuth();
  const accessDenied = !canViewStainQc(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  const [loading, setLoading] = useState(true);
  const [sheets, setSheets] = useState<StainQcListItem[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await fetchStainQcSheets(FORM_HEMA_021_CODE);
    setSheets(result.data ?? []);
    setLoading(false);
    if (result.error) toast.error(result.error);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const stats = useMemo(() => ({
    draft: sheets.filter((sheet) => sheet.status === 'draft').length,
    submitted: sheets.filter((sheet) => sheet.status === 'submitted').length,
    approved: sheets.filter((sheet) => sheet.status === 'approved').length,
  }), [sheets]);

  return (
    <PageContentSections pageKey="dashboard" fallbackTitle="RAPI Stain QC" fallbackSubtitle={FORM_HEMA_021_TITLE}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{FORM_HEMA_021_CODE}</h1>
            <p className="text-muted-foreground">{FORM_HEMA_021_TITLE}</p>
          </div>
          {canRecordStainQc(can) && (
            <Button onClick={() => router.push(`/${locale}/quality-control/stain-qc/hema-021/new`)}>
              <Plus className="h-4 w-4 mr-2" /> New Monthly Sheet
            </Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Draft</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{stats.draft}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Submitted</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{stats.submitted}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Approved</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{stats.approved}</CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Monthly Sheets</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : sheets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No Form-Hema-021 monthly sheets yet.</p>
            ) : (
              <div className="space-y-3">
                {sheets.map((sheet) => (
                  <Link
                    key={sheet.id}
                    href={`/${locale}/quality-control/stain-qc/hema-021/${sheet.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 hover:bg-muted/30"
                  >
                    <div>
                      <div className="font-medium">{sheet.sheetNumber}</div>
                      <div className="text-sm text-muted-foreground">
                        {monthName(sheet.sheetMonth)} {sheet.sheetYear} · Lot {sheet.lotNumber}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="secondary">{STAIN_QC_STATUS_LABELS[sheet.status]}</Badge>
                      <span>{sheet.completionPercent}% complete</span>
                      {sheet.pendingCorrectiveCount > 0 && (
                        <Badge variant="destructive">{sheet.pendingCorrectiveCount} corrective pending</Badge>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContentSections>
  );
}
