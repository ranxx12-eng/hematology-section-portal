'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ComparisonResultGrid } from '@/components/comparison-studies/comparison-result-grid';
import { ComparisonOverallResultBadge } from '@/components/comparison-studies/comparison-status-badges';
import { ComparisonStudySummaryPanel } from '@/components/comparison-studies/comparison-study-summary-panel';
import { ComparisonStudyWorkflow } from '@/components/comparison-studies/comparison-study-workflow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  addComparisonSample,
  approveComparisonStudy,
  completeManualReview,
  fetchComparisonAuditEvents,
  logComparisonExport,
  removeComparisonSample,
  reviewComparisonStudy,
  saveComparisonResults,
  saveStandardComparisonSetup,
  submitComparisonStudy,
} from '@/lib/clinical/comparison-studies';
import { fetchInstruments } from '@/lib/clinical/instruments';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import { buildStudySummary } from '@/lib/comparison-studies/calculation';
import {
  COMPARISON_STATUS_LABELS,
  COMPARISON_TYPES,
  FORM_HEMA_013_CODE,
  comparisonTypeRequiresInstruments,
} from '@/lib/comparison-studies/constants';
import { downloadComparisonExcel } from '@/lib/comparison-studies/excel-export';
import {
  canExportComparisonStudies,
  isComparisonStudyEditable,
} from '@/lib/comparison-studies/permissions';
import { createComparisonForm013Pdf } from '@/lib/print/comparison-form-013-pdf';
import {
  CONTROLLED_FORM_EXPORT_EXCEL_LABEL,
  CONTROLLED_FORM_PRINT_LABEL,
} from '@/lib/print/controlled-form';
import { formatInstrumentSelectorLabel } from '@/lib/ppm-calibration/instrument-display';
import type { Permission } from '@/lib/permissions/roles';
import type { Instrument, Profile } from '@/types';
import type { ComparisonAuditEvent, ComparisonManualReviewDecision, ComparisonSectionCode, ComparisonStudy } from '@/types/comparison-study';

const WIZARD_STEPS = ['Setup', 'Sections', 'Samples', 'Results', 'Summary', 'Submit'] as const;
const SECTION_OPTIONS: ComparisonSectionCode[] = ['CBC', 'COAGULATION', 'ESR'];

interface StandardComparisonFormProps {
  study: ComparisonStudy;
  user: Profile;
  can: (permission: Permission) => boolean;
  onRefresh: (study: ComparisonStudy) => void;
}

function resultsToFormValues(study: ComparisonStudy) {
  const values: Record<string, {
    previous?: string;
    new?: string;
    issueObservation?: string;
    correctiveAction?: string;
  }> = {};
  for (const result of study.results) {
    values[result.id] = {
      previous: result.previousResult != null ? String(result.previousResult) : '',
      new: result.newResult != null ? String(result.newResult) : '',
      issueObservation: result.issueObservation ?? '',
      correctiveAction: result.correctiveAction ?? '',
    };
  }
  return values;
}

export function StandardComparisonForm({ study, user, can, onRefresh }: StandardComparisonFormProps) {
  const editable = isComparisonStudyEditable(study);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [activeSection, setActiveSection] = useState<ComparisonSectionCode>(study.sections[0]?.section ?? 'CBC');
  const [newSampleId, setNewSampleId] = useState('');

  const [setup, setSetup] = useState({
    studyTitle: study.studyTitle,
    comparisonType: study.comparisonType ?? COMPARISON_TYPES[0],
    studyDate: study.studyDate ?? new Date().toISOString().slice(0, 10),
    purpose: study.purpose ?? '',
    referenceLabel: study.referenceLabel ?? '',
    comparisonLabel: study.comparisonLabel ?? '',
    referenceInstrumentId: study.referenceInstrumentId ?? '',
    comparisonInstrumentId: study.comparisonInstrumentId ?? '',
    generalComments: study.generalComments ?? '',
    sections: study.sections.map((s) => s.section),
  });

  const [resultValues, setResultValues] = useState(() => resultsToFormValues(study));

  useEffect(() => {
    setResultValues(resultsToFormValues(study));
  }, [study]);

  useEffect(() => {
    void fetchInstruments().then((res) => {
      if (res.data) setInstruments(res.data.filter((i) => i.active !== false));
    });
  }, []);

  const requiresInstruments = comparisonTypeRequiresInstruments(setup.comparisonType);

  const sectionStats = useCallback((section: ComparisonSectionCode) => {
    const samples = study.samples.filter((s) => s.section === section);
    const sampleIds = new Set(samples.map((s) => s.id));
    const results = study.results.filter((r) => sampleIds.has(r.sampleId));
    return buildStudySummary(results, samples.length);
  }, [study]);

  const persistSetup = async () => {
    if (!setup.studyTitle.trim()) {
      toast.error('Study title is required');
      return false;
    }
    setSaving(true);
    const staff = await resolveStaffContext(user);
    const result = await saveStandardComparisonSetup(study.id, staff, {
      studyTitle: setup.studyTitle.trim(),
      comparisonType: setup.comparisonType,
      studyDate: setup.studyDate,
      purpose: setup.purpose,
      referenceLabel: setup.referenceLabel,
      comparisonLabel: setup.comparisonLabel,
      referenceInstrumentId: setup.referenceInstrumentId || undefined,
      comparisonInstrumentId: setup.comparisonInstrumentId || undefined,
      generalComments: setup.generalComments,
      sections: setup.sections,
    });
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to save setup');
      return false;
    }
    onRefresh(result.data);
    return true;
  };

  const persistResults = async () => {
    setSaving(true);
    const staff = await resolveStaffContext(user);
    const inputs = Object.entries(resultValues).map(([id, row]) => ({
      id,
      previousResult: row.previous === '' || row.previous == null ? null : Number(row.previous),
      newResult: row.new === '' || row.new == null ? null : Number(row.new),
      issueObservation: row.issueObservation,
      correctiveAction: row.correctiveAction,
    }));
    const result = await saveComparisonResults(study.id, staff, inputs);
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to save results');
      return false;
    }
    onRefresh(result.data);
    toast.success('Results saved');
    return true;
  };

  const handleSubmit = async () => {
    const saved = await persistResults();
    if (!saved) return;
    setSaving(true);
    const staff = await resolveStaffContext(user);
    const result = await submitComparisonStudy(study.id, staff);
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to submit');
      return;
    }
    onRefresh(result.data);
    toast.success('Study submitted');
  };

  const handleReview = async (action: 'review' | 'return' | 'reject', comment?: string) => {
    setSaving(true);
    const staff = await resolveStaffContext(user);
    const result = await reviewComparisonStudy(study.id, staff, { action, comment });
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Review action failed');
      return;
    }
    onRefresh(result.data);
    toast.success('Review recorded');
  };

  const handleApprove = async (action: 'approve' | 'return' | 'reject', comment?: string) => {
    setSaving(true);
    const staff = await resolveStaffContext(user);
    const result = await approveComparisonStudy(study.id, staff, { action, comment });
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Approval action failed');
      return;
    }
    onRefresh(result.data);
    toast.success(action === 'approve' ? 'Study approved' : 'Action recorded');
  };

  const handleManualReview = async (resultId: string, decision: ComparisonManualReviewDecision, comment: string) => {
    setSaving(true);
    const staff = await resolveStaffContext(user);
    const result = await completeManualReview(resultId, study.id, staff, { decision, comment });
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Manual review failed');
      return;
    }
    onRefresh(result.data);
    toast.success('Manual review completed');
  };

  const handleAddSample = async () => {
    if (!newSampleId.trim()) {
      toast.error('Sample ID is required');
      return;
    }
    setSaving(true);
    const staff = await resolveStaffContext(user);
    const result = await addComparisonSample(study.id, activeSection, newSampleId.trim(), staff);
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to add sample');
      return;
    }
    setNewSampleId('');
    onRefresh(result.data);
  };

  const handleRemoveSample = async (sampleRowId: string) => {
    setSaving(true);
    const staff = await resolveStaffContext(user);
    const result = await removeComparisonSample(study.id, sampleRowId, staff);
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to remove sample');
      return;
    }
    onRefresh(result.data);
  };

  const exportPdf = async () => {
    if (!canExportComparisonStudies(can)) return;
    const blob = await createComparisonForm013Pdf(study);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${study.studyNumber}-Form-Hema-013.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
    const staff = await resolveStaffContext(user);
    await logComparisonExport(study.id, staff, 'PDF');
  };

  const exportExcel = async () => {
    if (!canExportComparisonStudies(can)) return;
    const audit = await fetchComparisonAuditEvents(study.id);
    const auditEvents: ComparisonAuditEvent[] = audit.data.map((event) => ({
      id: event.id,
      studyId: event.studyId,
      userId: event.userId,
      userName: event.userName,
      staffId: event.staffId ?? undefined,
      action: event.action,
      oldStatus: event.oldStatus ?? undefined,
      newStatus: event.newStatus ?? undefined,
      comment: event.comment ?? undefined,
      metadata: event.metadata,
      createdAt: event.createdAt,
    }));
    downloadComparisonExcel(study, auditEvents);
    const staff = await resolveStaffContext(user);
    await logComparisonExport(study.id, staff, 'EXCEL');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Standard Comparison Study</h2>
          <Badge variant="secondary">{COMPARISON_STATUS_LABELS[study.status] ?? study.status}</Badge>
          <ComparisonOverallResultBadge result={study.overallResult} />
        </div>
        <p className="text-sm text-muted-foreground">
          {FORM_HEMA_013_CODE} · {study.studyNumber} · v{study.versionNumber}
        </p>
        {canExportComparisonStudies(can) && (
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => void exportPdf()}>{CONTROLLED_FORM_PRINT_LABEL}</Button>
            <Button variant="outline" size="sm" onClick={() => void exportExcel()}>{CONTROLLED_FORM_EXPORT_EXCEL_LABEL}</Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {WIZARD_STEPS.map((label, index) => (
          <Button
            key={label}
            size="sm"
            variant={step === index ? 'default' : 'outline'}
            onClick={() => setStep(index)}
          >
            {index + 1}. {label}
          </Button>
        ))}
      </div>

      {step === 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Study Setup</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Study Title</Label>
              <Input disabled={!editable} value={setup.studyTitle} onChange={(e) => setSetup((p) => ({ ...p, studyTitle: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Comparison Type</Label>
              <Select disabled={!editable} value={setup.comparisonType} onValueChange={(v) => setSetup((p) => ({ ...p, comparisonType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMPARISON_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Study Date</Label>
              <Input type="date" disabled={!editable} value={setup.studyDate} onChange={(e) => setSetup((p) => ({ ...p, studyDate: e.target.value }))} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Reason / Purpose</Label>
              <Textarea disabled={!editable} value={setup.purpose} onChange={(e) => setSetup((p) => ({ ...p, purpose: e.target.value }))} rows={2} />
            </div>
            {requiresInstruments ? (
              <>
                <div className="space-y-2">
                  <Label>Reference Instrument</Label>
                  <Select disabled={!editable} value={setup.referenceInstrumentId} onValueChange={(v) => {
                    const inst = instruments.find((i) => i.id === v);
                    setSetup((p) => ({
                      ...p,
                      referenceInstrumentId: v,
                      referenceLabel: inst ? formatInstrumentSelectorLabel(inst) : p.referenceLabel,
                    }));
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select instrument" /></SelectTrigger>
                    <SelectContent>
                      {instruments.map((inst) => (
                        <SelectItem key={inst.id} value={inst.id}>{formatInstrumentSelectorLabel(inst)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Comparison Instrument</Label>
                  <Select disabled={!editable} value={setup.comparisonInstrumentId} onValueChange={(v) => {
                    const inst = instruments.find((i) => i.id === v);
                    setSetup((p) => ({
                      ...p,
                      comparisonInstrumentId: v,
                      comparisonLabel: inst ? formatInstrumentSelectorLabel(inst) : p.comparisonLabel,
                    }));
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select instrument" /></SelectTrigger>
                    <SelectContent>
                      {instruments.map((inst) => (
                        <SelectItem key={inst.id} value={inst.id}>{formatInstrumentSelectorLabel(inst)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Reference / Previous Side</Label>
                  <Input disabled={!editable} value={setup.referenceLabel} onChange={(e) => setSetup((p) => ({ ...p, referenceLabel: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Comparison / New Side</Label>
                  <Input disabled={!editable} value={setup.comparisonLabel} onChange={(e) => setSetup((p) => ({ ...p, comparisonLabel: e.target.value }))} />
                </div>
              </>
            )}
            <div className="space-y-2 sm:col-span-2">
              <Label>General Notes</Label>
              <Textarea disabled={!editable} value={setup.generalComments} onChange={(e) => setSetup((p) => ({ ...p, generalComments: e.target.value }))} rows={2} />
            </div>
            {editable && (
              <div className="sm:col-span-2">
                <Button disabled={saving} onClick={() => void persistSetup().then((ok) => ok && toast.success('Setup saved'))}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Setup'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Select Sections</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {SECTION_OPTIONS.map((section) => (
              <label key={section} className="flex items-center gap-2">
                <Checkbox
                  checked={setup.sections.includes(section)}
                  disabled={!editable || study.sections.length > 0}
                  onCheckedChange={(checked) => {
                    setSetup((p) => ({
                      ...p,
                      sections: checked
                        ? [...p.sections, section]
                        : p.sections.filter((s) => s !== section),
                    }));
                  }}
                />
                <span>{section}</span>
              </label>
            ))}
            {study.sections.length > 0 && (
              <p className="text-xs text-muted-foreground">Sections are fixed after initial creation. Create a new study to change sections.</p>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Samples</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as ComparisonSectionCode)}>
              <TabsList className="flex flex-wrap h-auto">
                {study.sections.map((sec) => (
                  <TabsTrigger key={sec.section} value={sec.section}>{sec.section}</TabsTrigger>
                ))}
              </TabsList>
              {study.sections.map((sec) => (
                <TabsContent key={sec.section} value={sec.section} className="space-y-3">
                  {study.samples.filter((s) => s.section === sec.section).map((sample) => (
                    <div key={sample.id} className="flex items-center justify-between rounded border px-3 py-2">
                      <span>{sample.sampleId}</span>
                      {editable && (
                        <Button variant="ghost" size="sm" onClick={() => void handleRemoveSample(sample.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {editable && (
                    <div className="flex flex-wrap gap-2">
                      <Input
                        placeholder="New Sample ID"
                        value={newSampleId}
                        onChange={(e) => setNewSampleId(e.target.value)}
                        className="max-w-xs"
                      />
                      <Button onClick={() => void handleAddSample()} disabled={saving}>
                        <Plus className="h-4 w-4 mr-1" /> Add Sample
                      </Button>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as ComparisonSectionCode)}>
            <div className="md:hidden">
              <Select value={activeSection} onValueChange={(v) => setActiveSection(v as ComparisonSectionCode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {study.sections.map((sec) => {
                    const stats = sectionStats(sec.section);
                    return (
                      <SelectItem key={sec.section} value={sec.section}>
                        {sec.section} — {stats.completionPercent.toFixed(0)}% complete
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <TabsList className="hidden md:flex flex-wrap h-auto">
              {study.sections.map((sec) => {
                const stats = sectionStats(sec.section);
                return (
                  <TabsTrigger key={sec.section} value={sec.section} className="text-xs">
                    {sec.section} · {study.samples.filter((s) => s.section === sec.section).length} samples · {stats.acceptable}✓ {stats.notAcceptable}✕ {stats.manualReview}!
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {study.sections.map((sec) => (
              <TabsContent key={sec.section} value={sec.section}>
                <ComparisonResultGrid
                  study={study}
                  section={sec.section}
                  editable={editable}
                  values={resultValues}
                  onChange={(resultId, patch) => setResultValues((prev) => ({
                    ...prev,
                    [resultId]: { ...prev[resultId], ...patch },
                  }))}
                />
              </TabsContent>
            ))}
          </Tabs>
          {editable && (
            <Button disabled={saving} onClick={() => void persistResults()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Results'}
            </Button>
          )}
        </div>
      )}

      {step === 4 && (
        <ComparisonStudySummaryPanel study={study} activeSection={activeSection} />
      )}

      {step === 5 && (
        <div className="space-y-4">
          <ComparisonStudySummaryPanel study={study} />
          <ComparisonStudyWorkflow
            study={study}
            can={can}
            saving={saving}
            onSubmit={handleSubmit}
            onReview={handleReview}
            onApprove={handleApprove}
            onManualReview={handleManualReview}
          />
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Previous</Button>
        <Button variant="outline" disabled={step >= WIZARD_STEPS.length - 1} onClick={() => setStep((s) => s + 1)}>Next</Button>
      </div>
    </div>
  );
}
