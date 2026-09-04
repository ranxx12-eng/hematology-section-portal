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
import { CvMonitoringStepper } from '@/components/cv-monitoring/cv-monitoring-stepper';
import { CvMonitoringSummaryPanel } from '@/components/cv-monitoring/cv-monitoring-summary-panel';
import { CvResultGrid, type CvResultFormValues } from '@/components/cv-monitoring/cv-result-grid';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { useRouteReplace } from '@/hooks/use-route-replace';
import {
  createCvMonitoringDraft,
  fetchCvMonitoringRecordById,
  refreshPreviousMonthAutoFill,
  saveCvMonitoringResults,
} from '@/lib/clinical/cv-monitoring';
import { fetchInstruments } from '@/lib/clinical/instruments';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import { derivePreviousMonth, monthName, MONTH_NAMES } from '@/lib/cv-monitoring/constants';
import { canCreateCvMonitoring, canViewCvMonitoring } from '@/lib/cv-monitoring/permissions';
import { formatInstrumentSelectorLabel } from '@/lib/ppm-calibration/instrument-display';
import type { Instrument } from '@/types';
import type { CvMonitoringRecord } from '@/types/cv-monitoring';

type WizardStep = 'setup' | 'comparison';

function recordToFormValues(record: CvMonitoringRecord): Record<string, CvResultFormValues> {
  const values: Record<string, CvResultFormValues> = {};
  for (const result of record.results) {
    values[result.id] = {
      previousMean: result.previousMean != null ? String(result.previousMean) : '',
      previousSd: result.previousSd != null ? String(result.previousSd) : '',
      previousSourceType: result.previousSourceType,
      previousManualReason: result.previousManualReason ?? '',
      currentMean: result.currentMean != null ? String(result.currentMean) : '',
      currentSd: result.currentSd != null ? String(result.currentSd) : '',
      comment: result.comment ?? '',
      observation: result.observation ?? '',
      investigation: result.investigation ?? '',
      possibleCause: result.possibleCause ?? '',
      correctiveAction: result.correctiveAction ?? '',
      followUpRequired: result.followUpRequired,
      followUpComment: result.followUpComment ?? '',
      qualityDisposition: result.qualityDisposition,
    };
  }
  return values;
}

export default function NewCvMonitoringPage() {
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const accessDenied = !canViewCvMonitoring(can) || !canCreateCvMonitoring(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  const now = new Date();
  const [step, setStep] = useState<WizardStep>('setup');
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState<CvMonitoringRecord | null>(null);
  const [values, setValues] = useState<Record<string, CvResultFormValues>>({});
  const [levelLots, setLevelLots] = useState<Record<'N' | 'P', string>>({ N: '', P: '' });
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

  const continueToComparison = async () => {
    if (!user || !selectedInstrument) {
      toast.error('Select an instrument');
      return;
    }
    setLoading(true);
    const staff = await resolveStaffContext(user);
    const result = await createCvMonitoringDraft(staff, {
      instrumentId: selectedInstrument.id,
      instrumentName: selectedInstrument.name,
      currentMonth: form.currentMonth,
      currentYear: form.currentYear,
      notes: form.notes,
      levelLots: { N: form.lotN, P: form.lotP },
    });
    if (result.error || !result.data) {
      setLoading(false);
      toast.error(result.error ?? 'Failed to create draft');
      return;
    }

    const loaded = await fetchCvMonitoringRecordById(result.data.id);
    setLoading(false);
    if (loaded.error || !loaded.data) {
      toast.error(loaded.error ?? 'Failed to load comparison');
      return;
    }

    setRecord(loaded.data);
    setValues(recordToFormValues(loaded.data));
    setLevelLots({
      N: loaded.data.levels.find((l) => l.qcLevel === 'N')?.lotNumber ?? form.lotN,
      P: loaded.data.levels.find((l) => l.qcLevel === 'P')?.lotNumber ?? form.lotP,
    });
    setStep('comparison');
    toast.success('Enter current-month Mean and SD for each test');
  };

  const saveDraft = async () => {
    if (!user || !record) return;
    setLoading(true);
    const staff = await resolveStaffContext(user);
    const inputs = Object.entries(values).map(([id, row]) => ({
      id,
      previousMean: row.previousMean === '' ? null : Number(row.previousMean),
      previousSd: row.previousSd === '' ? null : Number(row.previousSd),
      previousSourceType: row.previousSourceType,
      previousManualReason: row.previousManualReason,
      currentMean: row.currentMean === '' ? null : Number(row.currentMean),
      currentSd: row.currentSd === '' ? null : Number(row.currentSd),
      comment: row.comment,
      observation: row.observation,
      investigation: row.investigation,
      possibleCause: row.possibleCause,
      correctiveAction: row.correctiveAction,
      followUpRequired: row.followUpRequired,
      followUpComment: row.followUpComment,
      qualityDisposition: row.qualityDisposition,
    }));
    const saved = await saveCvMonitoringResults(record.id, staff, inputs, levelLots);
    setLoading(false);
    if (saved.error || !saved.data) {
      toast.error(saved.error ?? 'Failed to save draft');
      return;
    }
    setRecord(saved.data);
    setValues(recordToFormValues(saved.data));
    toast.success('Draft saved');
  };

  const autoFillPrevious = async () => {
    if (!user || !record) return;
    setLoading(true);
    const staff = await resolveStaffContext(user);
    const refreshed = await refreshPreviousMonthAutoFill(record.id, staff);
    setLoading(false);
    if (refreshed.error || !refreshed.data) {
      toast.error(refreshed.error ?? 'No approved previous-month record found');
      return;
    }
    setRecord(refreshed.data);
    setValues(recordToFormValues(refreshed.data));
    toast.success(`Previous month populated from ${monthName(previous.month)} ${previous.year}`);
  };

  const continueToReview = async () => {
    if (!record) return;
    await saveDraft();
    router.push(`/${locale}/quality/cv-monitoring/${record.id}`);
  };

  return (
    <PageContentSections pageKey="dashboard" fallbackTitle="New Monthly CV Comparison">
      <div className="space-y-6 max-w-6xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/${locale}/quality/cv-monitoring`}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">New Monthly CV Comparison</h1>
            <p className="text-muted-foreground">Form-Hema-015 · HMG/SAH/QID/9167</p>
          </div>
        </div>

        <CvMonitoringStepper current={step === 'setup' ? 'setup' : 'comparison'} />

        {step === 'setup' && (
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
              <div className="sm:col-span-2 rounded-xl border bg-muted/30 p-3 text-sm">
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
              <div className="sm:col-span-2 flex flex-wrap gap-2">
                <Button disabled={loading} onClick={() => void continueToComparison()}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue to Comparison'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'comparison' && record && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Step 2 — Monthly CV Comparison</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Enter current-month Mean and SD. CV % is calculated automatically and compared against the official limit and previous month.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <CvMonitoringSummaryPanel record={record} />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={loading} onClick={() => void autoFillPrevious()}>
                    Refresh Previous Month
                  </Button>
                  <Button variant="outline" disabled={loading} onClick={() => void saveDraft()}>
                    Save Draft
                  </Button>
                  <Button disabled={loading} onClick={() => void continueToReview()}>
                    Continue to Review
                  </Button>
                </div>
              </CardContent>
            </Card>

            <CvResultGrid
              record={record}
              editable
              values={values}
              onChange={(id, patch) => setValues((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))}
            />
          </div>
        )}
      </div>
    </PageContentSections>
  );
}
