'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { Loader2, RefreshCw, Wifi, WifiOff, FlaskConical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { StatCard } from '@/components/shared/stat-card';
import { computeQCSummary } from '@/lib/clinical/qc-records';
import {
  computeLiveOverallStatus,
  type QCLiveOverallStatus,
} from '@/lib/qc-records/live-status';
import {
  fetchQCLiveView,
  getLastNDaysRange,
  getTodayDateRange,
  logQCLiveAccess,
  type QCLiveFetchFilters,
} from '@/lib/qc-records/live-view';
import {
  deriveResolutionDisplay,
  formatCorrectiveActionsSummary,
} from '@/lib/qc-records/schema';
import { getParametersForInstrument, getLevelsForParameter } from '@/lib/qc-records/config';
import { statusBadgeVariant } from '@/lib/page-utils';
import { formatDateTime } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { hasSupabaseConfig } from '@/lib/security/env';
import type { QCLiveRecord } from '@/types';
import { QCLiveFilters } from './qc-live-filters';
import { cn } from '@/lib/utils';

const REFRESH_INTERVAL_MS = 45_000;

type PeriodPreset = 'today' | '7days' | '30days' | 'custom';

interface LiveQCViewProps {
  slug: string;
}

function statusBannerClass(status: QCLiveOverallStatus): string {
  switch (status) {
    case 'ATTENTION — UNRESOLVED OUT QC':
      return 'bg-red-600 text-white border-red-700';
    case 'QC STATUS — IN':
      return 'bg-emerald-600 text-white border-emerald-700';
    default:
      return 'bg-amber-500 text-white border-amber-600';
  }
}

function RecordCard({ record, locale }: { record: QCLiveRecord; locale: string }) {
  const resolution = deriveResolutionDisplay(record.qcStatus, record.resolutionStatus);

  return (
    <Card className="md:hidden">
      <CardContent className="pt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{formatDateTime(record.recordedAt, locale)}</span>
          <Badge variant={statusBadgeVariant(record.qcStatus)}>{record.qcStatus}</Badge>
        </div>
        <div><span className="text-muted-foreground">Parameter:</span> {record.parameter}</div>
        <div><span className="text-muted-foreground">Level:</span> {record.level || '—'}</div>
        {record.qcStatus === 'OUT' && (
          <>
            <div>
              <span className="text-muted-foreground">Corrective Action:</span>{' '}
              {formatCorrectiveActionsSummary(record.correctiveActions)}
            </div>
            {resolution !== 'N/A' && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Resolution:</span>
                <Badge variant={statusBadgeVariant(resolution)}>{resolution}</Badge>
              </div>
            )}
            {record.correctiveActionComment && (
              <div><span className="text-muted-foreground">Comment:</span> {record.correctiveActionComment}</div>
            )}
            {record.resolvedAt && (
              <div><span className="text-muted-foreground">Resolved At:</span> {formatDateTime(record.resolvedAt, locale)}</div>
            )}
          </>
        )}
        <div><span className="text-muted-foreground">Performed By:</span> {record.performedByName ?? '—'}</div>
      </CardContent>
    </Card>
  );
}

export function LiveQCView({ slug }: LiveQCViewProps) {
  const locale = useLocale();
  const [records, setRecords] = useState<QCLiveRecord[]>([]);
  const [instrumentName, setInstrumentName] = useState<string>('');
  const [instrumentId, setInstrumentId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const [period, setPeriod] = useState<PeriodPreset>('today');
  const [filters, setFilters] = useState<QCLiveFetchFilters>(() => getTodayDateRange());

  const activeFilters = useMemo((): QCLiveFetchFilters => ({
    ...filters,
    parameter: filters.parameter ?? 'all',
    level: filters.level ?? 'all',
    qcStatus: filters.qcStatus ?? 'all',
    resolution: filters.resolution ?? 'all',
  }), [filters]);

  const loadData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    setError(null);

    const result = await fetchQCLiveView(slug, activeFilters);

    if (!result.instrument) {
      setError('Instrument not found');
      setRecords([]);
      setInstrumentName('');
    } else {
      setInstrumentName(result.instrument.instrumentName);
      setInstrumentId(result.instrument.instrumentId);
      setRecords(result.records);
      if (result.error) setError(result.error);
      void logQCLiveAccess(slug, result.instrument.instrumentId);
    }

    setLastFetchedAt(new Date());
    setLoading(false);
    setRefreshing(false);
  }, [slug, activeFilters]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => void loadData(false), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    if (!hasSupabaseConfig() || !instrumentId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`qc-live-${slug}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'qc_live_view',
          filter: `instrument_id=eq.${instrumentId}`,
        },
        () => {
          void loadData(false);
        },
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      void supabase.removeChannel(channel);
      setRealtimeConnected(false);
    };
  }, [slug, instrumentId, loadData]);

  const handlePeriodChange = (preset: PeriodPreset) => {
    setPeriod(preset);
    if (preset === 'today') setFilters((f) => ({ ...f, ...getTodayDateRange() }));
    else if (preset === '7days') setFilters((f) => ({ ...f, ...getLastNDaysRange(7) }));
    else if (preset === '30days') setFilters((f) => ({ ...f, ...getLastNDaysRange(30) }));
  };

  const parameterOptions = useMemo(
    () => (instrumentName ? getParametersForInstrument(instrumentName).map((p) => p.name) : []),
    [instrumentName],
  );

  const levelOptions = useMemo(() => {
    if (!instrumentName || !filters.parameter || filters.parameter === 'all') return [];
    return [...getLevelsForParameter(instrumentName, filters.parameter)];
  }, [instrumentName, filters.parameter]);

  const summary = useMemo(() => computeQCSummary(records), [records]);
  const statusInfo = useMemo(() => computeLiveOverallStatus(records), [records]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Hematology QC Live View
              </p>
              <h1 className="text-2xl font-bold sm:text-3xl">{instrumentName || slug}</h1>
              <p className="text-sm text-muted-foreground mt-1">Read-only · No login required</p>
            </div>
            <div className="flex items-center gap-2">
              {realtimeConnected ? (
                <span className="flex items-center gap-1 text-xs text-emerald-600"><Wifi className="h-3.5 w-3.5" /> Live</span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><WifiOff className="h-3.5 w-3.5" /> Auto-refresh</span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadData(false)}
                disabled={refreshing}
              >
                <RefreshCw className={cn('h-4 w-4 me-1', refreshing && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin me-2" />
            Loading QC data…
          </div>
        ) : error === 'Instrument not found' ? (
          <EmptyState title="Instrument not found" description="This live QC link is invalid or the instrument is unavailable." />
        ) : (
          <>
            <div
              className={cn(
                'rounded-xl border-2 px-6 py-5 text-center shadow-sm',
                statusBannerClass(statusInfo.status),
              )}
            >
              <p className="text-lg font-bold sm:text-2xl">{statusInfo.status}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-4 text-sm opacity-90">
                {statusInfo.lastQcRun && (
                  <span>Last QC Run: {formatDateTime(statusInfo.lastQcRun, locale)}</span>
                )}
                {statusInfo.lastUpdated && (
                  <span>Last Updated: {formatDateTime(statusInfo.lastUpdated, locale)}</span>
                )}
                <span>Unresolved OUT: {statusInfo.unresolvedOut}</span>
              </div>
            </div>

            {error && error !== 'Instrument not found' && (
              <EmptyState title="Unable to load QC records" description={error} />
            )}

            {!error && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard title="QC Runs" value={summary.qcRuns} icon={FlaskConical} />
                <StatCard title="Parameter Results" value={summary.parameterResults} icon={FlaskConical} />
                <StatCard title="IN" value={summary.inCount} icon={FlaskConical} iconClassName="bg-emerald-100 text-emerald-700" />
                <StatCard title="OUT" value={summary.outCount} icon={FlaskConical} iconClassName="bg-red-100 text-red-700" />
                <StatCard title="Unresolved OUT" value={summary.unresolvedOut} icon={FlaskConical} iconClassName="bg-amber-100 text-amber-700" />
                <StatCard title="OUT %" value={`${summary.outPercent}%`} icon={FlaskConical} />
              </div>
            )}

            <QCLiveFilters
              period={period}
              onPeriodChange={handlePeriodChange}
              filters={filters}
              onFiltersChange={setFilters}
              parameterOptions={parameterOptions}
              levelOptions={levelOptions}
            />

            {lastFetchedAt && (
              <p className="text-xs text-muted-foreground text-end">
                Last updated: {formatDateTime(lastFetchedAt.toISOString(), locale)}
              </p>
            )}

            {!error && records.length === 0 && (
              <EmptyState
                title="No QC records available"
                description="No records match the selected filters for this instrument."
              />
            )}

            {!error && records.length > 0 && (
              <>
                <div className="hidden md:block overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        {['Date/Time', 'Parameter', 'Level', 'QC Status', 'Corrective Action', 'Resolution Status', 'Performed By', 'Corrective Action Comment', 'Resolved At'].map((h) => (
                          <th key={h} className="px-3 py-2 text-start font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record) => {
                        const resolution = deriveResolutionDisplay(record.qcStatus, record.resolutionStatus);
                        return (
                          <tr key={record.id} className="border-t hover:bg-muted/30">
                            <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(record.recordedAt, locale)}</td>
                            <td className="px-3 py-2">{record.parameter}</td>
                            <td className="px-3 py-2">{record.level || '—'}</td>
                            <td className="px-3 py-2">
                              <Badge variant={statusBadgeVariant(record.qcStatus)}>{record.qcStatus}</Badge>
                            </td>
                            <td className="px-3 py-2 max-w-xs">
                              {record.qcStatus === 'OUT'
                                ? formatCorrectiveActionsSummary(record.correctiveActions)
                                : '—'}
                            </td>
                            <td className="px-3 py-2">
                              {resolution === 'N/A' ? '—' : (
                                <Badge variant={statusBadgeVariant(resolution)}>{resolution}</Badge>
                              )}
                            </td>
                            <td className="px-3 py-2">{record.performedByName ?? '—'}</td>
                            <td className="px-3 py-2 max-w-xs">{record.correctiveActionComment ?? '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {record.resolvedAt ? formatDateTime(record.resolvedAt, locale) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden space-y-3">
                  {records.map((record) => (
                    <RecordCard key={record.id} record={record} locale={locale} />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">About this view</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p>This page is read-only. QC data refreshes automatically every 45 seconds.</p>
            <p>No patient or private employee data is displayed. Original OUT records remain visible after resolution.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
