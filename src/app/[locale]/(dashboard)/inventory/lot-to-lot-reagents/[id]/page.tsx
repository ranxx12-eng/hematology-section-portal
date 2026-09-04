'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusChip } from '@/components/ui/status-chip';
import {
  activateReagentLotFromComparison,
  approveReagentLotComparison,
  fetchReagentLotComparisonById,
  reviewReagentLotComparison,
  saveReagentLotComparisonResults,
  submitReagentLotComparison,
} from '@/lib/clinical/inventory-reagent-lot';
import { fetchInventoryItems } from '@/lib/clinical/inventory';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import { useAuth } from '@/components/providers/auth-provider';
import {
  LOT_INTERPRETATION_LABELS,
  LOT_STUDY_STATUS_LABELS,
  lotInterpretationChipVariant,
} from '@/lib/inventory/constants';
import { formatDate } from '@/lib/utils';
import type { ReagentLotComparison } from '@/types/inventory-module';

export default function ReagentLotComparisonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const locale = useLocale();
  const { can, user } = useAuth();
  const canManage = can('inventory.manage');
  const [study, setStudy] = useState<ReagentLotComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, { old?: string; new?: string; comment?: string }>>({});
  const [conclusion, setConclusion] = useState('');
  const [comments, setComments] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const res = await fetchReagentLotComparisonById(id);
    setStudy(res.data);
    if (res.data) {
      const next: Record<string, { old?: string; new?: string; comment?: string }> = {};
      for (const r of res.data.results) {
        next[r.id] = {
          old: r.oldResult != null ? String(r.oldResult) : '',
          new: r.newResult != null ? String(r.newResult) : '',
          comment: r.comment ?? '',
        };
      }
      setValues(next);
      setConclusion(res.data.conclusion ?? '');
      setComments(res.data.comments ?? '');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const overallPassFail = useMemo(() => {
    if (!study?.acceptanceCriteriaConfigured) return null;
    const interpretations = study.results.map((r) => r.interpretation);
    if (interpretations.some((i) => i === 'incomplete' || i === 'criteria_not_configured')) return null;
    return interpretations.every((i) => i === 'acceptable') ? 'PASS' : 'FAIL';
  }, [study]);

  const persist = async () => {
    if (!user || !study) return;
    const staff = await resolveStaffContext(user);
    const inputs = study.results.map((r) => ({
      id: r.id,
      oldResult: values[r.id]?.old === '' ? null : Number(values[r.id]?.old),
      newResult: values[r.id]?.new === '' ? null : Number(values[r.id]?.new),
      comment: values[r.id]?.comment,
    }));
    const res = await saveReagentLotComparisonResults(staff, study.id, inputs, {
      conclusion,
      comments,
    });
    if (res.error) toast.error(res.error);
    else {
      toast.success('Saved');
      setStudy(res.data);
    }
  };

  if (loading || !study) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const editable = canManage && (study.status === 'draft' || study.status === 'returned');

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/${locale}/inventory/lot-to-lot-reagents`}><ArrowLeft className="h-4 w-4 me-2" />Back</Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{study.studyNumber} · {study.reagentName}</CardTitle>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <StatusChip variant="info" label={LOT_STUDY_STATUS_LABELS[study.status] ?? study.status} />
            {overallPassFail && (
              <StatusChip
                variant={overallPassFail === 'PASS' ? 'success' : 'danger'}
                label={`Overall: ${overallPassFail}`}
              />
            )}
            {study.instrumentNameSnapshot && <span>Instrument: {study.instrumentNameSnapshot}</span>}
            {study.testParameter && <span>Parameter: {study.testParameter}</span>}
            <span>Old Lot: {study.oldLotNumber}</span>
            {study.oldLotSnapshot?.expiryDate && (
              <span>Old Expiry: {formatDate(study.oldLotSnapshot.expiryDate, locale)}</span>
            )}
            <span>New Lot: {study.newLotNumber}</span>
            {study.newLotSnapshot?.expiryDate && (
              <span>New Expiry: {formatDate(study.newLotSnapshot.expiryDate, locale)}</span>
            )}
            {study.studyDate && <span>Comparison: {formatDate(study.studyDate, locale)}</span>}
            {study.acceptanceMaxDifferencePercent != null && (
              <span>Acceptance: ≤ {study.acceptanceMaxDifferencePercent}% difference</span>
            )}
          </div>
          {!study.acceptanceCriteriaConfigured && (
            <p className="text-sm text-amber-700 dark:text-amber-300">Acceptance criteria not configured — interpretation is not automated.</p>
          )}
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Created by</p>
            <p>{study.preparedByName ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Submitted</p>
            <p>{study.preparedAt ? formatDate(study.preparedAt, locale) : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Reviewed by</p>
            <p>{study.reviewedByName ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Approved by</p>
            <p>{study.approvedByName ?? '—'}</p>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-2xl border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="p-2 text-left">Sample #</th>
              <th className="p-2 text-left">Old Result</th>
              <th className="p-2 text-left">New Result</th>
              <th className="p-2 text-left">Difference</th>
              <th className="p-2 text-left">% Difference</th>
              <th className="p-2 text-left">Acceptance Criterion</th>
              <th className="p-2 text-left">Evaluation</th>
            </tr>
          </thead>
          <tbody>
            {study.results.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-2">{r.sampleNumber}</td>
                <td className="p-2">
                  <Input
                    disabled={!editable}
                    className="h-8 w-24"
                    value={values[r.id]?.old ?? ''}
                    onChange={(e) => setValues({ ...values, [r.id]: { ...values[r.id], old: e.target.value } })}
                  />
                </td>
                <td className="p-2">
                  <Input
                    disabled={!editable}
                    className="h-8 w-24"
                    value={values[r.id]?.new ?? ''}
                    onChange={(e) => setValues({ ...values, [r.id]: { ...values[r.id], new: e.target.value } })}
                  />
                </td>
                <td className="p-2 text-muted-foreground">
                  {r.differenceUnits != null ? r.differenceUnits.toFixed(4) : '—'}
                </td>
                <td className="p-2 text-muted-foreground">
                  {r.differencePercent != null ? `${r.differencePercent.toFixed(2)}%` : '—'}
                </td>
                <td className="p-2 text-muted-foreground">{r.acceptanceCriterionText ?? 'Acceptance criteria not configured'}</td>
                <td className="p-2">
                  <StatusChip
                    variant={lotInterpretationChipVariant(r.interpretation)}
                    label={LOT_INTERPRETATION_LABELS[r.interpretation]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <Label>Conclusion</Label>
        <Textarea disabled={!editable} value={conclusion} onChange={(e) => setConclusion(e.target.value)} rows={2} />
      </div>
      <div className="space-y-2">
        <Label>Comments</Label>
        <Textarea disabled={!editable} value={comments} onChange={(e) => setComments(e.target.value)} rows={2} />
      </div>

      {canManage && (
        <div className="flex flex-wrap gap-2">
          {editable && <Button onClick={() => void persist()}>Save Draft</Button>}
          {editable && user && (
            <Button variant="outline" onClick={async () => {
              await persist();
              const staff = await resolveStaffContext(user);
              const res = await submitReagentLotComparison(staff, study.id);
              if (res.error) toast.error(res.error);
              else { toast.success('Submitted for review'); void load(); }
            }}>Submit for Review</Button>
          )}
          {study.status === 'pending_review' && user && (
            <>
              <Button onClick={async () => {
                const staff = await resolveStaffContext(user);
                const res = await reviewReagentLotComparison(staff, study.id, 'review');
                if (res.error) toast.error(res.error);
                else { toast.success('Reviewed'); void load(); }
              }}>Review</Button>
              <Button variant="outline" onClick={async () => {
                const staff = await resolveStaffContext(user);
                const res = await reviewReagentLotComparison(staff, study.id, 'return');
                if (res.error) toast.error(res.error);
                else { toast.success('Returned to preparer'); void load(); }
              }}>Return</Button>
              <Button variant="destructive" onClick={async () => {
                const staff = await resolveStaffContext(user);
                const res = await reviewReagentLotComparison(staff, study.id, 'reject');
                if (res.error) toast.error(res.error);
                else { toast.success('Rejected'); void load(); }
              }}>Reject</Button>
            </>
          )}
          {study.status === 'pending_approval' && user && (
            <>
              <Button onClick={async () => {
                const staff = await resolveStaffContext(user);
                const res = await approveReagentLotComparison(staff, study.id, 'approve');
                if (res.error) toast.error(res.error);
                else { toast.success('Approved'); void load(); }
              }}>Approve</Button>
              <Button variant="outline" onClick={async () => {
                const staff = await resolveStaffContext(user);
                const res = await approveReagentLotComparison(staff, study.id, 'return');
                if (res.error) toast.error(res.error);
                else { toast.success('Returned'); void load(); }
              }}>Return</Button>
              <Button variant="destructive" onClick={async () => {
                const staff = await resolveStaffContext(user);
                const res = await approveReagentLotComparison(staff, study.id, 'reject');
                if (res.error) toast.error(res.error);
                else { toast.success('Rejected'); void load(); }
              }}>Reject</Button>
            </>
          )}
          {study.status === 'approved' && !study.activatedAt && user && (
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
              else { toast.success('New lot activated'); void load(); }
            }}>Activate New Lot</Button>
          )}
        </div>
      )}
    </div>
  );
}
