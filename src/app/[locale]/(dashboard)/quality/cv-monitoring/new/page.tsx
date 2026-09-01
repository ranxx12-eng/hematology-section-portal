'use client';

import { useEffect, useState } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { createCvMonitoringDraft } from '@/lib/clinical/cv-monitoring';
import { fetchInstruments } from '@/lib/clinical/instruments';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import { derivePreviousMonth, monthName, MONTH_NAMES } from '@/lib/cv-monitoring/constants';
import { canCreateCvMonitoring, canViewCvMonitoring } from '@/lib/cv-monitoring/permissions';
import { formatInstrumentSelectorLabel } from '@/lib/ppm-calibration/instrument-display';
import type { Instrument } from '@/types';

export default function NewCvMonitoringPage() {
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const accessDenied = !canViewCvMonitoring(can) || !canCreateCvMonitoring(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  const now = new Date();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    instrumentId: '',
    currentMonth: now.getMonth() + 1,
    currentYear: now.getFullYear(),
    lotN: '',
    lotP: '',
    notes: '',
  });

  useEffect(() => {
    void fetchInstruments().then((res) => {
      if (res.data) setInstruments(res.data.filter((i) => i.active !== false));
    });
  }, []);

  const previous = derivePreviousMonth(form.currentMonth, form.currentYear);
  const selectedInstrument = instruments.find((i) => i.id === form.instrumentId);

  const create = async () => {
    if (!user || !selectedInstrument) {
      toast.error('Select an instrument');
      return;
    }
    setCreating(true);
    const staff = await resolveStaffContext(user);
    const result = await createCvMonitoringDraft(staff, {
      instrumentId: selectedInstrument.id,
      instrumentName: selectedInstrument.name,
      currentMonth: form.currentMonth,
      currentYear: form.currentYear,
      notes: form.notes,
      levelLots: { N: form.lotN, P: form.lotP },
    });
    setCreating(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to create record');
      return;
    }
    router.push(`/${locale}/quality/cv-monitoring/${result.data.id}`);
  };

  return (
    <PageContentSections pageKey="dashboard" fallbackTitle="New Monthly CV Comparison">
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/${locale}/quality/cv-monitoring`}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">New Monthly CV Comparison</h1>
            <p className="text-muted-foreground">Form-Hema-015 setup wizard</p>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Step 1 — Setup</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Instrument</Label>
              <Select value={form.instrumentId} onValueChange={(v) => setForm((p) => ({ ...p, instrumentId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select instrument" /></SelectTrigger>
                <SelectContent>
                  {instruments.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>{formatInstrumentSelectorLabel(inst)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Current Month</Label>
              <Select value={String(form.currentMonth)} onValueChange={(v) => setForm((p) => ({ ...p, currentMonth: Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, index) => (
                    <SelectItem key={name} value={String(index + 1)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Current Year</Label>
              <Input type="number" value={form.currentYear} onChange={(e) => setForm((p) => ({ ...p, currentYear: Number(e.target.value) }))} />
            </div>
            <div className="sm:col-span-2 rounded-md bg-muted/40 p-3 text-sm">
              Previous Month (auto): <strong>{monthName(previous.month)} {previous.year}</strong>
            </div>
            <div className="space-y-2">
              <Label>Level N — Lot Number</Label>
              <Input value={form.lotN} onChange={(e) => setForm((p) => ({ ...p, lotN: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Level P — Lot Number</Label>
              <Input value={form.lotP} onChange={(e) => setForm((p) => ({ ...p, lotP: e.target.value }))} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
            <div className="sm:col-span-2">
              <Button disabled={creating} onClick={() => void create()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Record'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContentSections>
  );
}
