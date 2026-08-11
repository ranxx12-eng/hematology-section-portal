import { createClient } from '@/lib/supabase/client';
import { hasSupabaseConfig } from '@/lib/security/env';
import type { QCLiveRecord } from '@/types';

interface QCLiveRecordRow {
  id: string;
  instrument_id: string;
  instrument_name: string;
  live_view_slug: string;
  parameter: string;
  level: string;
  qc_status: QCLiveRecord['qcStatus'];
  corrective_actions: string[];
  corrective_action_comment: string | null;
  resolution_status: QCLiveRecord['resolutionStatus'] | null;
  recorded_at: string;
  performed_by_name: string | null;
  resolved_at: string | null;
  qc_batch_id: string | null;
  updated_at: string;
}

function mapLiveRecord(row: QCLiveRecordRow): QCLiveRecord {
  return {
    id: row.id,
    instrumentId: row.instrument_id,
    instrumentName: row.instrument_name,
    liveViewSlug: row.live_view_slug,
    parameter: row.parameter,
    level: row.level,
    recordedAt: row.recorded_at,
    qcStatus: row.qc_status,
    correctiveActions: row.corrective_actions ?? [],
    correctiveActionComment: row.corrective_action_comment ?? undefined,
    resolutionStatus: row.resolution_status ?? undefined,
    performedByName: row.performed_by_name ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    qcBatchId: row.qc_batch_id ?? undefined,
    updatedAt: row.updated_at,
  };
}

export interface QCLiveInstrument {
  instrumentId: string;
  instrumentName: string;
  liveViewSlug: string;
}

export interface QCLiveFetchFilters {
  dateFrom?: string;
  dateTo?: string;
  parameter?: string;
  level?: string;
  qcStatus?: string;
  resolution?: string;
}

export interface QCLiveFetchResult {
  instrument: QCLiveInstrument | null;
  records: QCLiveRecord[];
  error: string | null;
}

export async function fetchQCLiveInstrument(slug: string): Promise<QCLiveInstrument | null> {
  if (!hasSupabaseConfig()) return null;

  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_qc_live_instrument', {
    p_instrument_slug: slug,
  });

  if (error || !data?.length) return null;

  const row = data[0] as { instrument_id: string; instrument_name: string; live_view_slug: string };
  return {
    instrumentId: row.instrument_id,
    instrumentName: row.instrument_name,
    liveViewSlug: row.live_view_slug,
  };
}

export async function fetchQCLiveRecords(
  slug: string,
  filters: QCLiveFetchFilters = {},
): Promise<{ records: QCLiveRecord[]; error: string | null }> {
  if (!hasSupabaseConfig()) {
    return { records: [], error: 'Supabase is not configured.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_qc_live_records', {
    p_instrument_slug: slug,
    p_date_from: filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).toISOString() : null,
    p_date_to: filters.dateTo ? new Date(`${filters.dateTo}T23:59:59.999`).toISOString() : null,
    p_parameter: filters.parameter && filters.parameter !== 'all' ? filters.parameter : null,
    p_level: filters.level && filters.level !== 'all' ? filters.level : null,
    p_qc_status: filters.qcStatus && filters.qcStatus !== 'all' ? filters.qcStatus : null,
    p_resolution: filters.resolution && filters.resolution !== 'all' ? filters.resolution : null,
  });

  if (error) {
    return { records: [], error: error.message };
  }

  return {
    records: ((data ?? []) as QCLiveRecordRow[]).map(mapLiveRecord),
    error: null,
  };
}

export async function fetchQCLiveView(
  slug: string,
  filters: QCLiveFetchFilters = {},
): Promise<QCLiveFetchResult> {
  const [instrument, recordsResult] = await Promise.all([
    fetchQCLiveInstrument(slug),
    fetchQCLiveRecords(slug, filters),
  ]);

  return {
    instrument,
    records: recordsResult.records,
    error: recordsResult.error,
  };
}

export async function logQCLiveAccess(slug: string, instrumentId?: string, viewerId?: string): Promise<void> {
  if (!hasSupabaseConfig()) return;

  try {
    const supabase = createClient();
    await supabase.from('qc_live_access_log').insert({
      live_view_slug: slug,
      instrument_id: instrumentId ?? null,
      viewer_id: viewerId ?? null,
    });
  } catch {
    // Non-blocking audit
  }
}

export function getTodayDateRange(): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  return { dateFrom: iso, dateTo: iso };
}

export function getLastNDaysRange(days: number): { dateFrom: string; dateTo: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return {
    dateFrom: start.toISOString().slice(0, 10),
    dateTo: end.toISOString().slice(0, 10),
  };
}
