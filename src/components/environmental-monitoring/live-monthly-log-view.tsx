'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { ChevronLeft, ChevronRight, Download, Loader2, Printer, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { LiveCellDetailSheet } from '@/components/environmental-monitoring/live-cell-detail-sheet';
import { LiveMonthlyGrid } from '@/components/environmental-monitoring/live-monthly-grid';
import {
  buildLiveMonthlyLogFromPayload,
  canNavigateToNextMonth,
  shiftMonth,
  type LiveMonthlyCellDetail,
  type LiveMonthlyLogModel,
} from '@/lib/environmental-monitoring/live-monthly-log';
import {
  fetchEnvLiveMonthlyLog,
  logEnvLiveAccess,
} from '@/lib/environmental-monitoring/live-view';
import { createEnvironmentalMonthlyReportPdf } from '@/lib/print/env-monitoring-report';
import { CONTROLLED_FORM_EXPORT_PDF_LABEL, CONTROLLED_FORM_PRINT_LABEL } from '@/lib/print/controlled-form';
import '@/styles/qc-print.css';

const REFRESH_INTERVAL_MS = 45_000;

interface LiveMonthlyLogViewProps {
  assetCode: string;
}

export function LiveMonthlyLogView({ assetCode }: LiveMonthlyLogViewProps) {
  const locale = useLocale();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [model, setModel] = useState<LiveMonthlyLogModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ cell: LiveMonthlyCellDetail; day: number } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [printMode, setPrintMode] = useState(false);

  const monthLabel = useMemo(
    () => new Date(year, month - 1, 1).toLocaleString(locale, { month: 'long', year: 'numeric' }),
    [year, month, locale],
  );

  const loadData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    setError(null);

    const result = await fetchEnvLiveMonthlyLog(assetCode, year, month);
    if (result.error || !result.data) {
      setError(result.error ?? 'Unable to load live monthly log.');
      setModel(null);
    } else {
      setModel(buildLiveMonthlyLogFromPayload(result.data));
      void logEnvLiveAccess(assetCode, year, month);
    }

    setLastRefreshedAt(new Date());
    setLoading(false);
    setRefreshing(false);
  }, [assetCode, year, month]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadData(false);
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadData]);

  const goToPreviousMonth = () => {
    const next = shiftMonth(year, month, -1);
    setYear(next.year);
    setMonth(next.month);
  };

  const goToNextMonth = () => {
    if (!canNavigateToNextMonth(year, month)) return;
    const next = shiftMonth(year, month, 1);
    setYear(next.year);
    setMonth(next.month);
  };

  const goToCurrentMonth = () => {
    const current = new Date();
    setYear(current.getFullYear());
    setMonth(current.getMonth() + 1);
  };

  const exportPdf = async () => {
    if (!model) return;
    const doc = await createEnvironmentalMonthlyReportPdf({
      asset: model.asset,
      windows: model.windows,
      readings: model.allReadings,
      excursions: model.excursions,
      corrections: model.corrections,
      month,
      year,
      locale,
    });
    if (!doc) {
      toast.error('Unable to generate PDF');
      return;
    }
    doc.save(`live-${assetCode}-${year}-${String(month).padStart(2, '0')}.pdf`);
  };

  const handleCellClick = (cell: LiveMonthlyCellDetail, day: number) => {
    setSelectedCell({ cell, day });
    setDetailOpen(true);
  };

  if (loading && !model) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !model) {
    return <EmptyState title="Live Monthly Log unavailable" description={error ?? 'Asset not found.'} />;
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div className={printMode ? 'print-area' : 'space-y-4 pb-8'}>
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Live Monthly Monitoring Log</p>
          <h1 className="text-2xl font-bold">{model.asset.assetName}</h1>
          <p className="text-sm text-muted-foreground">{model.asset.assetCode} · {model.asset.location ?? '—'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadData(false)} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 me-1 ${refreshing ? 'animate-spin' : ''}`} />Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setPrintMode(true); window.print(); setPrintMode(false); }}>
            <Printer className="h-4 w-4 me-1" />{CONTROLLED_FORM_PRINT_LABEL}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void exportPdf()}>
            <Download className="h-4 w-4 me-1" />{CONTROLLED_FORM_EXPORT_PDF_LABEL}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">{model.templateTitle ?? 'Environmental Monitoring Monthly Log'}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {model.templateFormNumber ?? ''}{model.templateQid ? ` · ${model.templateQid}` : ''} · {monthLabel}
              </p>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <Button variant="outline" size="icon" onClick={goToPreviousMonth} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {!isCurrentMonth && (
                <Button variant="outline" size="sm" onClick={goToCurrentMonth}>Current Month</Button>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={goToNextMonth}
                disabled={!canNavigateToNextMonth(year, month)}
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <p><span className="text-muted-foreground">Acceptable Temperature:</span> {model.temperatureRangeLabel}</p>
            {model.humidityRangeLabel && (
              <p><span className="text-muted-foreground">Acceptable Humidity:</span> {model.humidityRangeLabel}</p>
            )}
            <p className="print:hidden lg:col-span-2 text-muted-foreground">
              Last refreshed: {lastRefreshedAt ? lastRefreshedAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '—'}
              <Badge variant="outline" className="ms-2">Read-only</Badge>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 text-sm">
            <div><p className="text-muted-foreground">Monthly Compliance</p><p className="text-lg font-semibold">{model.summary.compliancePercent}%</p></div>
            <div><p className="text-muted-foreground">Completed</p><p className="text-lg font-semibold">{model.summary.completedReadings}</p></div>
            <div><p className="text-muted-foreground">Missing</p><p className="text-lg font-semibold text-orange-700">{model.summary.missingReadings}</p></div>
            <div><p className="text-muted-foreground">Out of Range</p><p className="text-lg font-semibold text-destructive">{model.summary.outOfRangeReadings}</p></div>
            <div><p className="text-muted-foreground">Excursions</p><p className="text-lg font-semibold">{model.summary.excursionsThisMonth}</p></div>
            <div><p className="text-muted-foreground">Open Excursions</p><p className="text-lg font-semibold text-amber-700">{model.summary.openExcursions}</p></div>
          </div>

          <LiveMonthlyGrid
            grid={model.grid}
            month={month}
            year={year}
            showHumidity={model.showHumidity}
            onCellClick={handleCellClick}
          />

          <p className="text-xs text-muted-foreground print:hidden">
            Tap a status cell for read-only reading details. This page does not allow recording or editing.
          </p>
        </CardContent>
      </Card>

      <LiveCellDetailSheet
        cell={selectedCell?.cell ?? null}
        day={selectedCell?.day}
        locale={locale}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
