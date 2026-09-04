'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusChip } from '@/components/ui/status-chip';
import { StickyActionBar } from '@/components/layout/sticky-action-bar';
import { CbcParameterTable, type CbcParameterValues } from '@/components/inventory/qc-lot-verification/cbc-parameter-table';
import { CbcRunTracking } from '@/components/inventory/qc-lot-verification/cbc-run-tracking';
import { LotHistoryDrawer } from '@/components/inventory/lot-history-drawer';
import {
  approveQcLotVerification,
  buildParameterSummary,
  buildRunProgress,
  fetchQcLotVerificationById,
  reviewQcLotVerification,
  saveQcVerificationFinalDecision,
  saveQcVerificationParameters,
  submitQcLotVerification,
  toggleQcVerificationRun,
} from '@/lib/clinical/qc-lot-verification';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import { useAuth } from '@/components/providers/auth-provider';
import {
  FORM_HEMA_020_QID,
  FORM_HEMA_020_TITLE,
  QC_VERIFICATION_FINAL_DECISION_LABELS,
  QC_VERIFICATION_STATUS_LABELS,
} from '@/lib/qc-lot-verification/constants';
import { CONTROLLED_FORM_PRINT_LABEL } from '@/lib/print/controlled-form';
import { createQcForm020Pdf } from '@/lib/print/qc-form-020-pdf';
import type { QcLotVerificationStudy, QcVerificationFinalDecision } from '@/types/qc-lot-verification';

export default function CbcQcVerificationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const locale = useLocale();
  const { can, user } = useAuth();
  const canManage = can('inventory.manage');
  const [study, setStudy] = useState<QcLotVerificationStudy | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, CbcParameterValues>>({});
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const res = await fetchQcLotVerificationById(id);
    setStudy(res.data);
    if (res.data) {
      const next: Record<string, CbcParameterValues> = {};
      for (const p of res.data.parameters) {
        next[p.id] = {
          manufacturerMean: p.manufacturerMean != null ? String(p.manufacturerMean) : '',
          manufacturerSd: p.manufacturerSd != null ? String(p.manufacturerSd) : '',
          establishedMean: p.establishedMean != null ? String(p.establishedMean) : '',
          establishedSd: p.establishedSd != null ? String(p.establishedSd) : '',
        };
      }
      setValues(next);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const progress = useMemo(() => (study ? buildRunProgress(study.runs) : null), [study]);
  const summary = useMemo(() => (study ? buildParameterSummary(study.parameters) : null), [study]);
  const editable = canManage && study && ['draft', 'runs_completed'].includes(study.status);
  const paramsEditable = editable && Boolean(progress?.runsComplete);

  const persistParameters = async () => {
    if (!user || !study) return;
    const staff = await resolveStaffContext(user);
    const inputs = study.parameters.map((p) => ({
      id: p.id,
      manufacturerMean: values[p.id]?.manufacturerMean === '' ? null : Number(values[p.id]?.manufacturerMean),
      manufacturerSd: values[p.id]?.manufacturerSd === '' ? null : Number(values[p.id]?.manufacturerSd),
      establishedMean: values[p.id]?.establishedMean === '' ? null : Number(values[p.id]?.establishedMean),
      establishedSd: values[p.id]?.establishedSd === '' ? null : Number(values[p.id]?.establishedSd),
    }));
    const res = await saveQcVerificationParameters(staff, study.id, inputs);
    if (res.error) toast.error(res.error);
    else {
      toast.success('Saved');
      setStudy(res.data);
    }
  };

  const exportPdf = async () => {
    if (!study) return;
    const blob = await createQcForm020Pdf(study);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${study.studyNumber}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading || !study || !progress || !summary) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 pb-24">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/${locale}/inventory/qc-lot-verification`}><ArrowLeft className="h-4 w-4 me-2" />Back</Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{FORM_HEMA_020_TITLE}</CardTitle>
          <p className="text-sm text-muted-foreground">{study.studyNumber} · {FORM_HEMA_020_QID}</p>
          <div className="flex flex-wrap gap-2 text-sm">
            <StatusChip variant="info" label={QC_VERIFICATION_STATUS_LABELS[study.status]} />
            <span>{study.qcMaterialName}</span>
            <span>Lot {study.lotNumber}</span>
            <span>{study.instrumentNameSnapshot ?? 'No instrument'}</span>
          </div>
        </CardHeader>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">5-Day Run Tracking</h2>
        <CbcRunTracking
          runs={study.runs}
          editable={Boolean(editable)}
          onToggle={async (runId, completed) => {
            if (!user) return;
            const staff = await resolveStaffContext(user);
            const res = await toggleQcVerificationRun(staff, study.id, runId, completed);
            if (res.error) toast.error(res.error);
            else setStudy(res.data);
          }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Analyzer Summary / Form-Hema-020</h2>
        {!progress.runsComplete && (
          <p className="text-sm text-amber-700 dark:text-amber-300">Complete all 20 runs before entering analyzer summary values.</p>
        )}
        <CbcParameterTable
          parameters={study.parameters}
          values={values}
          editable={Boolean(paramsEditable)}
          onChange={(pid, field, value) => setValues({ ...values, [pid]: { ...values[pid], [field]: value } })}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Verification Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ['Total', summary.totalParameters],
            ['Passed', summary.passed],
            ['Failed', summary.failed],
            ['Manual Review', summary.manualReview],
            ['Incomplete', summary.incomplete],
          ].map(([label, value]) => (
            <Card key={label as string} className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{value}</p></CardContent></Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Final Decision</h2>
        <Select
          value={study.finalDecision ?? ''}
          disabled={!editable}
          onValueChange={(v) => {
            if (!editable || !user) return;
            void resolveStaffContext(user).then((staff) =>
              saveQcVerificationFinalDecision(staff, study.id, v as QcVerificationFinalDecision).then((res) => {
                if (res.data) setStudy(res.data);
              }),
            );
          }}
        >
          <SelectTrigger className="max-w-2xl"><SelectValue placeholder="Select final decision" /></SelectTrigger>
          <SelectContent>
            {Object.entries(QC_VERIFICATION_FINAL_DECISION_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Evidence</h2>
        <Card className="rounded-2xl">
          <CardContent className="p-4 text-sm text-muted-foreground space-y-2">
            <p>Supported evidence types (extensible): Raw Data Sheet, Alinity HQ QC Summary</p>
            <p className="text-xs">TODO: Wire portal attachment upload when configured for this workflow.</p>
          </CardContent>
        </Card>
      </section>

      <section>
        <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>Audit History</Button>
      </section>

      <LotHistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        lotNumber={study.lotNumber}
        title={`Verification Audit · ${study.studyNumber}`}
      />

      <StickyActionBar
        actions={[
          { id: 'print', label: CONTROLLED_FORM_PRINT_LABEL, variant: 'outline', onClick: () => void exportPdf() },
          { id: 'save', label: 'Save Draft', variant: 'secondary', hidden: !paramsEditable, onClick: () => void persistParameters() },
          {
            id: 'submit',
            label: 'Submit for Review',
            hidden: !editable,
            onClick: async () => {
              if (!user) return;
              await persistParameters();
              const staff = await resolveStaffContext(user);
              const res = await submitQcLotVerification(staff, study.id);
              if (res.error) toast.error(res.error);
              else { toast.success('Submitted'); void load(); }
            },
          },
          {
            id: 'review',
            label: 'Review',
            hidden: !(canManage && study.status === 'pending_review' && user),
            onClick: async () => {
              if (!user) return;
              const staff = await resolveStaffContext(user);
              const res = await reviewQcLotVerification(staff, study.id, 'review');
              if (res.error) toast.error(res.error);
              else void load();
            },
          },
          {
            id: 'approve',
            label: 'Approve',
            hidden: !(canManage && study.status === 'pending_approval' && user),
            onClick: async () => {
              if (!user) return;
              const staff = await resolveStaffContext(user);
              const res = await approveQcLotVerification(staff, study.id, 'approve');
              if (res.error) toast.error(res.error);
              else { toast.success('Approved'); void load(); }
            },
          },
          {
            id: 'reject',
            label: 'Reject',
            variant: 'destructive',
            hidden: !(canManage && (study.status === 'pending_review' || study.status === 'pending_approval') && user),
            onClick: async () => {
              if (!user) return;
              const staff = await resolveStaffContext(user);
              const res = study.status === 'pending_review'
                ? await reviewQcLotVerification(staff, study.id, 'reject')
                : await approveQcLotVerification(staff, study.id, 'reject');
              if (res.error) toast.error(res.error);
              else void load();
            },
          },
        ]}
      />
    </div>
  );
}
