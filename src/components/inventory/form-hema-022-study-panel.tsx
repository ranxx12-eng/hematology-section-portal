'use client';

import { useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusChip } from '@/components/ui/status-chip';
import {
  approveReagentLotComparison,
  activateReagentLotFromComparison,
  reviewReagentLotComparison,
} from '@/lib/clinical/inventory-reagent-lot';
import {
  groupFormHema022Results,
  saveFormHema022Results,
  submitFormHema022Study,
} from '@/lib/clinical/inventory-reagent-lot-form-hema-022';
import { fetchInventoryItems } from '@/lib/clinical/inventory';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import { createFormHema022Pdf } from '@/lib/print/form-hema-022-pdf';
import {
  LOT_INTERPRETATION_LABELS,
  LOT_STUDY_STATUS_LABELS,
  lotInterpretationChipVariant,
} from '@/lib/inventory/constants';
import { FORM_HEMA_022_CODE, FORM_HEMA_022_TITLE } from '@/lib/inventory/form-hema-022/constants';
import { SYNTHETIC_SAMPLE_ID_PREFIX } from '@/lib/security/sample-id-crypto';
import { formatDate } from '@/lib/utils';
import type { Profile } from '@/types';
import type { ReagentLotComparison } from '@/types/inventory-module';

interface FormHema022StudyPanelProps {
  study: ReagentLotComparison;
  locale: string;
  canManage: boolean;
  user: Profile;
  onReload: () => Promise<void>;
}

type ResultValues = Record<string, { old?: string; new?: string; comment?: string }>;
type SampleIdValues = Record<number, string>;

export function FormHema022StudyPanel({
  study,
  locale,
  canManage,
  user,
  onReload,
}: FormHema022StudyPanelProps) {
  const editable = canManage && (study.status === 'draft' || study.status === 'returned');
  const grouped = useMemo(() => groupFormHema022Results(study.results), [study.results]);
  const sampleNumbers = useMemo(
    () => [...grouped.keys()].sort((a, b) => a - b),
    [grouped],
  );

  const [values, setValues] = useState<ResultValues>(() => {
    const initial: ResultValues = {};
    for (const result of study.results) {
      initial[result.id] = {
        old: result.oldResult != null ? String(result.oldResult) : '',
        new: result.newResult != null ? String(result.newResult) : '',
        comment: result.comment ?? '',
      };
    }
    return initial;
  });
  const [sampleIds, setSampleIds] = useState<SampleIdValues>({
    1: `${SYNTHETIC_SAMPLE_ID_PREFIX}001`,
    2: `${SYNTHETIC_SAMPLE_ID_PREFIX}002`,
    3: `${SYNTHETIC_SAMPLE_ID_PREFIX}003`,
  });
  const [conclusion, setConclusion] = useState(study.conclusion ?? '');
  const [comments, setComments] = useState(study.comments ?? '');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const overallPassFail = useMemo(() => {
    if (!study.acceptanceCriteriaConfigured) return null;
    const interpretations = study.results.map((r) => r.interpretation);
    if (interpretations.some((i) => i === 'incomplete' || i === 'criteria_not_configured')) return null;
    return interpretations.every((i) => i === 'acceptable') ? 'PASS' : 'FAIL';
  }, [study]);

  const persistSampleIds = async () => {
    const res = await fetch(`/api/inventory/reagent-lot/${study.id}/sample-ids`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        samples: sampleNumbers.map((sampleNumber) => ({
          sampleNumber,
          sampleId: sampleIds[sampleNumber] ?? '',
        })),
      }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.error ?? 'Failed to save Sample IDs.');
    }
  };

  const persist = async () => {
    setSaving(true);
    try {
      await persistSampleIds();
      const staff = await resolveStaffContext(user);
      const inputs = study.results.map((r) => ({
        id: r.id,
        oldResult: values[r.id]?.old === '' ? null : Number(values[r.id]?.old),
        newResult: values[r.id]?.new === '' ? null : Number(values[r.id]?.new),
        comment: values[r.id]?.comment,
      }));
      const res = await saveFormHema022Results(staff, study.id, inputs, { conclusion, comments });
      if (res.error) toast.error(res.error);
      else {
        toast.success('Saved');
        await onReload();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const blob = await createFormHema022Pdf(study);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${study.studyNumber}-${FORM_HEMA_022_CODE}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'PDF export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{FORM_HEMA_022_CODE} · {FORM_HEMA_022_TITLE}</CardTitle>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <StatusChip variant="info" label={LOT_STUDY_STATUS_LABELS[study.status] ?? study.status} />
            {overallPassFail && (
              <StatusChip
                variant={overallPassFail === 'PASS' ? 'success' : 'danger'}
                label={`Overall: ${overallPassFail}`}
              />
            )}
            <span>{study.studyNumber}</span>
            <span>Year: {study.studyYear ?? '—'}</span>
            <span>Group: {study.analyteTestGroup ?? '—'}</span>
            <span>Reagent: {study.reagentName}</span>
            <span>Instrument: {study.instrumentNameSnapshot ?? '—'}</span>
            <span>Study date: {study.studyDate ? formatDate(study.studyDate, locale) : '—'}</span>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <span>Previous lot: {study.oldLotNumber}{study.oldLotSnapshot?.expiryDate ? ` · exp ${study.oldLotSnapshot.expiryDate}` : ''}</span>
            <span>New lot: {study.newLotNumber}{study.newLotSnapshot?.expiryDate ? ` · exp ${study.newLotSnapshot.expiryDate}` : ''}</span>
          </div>
          {study.reagentKey === 'retic_reagent' && (
            <p className="text-sm text-muted-foreground">
              Quantitative Test: Use Total Allowable Error (TAE) RETIC: +/- 25 %. R%: +/- 25 %.
            </p>
          )}
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-xs text-muted-foreground">Prepared by</p><p>{study.preparedByName ?? '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">Reviewed by</p><p>{study.reviewedByName ?? '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">Approved by</p><p>{study.approvedByName ?? '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">Tests</p><p>{study.testCodesSnapshot?.map((t) => t.label).join(', ') ?? '—'}</p></div>
        </CardContent>
      </Card>

      {sampleNumbers.map((sampleNumber) => (
        <Card key={sampleNumber}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sample {sampleNumber}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-w-sm space-y-1">
              <Label>Sample ID {editable ? '(synthetic IDs only until encryption key is configured)' : ''}</Label>
              <Input
                disabled={!editable}
                value={sampleIds[sampleNumber] ?? ''}
                onChange={(e) => setSampleIds({ ...sampleIds, [sampleNumber]: e.target.value })}
                placeholder={`${SYNTHETIC_SAMPLE_ID_PREFIX}001`}
              />
            </div>
            <div className="rounded-2xl border overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-2 text-left">Test</th>
                    <th className="p-2 text-left">Unit</th>
                    <th className="p-2 text-left">Previous</th>
                    <th className="p-2 text-left">New</th>
                    <th className="p-2 text-left">Difference (units)</th>
                    <th className="p-2 text-left">Difference (percent)</th>
                    <th className="p-2 text-left">Interpretation</th>
                    <th className="p-2 text-left">Comments</th>
                    <th className="p-2 text-left">Initials</th>
                    <th className="p-2 text-left">Supervisor Review</th>
                  </tr>
                </thead>
                <tbody>
                  {(grouped.get(sampleNumber) ?? []).map((result) => (
                    <tr key={result.id} className="border-b">
                      <td className="p-2">{result.testLabel ?? result.testCode ?? '—'}</td>
                      <td className="p-2 text-muted-foreground">{result.unit ?? '—'}</td>
                      <td className="p-2">
                        <Input
                          disabled={!editable}
                          className="h-8 w-24"
                          value={values[result.id]?.old ?? ''}
                          onChange={(e) => setValues({ ...values, [result.id]: { ...values[result.id], old: e.target.value } })}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          disabled={!editable}
                          className="h-8 w-24"
                          value={values[result.id]?.new ?? ''}
                          onChange={(e) => setValues({ ...values, [result.id]: { ...values[result.id], new: e.target.value } })}
                        />
                      </td>
                      <td className="p-2 text-muted-foreground">{result.differenceUnits?.toFixed(4) ?? '—'}</td>
                      <td className="p-2 text-muted-foreground">
                        {result.interpretation === 'cannot_calculate'
                          ? 'Cannot Calculate'
                          : result.differencePercent != null
                            ? `${result.differencePercent.toFixed(1)}%`
                            : '—'}
                      </td>
                      <td className="p-2">
                        <StatusChip
                          variant={lotInterpretationChipVariant(result.interpretation)}
                          label={LOT_INTERPRETATION_LABELS[result.interpretation]}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          disabled={!editable}
                          className="h-8 min-w-32"
                          value={values[result.id]?.comment ?? ''}
                          onChange={(e) => setValues({ ...values, [result.id]: { ...values[result.id], comment: e.target.value } })}
                        />
                      </td>
                      <td className="p-2 text-muted-foreground">{result.recordedByStaffId ?? result.recordedByName ?? '—'}</td>
                      <td className="p-2 text-muted-foreground">{study.reviewedByName ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="space-y-2">
        <Label>Conclusion</Label>
        <Textarea disabled={!editable} value={conclusion} onChange={(e) => setConclusion(e.target.value)} rows={2} />
      </div>
      <div className="space-y-2">
        <Label>Comments</Label>
        <Textarea disabled={!editable} value={comments} onChange={(e) => setComments(e.target.value)} rows={2} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={exporting} onClick={() => void exportPdf()}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 me-2" />}
          Export PDF
        </Button>
        {canManage && editable && <Button disabled={saving} onClick={() => void persist()}>Save Draft</Button>}
        {canManage && editable && (
          <Button variant="outline" disabled={saving} onClick={async () => {
            await persist();
            const staff = await resolveStaffContext(user);
            const res = await submitFormHema022Study(staff, study.id);
            if (res.error) toast.error(res.error);
            else { toast.success('Submitted for review'); await onReload(); }
          }}>Submit for Review</Button>
        )}
        {canManage && study.status === 'pending_review' && (
          <>
            <Button onClick={async () => {
              const staff = await resolveStaffContext(user);
              const res = await reviewReagentLotComparison(staff, study.id, 'review');
              if (res.error) toast.error(res.error);
              else { toast.success('Reviewed'); await onReload(); }
            }}>Review</Button>
            <Button variant="outline" onClick={async () => {
              const staff = await resolveStaffContext(user);
              const res = await reviewReagentLotComparison(staff, study.id, 'return');
              if (res.error) toast.error(res.error);
              else { toast.success('Returned'); await onReload(); }
            }}>Return</Button>
          </>
        )}
        {canManage && study.status === 'pending_approval' && (
          <Button onClick={async () => {
            const staff = await resolveStaffContext(user);
            const res = await approveReagentLotComparison(staff, study.id, 'approve');
            if (res.error) toast.error(res.error);
            else { toast.success('Approved'); await onReload(); }
          }}>Approve</Button>
        )}
        {canManage && study.status === 'approved' && !study.activatedAt && (
          <Button onClick={async () => {
            const items = await fetchInventoryItems();
            const newItem = items.data.find((i) => i.id === study.newStoreItemId)
              ?? items.data.find((i) => i.lotNumber === study.newLotNumber && i.itemName === study.reagentName);
            if (!newItem) {
              toast.error('Link a new store item before activation');
              return;
            }
            const staff = await resolveStaffContext(user);
            const res = await activateReagentLotFromComparison(staff, study.id, newItem);
            if (res.error) toast.error(res.error);
            else { toast.success('New lot activated'); await onReload(); }
          }}>Activate New Lot</Button>
        )}
      </div>
    </div>
  );
}
