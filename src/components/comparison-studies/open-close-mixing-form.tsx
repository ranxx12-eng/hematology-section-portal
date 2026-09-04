'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ComparisonOverallResultBadge } from '@/components/comparison-studies/comparison-status-badges';
import { ComparisonStudyWorkflow } from '@/components/comparison-studies/comparison-study-workflow';
import {
  MixingResultGrid,
  mixingFormToSavePayload,
  type MixingResultFormValues,
  type MixingSampleFormValues,
} from '@/components/comparison-studies/mixing-result-grid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { summarizeMixingStudy } from '@/lib/clinical/comparison-mixing';
import {
  approveComparisonStudy,
  logComparisonExport,
  reviewComparisonStudy,
  saveOpenCloseMixingStudy,
  submitComparisonStudy,
} from '@/lib/clinical/comparison-studies';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import {
  COMPARISON_STATUS_LABELS,
} from '@/lib/comparison-studies/constants';
import {
  FORM_HEMA_018_CODE,
  FORM_HEMA_018_QID,
  FORM_HEMA_018_TITLE,
  MIXING_MODE_LABELS,
  MIXING_MODE_STATUS_LABELS,
} from '@/lib/comparison-studies/mixing-constants';
import {
  canExportComparisonStudies,
  isComparisonStudyEditable,
} from '@/lib/comparison-studies/permissions';
import { createComparisonForm018Pdf } from '@/lib/print/comparison-form-018-pdf';
import { CONTROLLED_FORM_PRINT_LABEL } from '@/lib/print/controlled-form';
import type { Permission } from '@/lib/permissions/roles';
import type { Profile } from '@/types';
import type { ComparisonStudy, MixingMode } from '@/types/comparison-study';

interface OpenCloseMixingFormProps {
  study: ComparisonStudy;
  user: Profile;
  can: (permission: Permission) => boolean;
  onRefresh: (study: ComparisonStudy) => void;
}

function initSampleValues(study: ComparisonStudy): Record<string, MixingSampleFormValues> {
  const values: Record<string, MixingSampleFormValues> = {};
  for (const sample of study.mixingSamples ?? []) {
    values[sample.id] = {};
  }
  return values;
}

function initResultValues(study: ComparisonStudy): Record<string, MixingResultFormValues> {
  const values: Record<string, MixingResultFormValues> = {};
  for (const result of study.mixingResults ?? []) {
    values[result.id] = {
      firstResult: result.firstResult != null ? String(result.firstResult) : '',
      finalResult: result.finalResult != null ? String(result.finalResult) : '',
    };
  }
  return values;
}

export function OpenCloseMixingForm({ study, user, can, onRefresh }: OpenCloseMixingFormProps) {
  const editable = isComparisonStudyEditable(study);
  const [saving, setSaving] = useState(false);
  const [activeMode, setActiveMode] = useState<MixingMode>('close');
  const [studyDate, setStudyDate] = useState(study.studyDate ?? new Date().toISOString().slice(0, 10));
  const [conclusion, setConclusion] = useState(study.generalComments ?? '');
  const [conclusionTouched, setConclusionTouched] = useState(Boolean(study.generalComments?.trim()));
  const [sampleValues, setSampleValues] = useState<Record<string, MixingSampleFormValues>>(() => initSampleValues(study));
  const [resultValues, setResultValues] = useState<Record<string, MixingResultFormValues>>(() => initResultValues(study));

  const summary = useMemo(() => summarizeMixingStudy(study), [study]);

  useEffect(() => {
    setStudyDate(study.studyDate ?? new Date().toISOString().slice(0, 10));
    setSampleValues(initSampleValues(study));
    setResultValues(initResultValues(study));
    if (!conclusionTouched) {
      setConclusion(study.generalComments ?? summary.suggestedConclusion ?? '');
    }
  }, [study, summary.suggestedConclusion, conclusionTouched]);

  const persist = async () => {
    setSaving(true);
    const staff = await resolveStaffContext(user);
    const payload = mixingFormToSavePayload(
      study.mixingSamples ?? [],
      sampleValues,
      resultValues,
      study.mixingResults ?? [],
    );
    const result = await saveOpenCloseMixingStudy(study.id, staff, {
      ...payload,
      studyDate,
      referenceLabel: study.referenceLabel,
      referenceInstrumentId: study.referenceInstrumentId,
      conclusion,
    });
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to save');
      return false;
    }
    onRefresh(result.data);
    if (!conclusionTouched && result.data.generalComments) {
      setConclusion(result.data.generalComments);
    }
    toast.success('Study saved');
    return true;
  };

  const exportPdf = async () => {
    const blob = await createComparisonForm018Pdf(study);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${study.studyNumber}-Form-Hema-018.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
    const staff = await resolveStaffContext(user);
    await logComparisonExport(study.id, staff, 'PDF');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg">{FORM_HEMA_018_TITLE}</CardTitle>
            <Badge variant="secondary">{COMPARISON_STATUS_LABELS[study.status] ?? study.status}</Badge>
            <ComparisonOverallResultBadge result={study.overallResult} />
          </div>
          <p className="text-sm text-muted-foreground">
            {FORM_HEMA_018_CODE} · {FORM_HEMA_018_QID} · {study.studyNumber}
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
          <div><span className="text-muted-foreground">Instrument:</span> {study.referenceLabel ?? 'Alinity HQ 1147'}</div>
          <div className="space-y-2">
            <Label>Study Date</Label>
            <Input type="date" disabled={!editable} value={studyDate} onChange={(e) => setStudyDate(e.target.value)} />
          </div>
          {canExportComparisonStudies(can) && (
            <div className="sm:col-span-2">
              <Button variant="outline" size="sm" onClick={() => void exportPdf()}>{CONTROLLED_FORM_PRINT_LABEL}</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Summary</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <span className="text-muted-foreground">Close Mode:</span>{' '}
            {MIXING_MODE_STATUS_LABELS[summary.closeModeStatus]}
          </div>
          <div>
            <span className="text-muted-foreground">Open Mode:</span>{' '}
            {MIXING_MODE_STATUS_LABELS[summary.openModeStatus]}
          </div>
          <div><span className="text-muted-foreground">Acceptable:</span> {summary.acceptable}</div>
          <div><span className="text-muted-foreground">Not Acceptable:</span> {summary.notAcceptable}</div>
          <div><span className="text-muted-foreground">Timing Review:</span> {summary.manualReview}</div>
          <div><span className="text-muted-foreground">Incomplete:</span> {summary.incomplete}</div>
        </CardContent>
      </Card>

      <Tabs value={activeMode} onValueChange={(v) => setActiveMode(v as MixingMode)}>
        <TabsList>
          <TabsTrigger value="close">{MIXING_MODE_LABELS.close}</TabsTrigger>
          <TabsTrigger value="open">{MIXING_MODE_LABELS.open}</TabsTrigger>
        </TabsList>
        {(['close', 'open'] as MixingMode[]).map((mode) => (
          <TabsContent key={mode} value={mode} className="mt-4">
            <MixingResultGrid
              mode={mode}
              samples={study.mixingSamples ?? []}
              results={study.mixingResults ?? []}
              editable={editable}
              sampleValues={sampleValues}
              resultValues={resultValues}
              onSampleChange={(id, patch) => setSampleValues((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))}
              onResultChange={(id, patch) => setResultValues((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))}
            />
          </TabsContent>
        ))}
      </Tabs>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Conclusion</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            disabled={!editable}
            rows={3}
            value={conclusion}
            onChange={(e) => {
              setConclusionTouched(true);
              setConclusion(e.target.value);
            }}
            placeholder={summary.suggestedConclusion}
          />
          {!conclusionTouched && (
            <p className="text-xs text-muted-foreground mt-2">
              Suggested: {summary.suggestedConclusion}
            </p>
          )}
        </CardContent>
      </Card>

      {editable && (
        <div className="sticky bottom-4 z-10 flex flex-wrap gap-2 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
          <Button disabled={saving} onClick={() => void persist()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Draft'}
          </Button>
        </div>
      )}

      <ComparisonStudyWorkflow
        study={study}
        can={can}
        saving={saving}
        onSubmit={async () => {
          const saved = await persist();
          if (!saved) return;
          setSaving(true);
          const staff = await resolveStaffContext(user);
          const result = await submitComparisonStudy(study.id, staff);
          setSaving(false);
          if (result.error || !result.data) {
            toast.error(result.error ?? 'Submit failed');
            return;
          }
          onRefresh(result.data);
          toast.success('Study submitted');
        }}
        onReview={async (action, comment) => {
          setSaving(true);
          const staff = await resolveStaffContext(user);
          const result = await reviewComparisonStudy(study.id, staff, { action, comment });
          setSaving(false);
          if (result.error || !result.data) {
            toast.error(result.error ?? 'Review failed');
            return;
          }
          onRefresh(result.data);
          toast.success('Review recorded');
        }}
        onApprove={async (action, comment) => {
          setSaving(true);
          const staff = await resolveStaffContext(user);
          const result = await approveComparisonStudy(study.id, staff, { action, comment });
          setSaving(false);
          if (result.error || !result.data) {
            toast.error(result.error ?? 'Approval failed');
            return;
          }
          onRefresh(result.data);
          toast.success(action === 'approve' ? 'Study approved' : 'Action recorded');
        }}
        onManualReview={async () => {
          toast.error('Manual review is not used for mixing studies.');
        }}
      />
    </div>
  );
}
