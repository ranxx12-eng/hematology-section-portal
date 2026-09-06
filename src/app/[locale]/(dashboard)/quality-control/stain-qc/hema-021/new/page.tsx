'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { createStainQcSheet } from '@/lib/clinical/stain-qc';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import { monthName } from '@/lib/shared/month-names';
import { FORM_HEMA_021_CODE, FORM_HEMA_021_TITLE } from '@/lib/stain-qc/constants';
import { canRecordStainQc } from '@/lib/stain-qc/permissions';

export default function StainQcRapiNewPage() {
  const locale = useLocale();
  const router = useRouter();
  const { user, can } = useAuth();
  const accessDenied = !canRecordStainQc(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  const now = new Date();
  const [saving, setSaving] = useState(false);
  const [lotNumber, setLotNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [sheetMonth, setSheetMonth] = useState(String(now.getMonth() + 1));
  const [sheetYear, setSheetYear] = useState(String(now.getFullYear()));

  async function handleCreate() {
    if (!user) return;
    if (!lotNumber.trim() || !expiryDate) {
      toast.error('Lot number and expiry date are required');
      return;
    }
    setSaving(true);
    const staff = await resolveStaffContext(user);
    const result = await createStainQcSheet({
      formCode: FORM_HEMA_021_CODE,
      lotNumber,
      expiryDate,
      sheetMonth: Number(sheetMonth),
      sheetYear: Number(sheetYear),
      staff,
    });
    setSaving(false);
    if (result.error) toast.error(result.error);
    else if (result.data) {
      toast.success('Monthly sheet created');
      router.push(`/${locale}/quality-control/stain-qc/hema-021/${result.data.id}`);
    }
  }

  return (
    <PageContentSections pageKey="dashboard" fallbackTitle={`New ${FORM_HEMA_021_TITLE}`}>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/${locale}/quality-control/stain-qc/hema-021`}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">New Monthly Sheet</h1>
            <p className="text-muted-foreground">{FORM_HEMA_021_CODE} · {FORM_HEMA_021_TITLE}</p>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Sheet Identity</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 max-w-3xl">
            <div className="space-y-2">
              <Label htmlFor="lot-number">RAPI Stain Lot Number *</Label>
              <Input id="lot-number" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiry-date">Expiry Date *</Label>
              <Input id="expiry-date" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sheet-month">Month *</Label>
              <Input id="sheet-month" type="number" min={1} max={12} value={sheetMonth} onChange={(e) => setSheetMonth(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sheet-year">Year *</Label>
              <Input id="sheet-year" type="number" min={2000} max={2100} value={sheetYear} onChange={(e) => setSheetYear(e.target.value)} />
            </div>
            <div className="md:col-span-2 text-sm text-muted-foreground">
              One active sheet is allowed per {FORM_HEMA_021_CODE}, month, year, and lot combination.
            </div>
            <div className="md:col-span-2">
              <Button disabled={saving} onClick={() => void handleCreate()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : `Create ${monthName(Number(sheetMonth))} ${sheetYear} Sheet`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContentSections>
  );
}
