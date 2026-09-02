'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, Download, ExternalLink, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';
import { QcCorrectiveEntryForm } from '@/components/qc-corrective-actions/qc-corrective-entry-form';
import {
  QcCorrectiveActionStatusBadge,
  QcCorrectiveMonthlyStatusBadge,
  RepeatedFailureBadge,
} from '@/components/qc-corrective-actions/qc-corrective-status-badges';
import { DataTable } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { useRouteReplace } from '@/hooks/use-route-replace';
import {
  approveMonthlyCorrectiveAction,
  createMonthlyCorrectiveAmendment,
  fetchAlinityHqInstruments,
  fetchMonthlyCorrectiveReview,
  fetchQcCorrectiveAuditEvents,
  fetchQcCorrectiveWorklist,
  logForm016Exported,
  logForm016Printed,
  markMonthlyCorrectiveReadyForReview,
  returnMonthlyCorrectiveAction,
  reviewMonthlyCorrectiveAction,
  summarizeCorrectiveWorklist,
} from '@/lib/clinical/qc-corrective-actions';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import { monthName, QC_CORRECTIVE_ACTION_STATUS_LABELS } from '@/lib/qc-corrective-actions/constants';
import { downloadQcCorrectiveExcel } from '@/lib/qc-corrective-actions/excel-export';
import {
  canApproveMonthlyCorrectiveAction,
  canExportQcCorrectiveForm,
  canPrepareMonthlyCorrectiveAction,
  canReviewMonthlyCorrectiveAction,
  canViewQcCorrectiveActions,
} from '@/lib/qc-corrective-actions/permissions';
import { createQcForm016Pdf } from '@/lib/print/qc-form-016-pdf';
import {
  CONTROLLED_FORM_EXPORT_EXCEL_LABEL,
  CONTROLLED_FORM_PRINT_LABEL,
} from '@/lib/print/controlled-form';
import { formatDateTime } from '@/lib/utils';
import type { QcCorrectiveMonthlyReview, QcCorrectiveWorklistItem } from '@/types/qc-corrective-action';

function currentMonthYear() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export default function QcCorrectiveActionsPage() {
  const locale = useLocale();
  const { can, user } = useAuth();
  const accessDenied = !canViewQcCorrectiveActions(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  const initial = currentMonthYear();
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<QcCorrectiveWorklistItem[]>([]);
  const [instruments, setInstruments] = useState<{ id: string; name: string }[]>([]);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string>('all');
  const [printInstrumentId, setPrintInstrumentId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [analyte, setAnalyte] = useState('all');
  const [qcLevel, setQCLevel] = useState('all');
  const [originalStatus, setOriginalStatus] = useState('all');
  const [actionStatus, setActionStatus] = useState('all');
  const [selectedItem, setSelectedItem] = useState<QcCorrectiveWorklistItem | null>(null);
  const [monthlyReview, setMonthlyReview] = useState<QcCorrectiveMonthlyReview | null>(null);
  const [returnComment, setReturnComment] = useState('');
  const [amendmentReason, setAmendmentReason] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await fetchQcCorrectiveWorklist({
      year,
      month,
      instrumentId: selectedInstrumentId === 'all' ? undefined : selectedInstrumentId,
      analyte: analyte === 'all' ? undefined : analyte,
      qcLevel: qcLevel === 'all' ? undefined : qcLevel,
      originalQcStatus: originalStatus === 'all' ? undefined : originalStatus,
      actionStatus: actionStatus === 'all' ? undefined : actionStatus,
      search,
    });
    setItems(result.data);
    if (result.error) toast.error(result.error);

    const alinity = await fetchAlinityHqInstruments();
    setInstruments(alinity.data);
    if (!printInstrumentId && alinity.data[0]) setPrintInstrumentId(alinity.data[0].id);

    const instrumentForReview = selectedInstrumentId !== 'all'
      ? selectedInstrumentId
      : alinity.data[0]?.id;
    if (instrumentForReview) {
      const review = await fetchMonthlyCorrectiveReview(year, month, instrumentForReview);
      setMonthlyReview(review.data);
    } else {
      setMonthlyReview(null);
    }

    setLoading(false);
  }, [year, month, selectedInstrumentId, analyte, qcLevel, originalStatus, actionStatus, search, printInstrumentId]);

  useEffect(() => { void reload(); }, [reload]);

  const summary = useMemo(() => summarizeCorrectiveWorklist(items), [items]);
  const alinityItems = useMemo(() => items.filter((item) => item.isAlinityHq), [items]);
  const printItems = useMemo(() => {
    if (!printInstrumentId) return [];
    return alinityItems.filter((item) => item.instrumentId === printInstrumentId);
  }, [alinityItems, printInstrumentId]);

  const analytes = useMemo(() => [...new Set(items.map((item) => item.analyte))].sort(), [items]);
  const levels = useMemo(() => [...new Set(items.map((item) => item.qcLevel))].sort(), [items]);

  function shiftMonth(delta: number) {
    const date = new Date(year, month - 1 + delta, 1);
    setYear(date.getFullYear());
    setMonth(date.getMonth() + 1);
  }

  async function handlePrint() {
    if (!user) return;
    if (!printInstrumentId || printItems.length === 0) {
      toast.error('No Alinity HQ corrective actions for the selected analyzer and month.');
      return;
    }
    const instrumentName = instruments.find((i) => i.id === printInstrumentId)?.name ?? 'Alinity HQ';
    const review = await fetchMonthlyCorrectiveReview(year, month, printInstrumentId);
    const blob = await createQcForm016Pdf({
      year,
      month,
      instrumentName,
      qcMaterialLabel: '',
      rows: printItems,
      monthlyReview: review.data,
    });
    const staff = await resolveStaffContext(user);
    if (staff) {
      await logForm016Printed(staff, { year, month, instrumentId: printInstrumentId, monthlyReviewId: review.data?.id });
    }
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  async function handleExportExcel() {
    if (!user) return;
    const audit = await fetchQcCorrectiveAuditEvents({ year, month });
    downloadQcCorrectiveExcel(
      items,
      summary,
      audit.data,
      `Form-Hema-016-${year}-${String(month).padStart(2, '0')}.xls`,
    );
    const staff = await resolveStaffContext(user);
    if (staff && printInstrumentId) {
      await logForm016Exported(staff, { year, month, instrumentId: printInstrumentId, format: 'excel' });
    }
    toast.success('Excel exported');
  }

  async function runMonthlyAction(action: 'ready' | 'review' | 'approve' | 'return' | 'amend') {
    if (!user) return;
    const staff = await resolveStaffContext(user);
    const instrumentId = selectedInstrumentId !== 'all' ? selectedInstrumentId : printInstrumentId;
    if (!instrumentId) {
      toast.error('Select an analyzer for monthly workflow.');
      return;
    }
    const scopedItems = items.filter((item) => item.instrumentId === instrumentId);

    if (action === 'ready') {
      const result = await markMonthlyCorrectiveReadyForReview(staff, year, month, instrumentId, scopedItems);
      if (result.error) toast.error(result.error);
      else toast.success('Month marked ready for review');
    }
    if (action === 'review') {
      const review = await fetchMonthlyCorrectiveReview(year, month, instrumentId);
      if (!review.data) return;
      const result = await reviewMonthlyCorrectiveAction(staff, review.data.id);
      if (result.error) toast.error(result.error);
      else toast.success('Monthly report reviewed');
    }
    if (action === 'approve') {
      const review = await fetchMonthlyCorrectiveReview(year, month, instrumentId);
      if (!review.data) return;
      const result = await approveMonthlyCorrectiveAction(staff, review.data.id, scopedItems);
      if (result.error) toast.error(result.error);
      else toast.success('Monthly Form-Hema-016 approved');
    }
    if (action === 'return') {
      const review = await fetchMonthlyCorrectiveReview(year, month, instrumentId);
      if (!review.data) return;
      const result = await returnMonthlyCorrectiveAction(staff, review.data.id, returnComment);
      if (result.error) toast.error(result.error);
      else toast.success('Monthly report returned');
    }
    if (action === 'amend') {
      const result = await createMonthlyCorrectiveAmendment(staff, year, month, instrumentId, amendmentReason);
      if (result.error) toast.error(result.error);
      else toast.success('Amendment created');
    }
    void reload();
  }

  const columns: ColumnDef<QcCorrectiveWorklistItem>[] = [
    {
      id: 'date',
      header: 'Date',
      cell: ({ row }) => formatDateTime(row.original.recordedAt, locale),
    },
    { id: 'analyzer', header: 'Analyzer', cell: ({ row }) => row.original.instrumentName },
    { id: 'material', header: 'QC Material', cell: ({ row }) => row.original.qcMaterial },
    {
      id: 'analyte',
      header: 'Analyte',
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1">
          <span>{row.original.analyte}</span>
          <RepeatedFailureBadge count={row.original.repeatedFailureCount} />
        </div>
      ),
    },
    { id: 'level', header: 'QC Level', cell: ({ row }) => row.original.qcLevel },
    { id: 'failed', header: 'Failed Value', cell: ({ row }) => row.original.failedValue },
    { id: 'corrected', header: 'Corrected Value', cell: ({ row }) => row.original.correctedValue ?? '—' },
    {
      id: 'action',
      header: 'Corrective Action',
      cell: ({ row }) => row.original.correctiveActionCode ?? '—',
    },
    {
      id: 'operator',
      header: 'Operator',
      cell: ({ row }) => row.original.operatorName ?? '—',
    },
    {
      id: 'caStatus',
      header: 'Corrective Action Status',
      cell: ({ row }) => <QcCorrectiveActionStatusBadge status={row.original.actionStatus} />,
    },
    {
      id: 'review',
      header: 'Review Status',
      cell: ({ row }) => <QcCorrectiveMonthlyStatusBadge status={row.original.monthlyReviewStatus} />,
    },
    {
      id: 'approval',
      header: 'Approval Status',
      cell: ({ row }) => (
        row.original.monthlyReviewStatus === 'approved'
          ? <Badge variant="success">Approved</Badge>
          : <Badge variant="secondary">Pending Approval</Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" onClick={() => setSelectedItem(row.original)}>Enter</Button>
          <Button size="sm" variant="ghost" asChild>
            <Link href={`/${locale}/quality-control?highlight=${row.original.qcRecordId}`}>
              <ExternalLink className="h-4 w-4" />
              <span className="sr-only">View Original QC</span>
            </Link>
          </Button>
        </div>
      ),
    },
  ];

  const instrumentIdForWorkflow = selectedInstrumentId !== 'all' ? selectedInstrumentId : printInstrumentId;
  const scopedItems = instrumentIdForWorkflow
    ? items.filter((item) => item.instrumentId === instrumentIdForWorkflow)
    : items;

  return (
    <PageContentSections pageKey="dashboard" fallbackTitle="QC Corrective Actions" fallbackSubtitle="Form-Hema-016 ALINITY-HQ">
      <div className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">QC Corrective Actions</h1>
            <p className="text-muted-foreground">Form-Hema-016 — auto-pulled QC OUT worklist with monthly consolidated review</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => shiftMonth(-1)}><ChevronLeft className="h-4 w-4" /> Previous</Button>
            <Badge variant="default">{monthName(month)} {year}</Badge>
            <Button variant="outline" size="sm" onClick={() => shiftMonth(1)}>Next <ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          {[
            ['QC OUT', summary.totalQcOut],
            ['Required', summary.correctiveActionsRequired],
            ['Completed', summary.completed],
            ['Pending Review', summary.pendingReview],
            ['Pending Approval', summary.pendingApproval],
            ['Approved', summary.approved],
            ['Service Calls', summary.serviceCallCount],
            ['Recalibrations', summary.recalibrationCount],
          ].map(([title, value]) => (
            <Card key={title}>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">{title}</p>
                <p className="text-2xl font-bold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {summary.incompleteCount > 0 && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="pt-4 text-sm">
              <strong>{summary.incompleteCount} QC OUT record{summary.incompleteCount === 1 ? '' : 's'}</strong> missing corrective-action information for {monthName(month)} {year}.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="space-y-1"><Label>Search</Label><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Analyzer, analyte, lot…" /></div>
            <div className="space-y-1">
              <Label>Analyzer</Label>
              <Select value={selectedInstrumentId} onValueChange={setSelectedInstrumentId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All analyzers</SelectItem>
                  {instruments.map((inst) => <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Analyte</Label>
              <Select value={analyte} onValueChange={setAnalyte}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {analytes.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>QC Level</Label>
              <Select value={qcLevel} onValueChange={setQCLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {levels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Original QC Status</Label>
              <Select value={originalStatus} onValueChange={setOriginalStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="OUT">OUT</SelectItem>
                  <SelectItem value="Not Acceptable">Not Acceptable</SelectItem>
                  <SelectItem value="Need Follow Up">Need Follow Up</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Corrective Action Status</Label>
              <Select value={actionStatus} onValueChange={setActionStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {Object.entries(QC_CORRECTIVE_ACTION_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base">Monthly Form-Hema-016 (Alinity HQ)</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Select value={printInstrumentId} onValueChange={setPrintInstrumentId}>
                <SelectTrigger className="w-[220px]"><SelectValue placeholder="Analyzer for print" /></SelectTrigger>
                <SelectContent>
                  {instruments.map((inst) => <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {canExportQcCorrectiveForm(can) && (
                <>
                  <Button variant="outline" size="sm" onClick={() => void handlePrint()}><Printer className="h-4 w-4 mr-1" /> {CONTROLLED_FORM_PRINT_LABEL}</Button>
                  <Button variant="outline" size="sm" onClick={() => void handleExportExcel()}><Download className="h-4 w-4 mr-1" /> {CONTROLLED_FORM_EXPORT_EXCEL_LABEL}</Button>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {monthlyReview?.status === 'approved' && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                An approved Form-Hema-016 already exists for this period. Late entries require a controlled amendment.
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {canPrepareMonthlyCorrectiveAction(can, monthlyReview ?? undefined, scopedItems) && (
                <Button size="sm" onClick={() => void runMonthlyAction('ready')}>Mark Ready for Review</Button>
              )}
              {canReviewMonthlyCorrectiveAction(can, monthlyReview ?? undefined, scopedItems, user?.id) && (
                <Button size="sm" variant="secondary" onClick={() => void runMonthlyAction('review')}>Review Month</Button>
              )}
              {canApproveMonthlyCorrectiveAction(can, monthlyReview ?? undefined, scopedItems, user?.id) && (
                <Button size="sm" onClick={() => void runMonthlyAction('approve')}>Approve Month</Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Return comment</Label>
                <Textarea value={returnComment} onChange={(e) => setReturnComment(e.target.value)} />
                <Button size="sm" variant="outline" onClick={() => void runMonthlyAction('return')}>Return</Button>
              </div>
              <div className="space-y-1">
                <Label>Amendment reason</Label>
                <Textarea value={amendmentReason} onChange={(e) => setAmendmentReason(e.target.value)} />
                <Button size="sm" variant="outline" onClick={() => void runMonthlyAction('amend')}>Create Amendment</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="hidden md:block">
              <DataTable columns={columns} data={items} />
            </div>
            <div className="md:hidden space-y-3">
              {items.map((item) => (
                <Card key={item.qcRecordId}>
                  <CardContent className="pt-4 space-y-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <strong>{item.analyte} · {item.qcLevel}</strong>
                      <QcCorrectiveActionStatusBadge status={item.actionStatus} />
                    </div>
                    <div>{formatDateTime(item.recordedAt, locale)} · {item.instrumentName}</div>
                    <div>Failed: {item.failedValue} → Corrected: {item.correctedValue ?? '—'}</div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setSelectedItem(item)}>Enter</Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/${locale}/quality-control?highlight=${item.qcRecordId}`}>View QC</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Corrective Action Entry</DialogTitle></DialogHeader>
            {selectedItem && (
              <QcCorrectiveEntryForm
                item={selectedItem}
                locale={locale}
                onSaved={() => { setSelectedItem(null); void reload(); }}
                onCancel={() => setSelectedItem(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PageContentSections>
  );
}
