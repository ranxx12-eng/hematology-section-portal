'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { LOT_INTERPRETATION_LABELS, LOT_STUDY_STATUS_LABELS } from '@/lib/inventory/constants';
import type { ReagentLotComparison } from '@/types/inventory-module';

export default function ReagentLotComparisonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const locale = useLocale();
  const { can, user } = useAuth();
  const canManage = can('inventory.manage');
  const [study, setStudy] = useState<ReagentLotComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, { old?: string; new?: string; comment?: string }>>({});

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
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const persist = async () => {
    if (!user || !study) return;
    const staff = await resolveStaffContext(user);
    const inputs = study.results.map((r) => ({
      id: r.id,
      oldResult: values[r.id]?.old === '' ? null : Number(values[r.id]?.old),
      newResult: values[r.id]?.new === '' ? null : Number(values[r.id]?.new),
      comment: values[r.id]?.comment,
    }));
    const res = await saveReagentLotComparisonResults(staff, study.id, inputs);
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
            <span>Old Lot: {study.oldLotNumber}</span>
            <span>New Lot: {study.newLotNumber}</span>
          </div>
          {!study.acceptanceCriteriaConfigured && (
            <p className="text-sm text-amber-700 dark:text-amber-300">Acceptance criteria not configured — interpretation is not automated.</p>
          )}
        </CardHeader>
      </Card>

      <div className="rounded-2xl border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="p-2 text-left">Sample #</th>
              <th className="p-2 text-left">Old Result</th>
              <th className="p-2 text-left">New Result</th>
              <th className="p-2 text-left">Acceptance Criterion</th>
              <th className="p-2 text-left">Interpretation</th>
            </tr>
          </thead>
          <tbody>
            {study.results.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-2">{r.sampleNumber}</td>
                <td className="p-2"><Input disabled={!editable} className="h-8 w-24" value={values[r.id]?.old ?? ''} onChange={(e) => setValues({ ...values, [r.id]: { ...values[r.id], old: e.target.value } })} /></td>
                <td className="p-2"><Input disabled={!editable} className="h-8 w-24" value={values[r.id]?.new ?? ''} onChange={(e) => setValues({ ...values, [r.id]: { ...values[r.id], new: e.target.value } })} /></td>
                <td className="p-2 text-muted-foreground">{r.acceptanceCriterionText ?? 'Acceptance criteria not configured'}</td>
                <td className="p-2"><StatusChip variant="warning" label={LOT_INTERPRETATION_LABELS[r.interpretation]} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Textarea disabled={!editable} placeholder="Conclusion" defaultValue={study.conclusion} />

      {canManage && (
        <div className="flex flex-wrap gap-2">
          {editable && <Button onClick={() => void persist()}>Save Draft</Button>}
          {editable && user && (
            <Button variant="outline" onClick={async () => {
              await persist();
              const staff = await resolveStaffContext(user);
              const res = await submitReagentLotComparison(staff, study.id);
              if (res.error) toast.error(res.error);
              else { toast.success('Submitted'); void load(); }
            }}>Submit</Button>
          )}
          {study.status === 'pending_review' && user && (
            <Button onClick={async () => {
              const staff = await resolveStaffContext(user);
              const res = await reviewReagentLotComparison(staff, study.id, 'review');
              if (res.error) toast.error(res.error);
              else void load();
            }}>Review</Button>
          )}
          {study.status === 'pending_approval' && user && (
            <Button onClick={async () => {
              const staff = await resolveStaffContext(user);
              const res = await approveReagentLotComparison(staff, study.id, 'approve');
              if (res.error) toast.error(res.error);
              else void load();
            }}>Approve</Button>
          )}
          {study.status === 'approved' && !study.activatedAt && user && (
            <Button onClick={async () => {
              const items = await fetchInventoryItems();
              const newItem = items.data.find((i) => i.id === study.newStoreItemId) ?? items.data.find((i) => i.lotNumber === study.newLotNumber);
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
