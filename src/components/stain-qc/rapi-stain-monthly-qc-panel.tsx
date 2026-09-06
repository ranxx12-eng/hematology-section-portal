'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Loader2, TestTubes } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchStainQcSheets } from '@/lib/clinical/stain-qc';
import { FORM_HEMA_021_CODE, FORM_HEMA_021_TITLE } from '@/lib/stain-qc/constants';
import { monthName } from '@/lib/shared/month-names';
import type { StainQcListItem } from '@/types/stain-qc';

interface RapiStainMonthlyQcPanelProps {
  locale: string;
  canView: boolean;
}

export function RapiStainMonthlyQcPanel({ locale, canView }: RapiStainMonthlyQcPanelProps) {
  const [loading, setLoading] = useState(true);
  const [sheets, setSheets] = useState<StainQcListItem[]>([]);

  const reload = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await fetchStainQcSheets(FORM_HEMA_021_CODE);
    setSheets(result.data ?? []);
    setLoading(false);
  }, [canView]);

  useEffect(() => { void reload(); }, [reload]);

  if (!canView) return null;

  const recent = sheets.slice(0, 3);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TestTubes className="h-4 w-4" />
          RAPI Stain Monthly QC · {FORM_HEMA_021_CODE}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{FORM_HEMA_021_TITLE}</p>
        <p className="text-sm">
          Daily entries are recorded through <strong>Add QC Record → RAPI Stain QC</strong>.
          Use the monthly form for workflow, audit history, and PDF export.
        </p>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No monthly sheets yet. Add the first daily entry to create one.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {recent.map((sheet) => (
              <li key={sheet.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-md px-3 py-2">
                <span>
                  {monthName(sheet.sheetMonth)} {sheet.sheetYear} · Lot {sheet.lotNumber}
                </span>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/${locale}/quality-control/stain-qc/hema-021/${sheet.id}`}>
                    View Monthly Form-Hema-021
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button variant="secondary" asChild>
          <Link href={`/${locale}/quality-control/stain-qc/hema-021`}>Open all monthly sheets</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
