'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale } from 'next-intl';
import { ArrowLeft, CalendarDays, CalendarRange, ClipboardCheck, Loader2 } from 'lucide-react';
import { QCReviewQueue } from '@/components/qc-records/qc-review-queue';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/components/providers/auth-provider';
import {
  fetchInstrumentNameMap,
  fetchQCRecords,
} from '@/lib/clinical/qc-records';
import {
  canAccessQCReviewCenter,
  canReviewDailyQC,
  canReviewMonthlyQC,
} from '@/lib/qc-records/permissions';
import {
  QC_REVIEW_QUEUE_FILTERS,
  QC_REVIEW_QUEUE_FILTER_LABELS,
  filterQCReviewQueueRecords,
  countQCPendingReviewByFrequency,
  type QCReviewQueueFilter,
} from '@/lib/qc-records/review-queue';
import type { QCFrequency } from '@/lib/qc-records/constants';

const FREQUENCIES: QCFrequency[] = ['daily', 'monthly'];

function parseFrequency(value: string | null, canDaily: boolean, canMonthly: boolean): QCFrequency {
  if (value === 'monthly' && canMonthly) return 'monthly';
  if (value === 'daily' && canDaily) return 'daily';
  if (canMonthly) return 'monthly';
  return 'daily';
}

function parseWorkflowFilter(value: string | null): QCReviewQueueFilter {
  if (value && QC_REVIEW_QUEUE_FILTERS.includes(value as QCReviewQueueFilter)) {
    return value as QCReviewQueueFilter;
  }
  return 'pending_review';
}

export default function QCReviewPage() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = useAuth();

  const canDaily = canReviewDailyQC(can);
  const canMonthly = canReviewMonthlyQC(can);
  const canAccess = canAccessQCReviewCenter(can);

  const [records, setRecords] = useState<Awaited<ReturnType<typeof fetchQCRecords>>['data']>([]);
  const [instrumentNames, setInstrumentNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const frequency = parseFrequency(searchParams.get('frequency'), canDaily, canMonthly);
  const workflowFilter = parseWorkflowFilter(searchParams.get('status'));

  const accessDenied = !can('qc.view') || !canAccess;
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);
  if (accessDenied) return null;

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [qcResult, names] = await Promise.all([
      fetchQCRecords(),
      fetchInstrumentNameMap(),
    ]);
    setRecords(qcResult.data);
    setInstrumentNames(names);
    setError(qcResult.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const dailyPendingCount = useMemo(
    () => countQCPendingReviewByFrequency(records, 'daily'),
    [records],
  );
  const monthlyPendingCount = useMemo(
    () => countQCPendingReviewByFrequency(records, 'monthly'),
    [records],
  );

  const dailyRecords = useMemo(
    () => filterQCReviewQueueRecords(records, 'daily', workflowFilter),
    [records, workflowFilter],
  );
  const monthlyRecords = useMemo(
    () => filterQCReviewQueueRecords(records, 'monthly', workflowFilter),
    [records, workflowFilter],
  );

  const updateQuery = (next: { frequency?: QCFrequency; status?: QCReviewQueueFilter }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.frequency) params.set('frequency', next.frequency);
    if (next.status) params.set('status', next.status);
    router.replace(`/${locale}/quality-control/review?${params.toString()}`);
  };

  const visibleTabs = FREQUENCIES.filter((item) => (
    item === 'daily' ? canDaily : canMonthly
  ));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/${locale}/quality-control`}>
            <ArrowLeft className="h-4 w-4 me-2" />
            Quality Control
          </Link>
        </Button>
      </div>

      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">QC Review</h1>
          {canMonthly && monthlyPendingCount > 0 && (
            <Badge variant="warning">
              Monthly Review Pending: {monthlyPendingCount}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Review Daily and Monthly QC records. Supervisor approval remains on the main Quality Control page.
        </p>
      </div>

      {canDaily && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Daily QC Pending Review</p>
                <p className="text-sm text-muted-foreground">
                  {dailyPendingCount} record{dailyPendingCount === 1 ? '' : 's'} waiting for Daily Review
                </p>
              </div>
            </div>
            <Button
              variant={frequency === 'daily' ? 'default' : 'outline'}
              onClick={() => updateQuery({ frequency: 'daily', status: 'pending_review' })}
            >
              Open Daily Review
            </Button>
          </CardContent>
        </Card>
      )}

      {canMonthly && (
        <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                <CalendarRange className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Monthly QC Review</p>
                <p className="text-sm text-muted-foreground">
                  {monthlyPendingCount} Pending · Quality Officer monthly review queue
                </p>
              </div>
            </div>
            <Button
              variant={frequency === 'monthly' ? 'default' : 'outline'}
              onClick={() => updateQuery({ frequency: 'monthly', status: 'pending_review' })}
            >
              Open Monthly Review
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Review Queue
          </CardTitle>
          <div className="w-full sm:w-64">
            <Select
              value={workflowFilter}
              onValueChange={(value) => updateQuery({ frequency, status: value as QCReviewQueueFilter })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {QC_REVIEW_QUEUE_FILTERS.map((filter) => (
                  <SelectItem key={filter} value={filter}>
                    {QC_REVIEW_QUEUE_FILTER_LABELS[filter]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <EmptyState title="Unable to load QC records" description={error} />
          ) : visibleTabs.length === 0 ? (
            <EmptyState title="No review permissions" description="You do not have permission to review QC records." />
          ) : (
            <Tabs
              value={frequency}
              onValueChange={(value) => updateQuery({ frequency: value as QCFrequency, status: workflowFilter })}
            >
              <TabsList>
                {canDaily && (
                  <TabsTrigger value="daily">
                    Daily Review
                    {dailyPendingCount > 0 && (
                      <Badge variant="warning" className="ms-2 px-1.5 py-0 text-xs">
                        {dailyPendingCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                )}
                {canMonthly && (
                  <TabsTrigger value="monthly">
                    Monthly Review
                    {monthlyPendingCount > 0 && (
                      <Badge variant="warning" className="ms-2 px-1.5 py-0 text-xs">
                        {monthlyPendingCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                )}
              </TabsList>

              {canDaily && (
                <TabsContent value="daily" className="mt-4">
                  <QCReviewQueue
                    records={dailyRecords}
                    frequency="daily"
                    workflowFilter={workflowFilter}
                    instrumentNames={instrumentNames}
                    locale={locale}
                    onReviewComplete={loadRecords}
                    canReviewThisFrequency={canDaily}
                  />
                </TabsContent>
              )}

              {canMonthly && (
                <TabsContent value="monthly" className="mt-4">
                  <QCReviewQueue
                    records={monthlyRecords}
                    frequency="monthly"
                    workflowFilter={workflowFilter}
                    instrumentNames={instrumentNames}
                    locale={locale}
                    onReviewComplete={loadRecords}
                    canReviewThisFrequency={canMonthly}
                  />
                </TabsContent>
              )}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
