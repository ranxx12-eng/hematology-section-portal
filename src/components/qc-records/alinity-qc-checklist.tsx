'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  associateAlinityRun,
  attestAlinityCv,
  loadAlinityChecklist,
  reopenAlinityChecklist,
  reviewAlinityChecklist,
  saveAlinityChecklistComment,
  signAlinityChecklist,
  type AlinityChecklistBundle,
} from '@/lib/clinical/alinity-qc-checklist';
import { fetchQCInstruments, reviewQCRecord } from '@/lib/clinical/qc-records';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import { checklistMonthLabel } from '@/lib/qc-records/alinity-checklist/calendar';
import {
  ALINITY_RUN_AGGREGATION,
  buildAlinityChecklist,
  codeFor,
  type RunMark,
  type RoutineRunSlot,
} from '@/lib/qc-records/alinity-checklist/aggregate';
import {
  alinityChecklistInstrumentLabel,
  isAlinityChecklistInstrumentName,
} from '@/lib/qc-records/alinity-checklist/constants';
import { canReviewDailyQC } from '@/lib/qc-records/permissions';
import { composeMonthlyQcReportPdf } from '@/lib/print/form-hema-024-pdf';

function Mark({ mark }: { mark: RunMark }) {
  switch (mark) {
    case 'accept':
      return <span aria-label="Accept">✓</span>;
    case 'reject':
      return <span aria-label="Reject">✕</span>;
    case 'incomplete':
      return <span title="Required results are missing">Inc</span>;
    case 'blank':
      return null;
    default: {
      const unreachable: never = mark;
      return unreachable;
    }
  }
}

async function savePdf(bytes: Uint8Array, filename: string, print: boolean) {
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  if (print) {
    const popup = window.open(url, '_blank');
    popup?.addEventListener('load', () => popup.print());
    return;
  }
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
}

export function AlinityQcChecklist({
  initialInstrumentId,
  initialYear,
  initialMonth,
}: {
  initialInstrumentId?: string;
  initialYear?: number;
  initialMonth?: number;
}) {
  const { can, user } = useAuth();
  const now = new Date();
  const [instruments, setInstruments] = useState<Array<{ id: string; name: string }>>([]);
  const [instrumentId, setInstrumentId] = useState(initialInstrumentId ?? '');
  const [year, setYear] = useState(initialYear ?? now.getFullYear());
  const [month, setMonth] = useState(initialMonth ?? now.getMonth() + 1);
  const [bundle, setBundle] = useState<AlinityChecklistBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [day, setDay] = useState('1');
  const [slot, setSlot] = useState<RoutineRunSlot>('run_1');
  const [batchId, setBatchId] = useState('');
  const [amendment, setAmendment] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchQCInstruments().then((rows) => {
      const alinity = rows.filter((row) => isAlinityChecklistInstrumentName(row.name));
      setInstruments(alinity);
      setInstrumentId((current) => current || initialInstrumentId || alinity[0]?.id || '');
    });
  }, [initialInstrumentId]);

  const load = useCallback(async () => {
    if (!instrumentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await loadAlinityChecklist(instrumentId, year, month);
    setBundle(result.data);
    setComment(result.data?.checklist.comment ?? '');
    setError(result.error);
    setLoading(false);
  }, [instrumentId, month, year]);

  useEffect(() => {
    void load();
  }, [load]);

  const instrumentName = alinityChecklistInstrumentLabel(
    instruments.find((item) => item.id === instrumentId)?.name ?? '',
  ) ?? 'Alinity HQ';
  const built = useMemo(() => {
    if (!bundle) return null;
    return buildAlinityChecklist({
      year,
      month,
      links: bundle.links,
      records: bundle.records,
      attestations: bundle.attestations,
    });
  }, [bundle, month, year]);
  const locked = bundle?.checklist.status === 'finalized';

  const runAction = async (action: () => Promise<string | null>, success: string) => {
    setBusy(true);
    const message = await action();
    setBusy(false);
    if (message) {
      toast.error(message);
      return;
    }
    toast.success(success);
    await load();
  };

  const reviewDay = async () => {
    if (!bundle || !user || !built) return;
    const selected = built.days.find((entry) => entry.day === Number(day));
    const batchIds = [selected?.run1.batchId, selected?.run2.batchId].filter((id): id is string => Boolean(id));
    const pending = bundle.records.filter((record) => (
      record.qcBatchId && batchIds.includes(record.qcBatchId) && record.reviewStatus === 'Pending Review'
    ));
    if (pending.length === 0) {
      toast.error('This day has no pending QC review');
      return;
    }
    setBusy(true);
    const staff = await resolveStaffContext(user);
    for (const record of pending) {
      const result = await reviewQCRecord(record.id, staff, { reviewDecision: 'accept' });
      if (result.error) {
        setBusy(false);
        toast.error(result.error);
        return;
      }
    }
    setBusy(false);
    toast.success('Daily QC review recorded');
    await load();
  };

  const exportReport = async (print: boolean) => {
    if (!bundle || !built) return;
    setBusy(true);
    const bytes = await composeMonthlyQcReportPdf({
      cover: {
        instrumentName,
        year,
        month,
        comment: bundle.checklist.comment,
        checklist: built,
        reviewedBy: {
          fullName: bundle.checklist.reviewedByName,
          staffId: bundle.checklist.reviewedByStaffId,
          signedAt: bundle.checklist.reviewedAt,
        },
        supervisor: {
          fullName: bundle.checklist.supervisorName,
          staffId: bundle.checklist.supervisorStaffId,
          signedAt: bundle.checklist.supervisorAt,
        },
      },
      records: bundle.records,
      instrumentNames: { [instrumentId]: instrumentName },
      reportingPeriod: checklistMonthLabel(year, month),
    });
    setBusy(false);
    await savePdf(bytes, `Form-Hema-024-${instrumentName.replace(/\s+/g, '-')}-${year}-${month}.pdf`, print);
  };

  if (!can('qc.view')) {
    return <p className="text-sm text-muted-foreground">QC permission is required to open Form-Hema-024. Documents access does not include these QC results.</p>;
  }

  return (
    <section className="space-y-4">
      <div id="report" className="flex flex-wrap items-end gap-3">
        <div>
          <Label>Instrument</Label>
          <Select value={instrumentId} onValueChange={setInstrumentId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Instrument" /></SelectTrigger>
            <SelectContent>
              {instruments.map((instrument) => (
                <SelectItem key={instrument.id} value={instrument.id}>
                  {alinityChecklistInstrumentLabel(instrument.name) ?? instrument.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Month</Label>
          <Input type="number" min={1} max={12} value={month} onChange={(event) => setMonth(Number(event.target.value))} className="w-24" />
        </div>
        <div>
          <Label>Year</Label>
          <Input type="number" min={2000} max={2100} value={year} onChange={(event) => setYear(Number(event.target.value))} className="w-28" />
        </div>
        <Button variant="outline" onClick={() => void exportReport(false)} disabled={!built || busy}>Export PDF</Button>
        <Button variant="outline" onClick={() => void exportReport(true)} disabled={!built || busy}>Print</Button>
      </div>
      <div>
        <h2 className="text-lg font-semibold">Form-Hema-024 · {instrumentName}</h2>
        <p className="text-sm text-muted-foreground">{checklistMonthLabel(year, month)} · {bundle?.checklist.status ?? 'loading'} · ✓ Accept · ✕ Reject · blank means not recorded</p>
        <p className="text-sm text-muted-foreground">{ALINITY_RUN_AGGREGATION}</p>
      </div>
      {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {locked ? <p className="text-sm">This checklist is finalized. Later QC edits stay off this report until a supervisor records an amendment.</p> : null}
      {built && (
        <div className="overflow-x-auto border rounded-md">
          <table className="text-xs border-collapse min-w-max">
            <thead>
              <tr>
                <th className="border px-2 py-1 text-start"> </th>
                {built.days.map((entry) => <th key={entry.day} className="border px-1 py-1">{entry.day}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th className="border px-2 py-1 text-start">1st Run QC check</th>
                {built.days.map((entry) => <td key={entry.day} className="border text-center"><Mark mark={entry.run1.mark} /></td>)}
              </tr>
              <tr>
                <th className="border px-2 py-1 text-start">Lab-tech</th>
                {built.days.map((entry) => <td key={entry.day} className="border text-center">{entry.run1.technicians.map((person) => codeFor(built.legend, person)).join(',')}</td>)}
              </tr>
              <tr>
                <th className="border px-2 py-1 text-start">QC correction</th>
                {built.days.map((entry) => <td key={entry.day} className="border text-center">{entry.run1.correction}</td>)}
              </tr>
              <tr>
                <th className="border px-2 py-1 text-start">2nd Run QC check</th>
                {built.days.map((entry) => <td key={entry.day} className="border text-center"><Mark mark={entry.run2.mark} /></td>)}
              </tr>
              <tr>
                <th className="border px-2 py-1 text-start">Lab-tech</th>
                {built.days.map((entry) => <td key={entry.day} className="border text-center">{entry.run2.technicians.map((person) => codeFor(built.legend, person)).join(',')}</td>)}
              </tr>
              <tr>
                <th className="border px-2 py-1 text-start">QC correction</th>
                {built.days.map((entry) => <td key={entry.day} className="border text-center">{entry.run2.correction}</td>)}
              </tr>
              <tr>
                <th className="border px-2 py-1 text-start">QC Check</th>
                {built.days.map((entry) => <td key={entry.day} className="border text-center">{entry.qcCheck ? '✓' : ''}</td>)}
              </tr>
              <tr>
                <th className="border px-2 py-1 text-start">CV Monitoring</th>
                {built.days.map((entry) => <td key={entry.day} className="border text-center">{entry.cvMonitoring ? codeFor(built.legend, entry.cvMonitoring) : ''}</td>)}
              </tr>
              <tr>
                <th className="border px-2 py-1 text-start">Senior</th>
                {built.days.map((entry) => <td key={entry.day} className="border text-center">{entry.seniors.map((person) => codeFor(built.legend, person)).join(',')}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {built && built.legend.length > 0 && (
        <ul className="text-sm">
          {built.legend.map((entry) => <li key={entry.key}>{entry.code} = {entry.fullName} · Staff ID {entry.staffId}</li>)}
        </ul>
      )}
      <div className="grid gap-2 max-w-3xl">
        <Label htmlFor="hema024-comment">Comment if needed</Label>
        <Textarea id="hema024-comment" value={comment} onChange={(event) => setComment(event.target.value)} disabled={locked} />
        <div className="flex flex-wrap gap-2">
          {can('qc.manage') && <Button disabled={locked || busy} onClick={() => bundle && void runAction(() => saveAlinityChecklistComment(bundle.checklist.id, comment), 'Comment saved')}>Save comment</Button>}
          {can('qc.review_monthly') && <Button disabled={locked || busy || !bundle} onClick={() => bundle && void runAction(() => reviewAlinityChecklist(bundle.checklist.id), 'Monthly review recorded')}>Reviewed by</Button>}
          {can('qc.approve') && <Button disabled={busy || bundle?.checklist.status !== 'reviewed'} onClick={() => bundle && void runAction(() => signAlinityChecklist(bundle.checklist.id), 'Supervisor sign-off recorded')}>Supervisor sign-off</Button>}
        </div>
        <p className="text-sm">Reviewed by: {bundle?.checklist.reviewedByName ? `${bundle.checklist.reviewedByName} · Staff ID ${bundle.checklist.reviewedByStaffId ?? 'not recorded'} · ${bundle.checklist.reviewedAt ?? ''}` : 'Not recorded'}</p>
        <p className="text-sm">Supervisor: {bundle?.checklist.supervisorName ? `${bundle.checklist.supervisorName} · Staff ID ${bundle.checklist.supervisorStaffId ?? 'not recorded'} · ${bundle.checklist.supervisorAt ?? ''}` : 'Not recorded'}</p>
      </div>
      {!locked && (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label>Day</Label>
            <Input className="w-20" value={day} onChange={(event) => setDay(event.target.value)} />
          </div>
          <div>
            <Label>Slot</Label>
            <Select value={slot} onValueChange={(value) => setSlot(value as RoutineRunSlot)}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="run_1">Run 1</SelectItem>
                <SelectItem value="run_2">Run 2</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Unassigned run</Label>
            <Select value={batchId} onValueChange={setBatchId}>
              <SelectTrigger className="w-72"><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                {built?.unassigned.filter((run) => run.linkable && run.batchId).map((run) => (
                  <SelectItem key={run.key} value={run.batchId ?? run.key}>
                    {run.recordedAt.slice(0, 16)} · {run.parameterCount} parameters · OUT {run.outCount}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {can('qc.manage') && (
            <Button disabled={busy || !batchId || !bundle} onClick={() => bundle && void runAction(() => associateAlinityRun(bundle.checklist.id, Number(day), slot, batchId), 'Run associated')}>
              Associate run
            </Button>
          )}
          {canReviewDailyQC(can) && <Button disabled={busy} onClick={() => void reviewDay()}>Record daily QC review</Button>}
          {can('cv_monitoring.review') && <Button disabled={busy || !bundle} onClick={() => bundle && void runAction(() => attestAlinityCv(bundle.checklist.id, Number(day)), 'CV monitoring attested')}>Attest CV monitoring</Button>}
        </div>
      )}
      {locked && can('qc.approve') && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="grow">
            <Label>Amendment reason</Label>
            <Input value={amendment} onChange={(event) => setAmendment(event.target.value)} />
          </div>
          <Button disabled={busy || amendment.trim().length < 8} onClick={() => bundle && void runAction(() => reopenAlinityChecklist(bundle.checklist.id, amendment), 'Amendment recorded')}>Record amendment</Button>
        </div>
      )}
      <div id="history">
        <h3 className="font-medium">Checklist history</h3>
        <ul className="text-sm">
          {bundle?.history.map((item) => (
            <li key={item.id}>
              <button type="button" className="underline" onClick={() => { setYear(item.year); setMonth(item.month); }}>
                {checklistMonthLabel(item.year, item.month)} · {item.status}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
