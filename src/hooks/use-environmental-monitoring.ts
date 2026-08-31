'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadEnvironmentalMonitoringBundle } from '@/lib/clinical/environmental-monitoring';
import type {
  EnvironmentalAsset,
  EnvironmentalAuditEvent,
  EnvironmentalExcursion,
  EnvironmentalMonitoringWindow,
  EnvironmentalReading,
  EnvironmentalReadingCorrection,
} from '@/types/environmental-monitoring';

export function useEnvironmentalMonitoring(since?: string) {
  const [assets, setAssets] = useState<EnvironmentalAsset[]>([]);
  const [windows, setWindows] = useState<EnvironmentalMonitoringWindow[]>([]);
  const [readings, setReadings] = useState<EnvironmentalReading[]>([]);
  const [excursions, setExcursions] = useState<EnvironmentalExcursion[]>([]);
  const [corrections, setCorrections] = useState<EnvironmentalReadingCorrection[]>([]);
  const [auditEvents, setAuditEvents] = useState<EnvironmentalAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const bundle = await loadEnvironmentalMonitoringBundle(since);
    setAssets(bundle.assets);
    setWindows(bundle.windows);
    setReadings(bundle.readings);
    setExcursions(bundle.excursions);
    setCorrections(bundle.corrections);
    setAuditEvents(bundle.auditEvents);
    setError(bundle.error);
    setLoading(false);
  }, [since]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    assets,
    windows,
    readings,
    excursions,
    corrections,
    auditEvents,
    loading,
    error,
    reload,
  };
}
