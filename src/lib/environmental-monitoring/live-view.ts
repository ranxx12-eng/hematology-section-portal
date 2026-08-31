import { createClient } from '@/lib/supabase/client';
import { hasSupabaseConfig } from '@/lib/security/env';
import type {
  EnvironmentalAssetType,
  EnvironmentalExcursionStatus,
  EnvironmentalOutOfRangeParameters,
  EnvironmentalReadingStatus,
} from '@/types/environmental-monitoring';

export interface EnvLiveAssetPayload {
  assetCode: string;
  assetName: string;
  assetType: EnvironmentalAssetType;
  location?: string;
  serialNumber?: string;
  minTemperature: number;
  maxTemperature: number;
  humidityMin?: number;
  humidityMax?: number;
  humidityRequired: boolean;
}

export interface EnvLiveWindowPayload {
  windowName: string;
  startTime: string;
  endTime: string;
  required: boolean;
  daysOfWeek: number[];
  active: boolean;
}

export interface EnvLiveReadingPayload {
  recordedAt: string;
  temperature: number;
  humidity?: number;
  calculatedStatus: EnvironmentalReadingStatus;
  performedByName: string;
  performedByStaffId?: string;
  outOfRangeParameters?: EnvironmentalOutOfRangeParameters;
  rangeMinAtReading: number;
  rangeMaxAtReading: number;
  humidityMinAtReading?: number;
  humidityMaxAtReading?: number;
  comment?: string;
}

export interface EnvLiveCorrectionPayload {
  recordedAt: string;
  previousTemperature: number;
  newTemperature: number;
  previousHumidity?: number;
  newHumidity?: number;
}

export interface EnvLiveExcursionPayload {
  detectedAt: string;
  recordedAt: string;
  detectedTemperature: number;
  detectedHumidity?: number;
  outOfRangeParameters?: EnvironmentalOutOfRangeParameters;
  status: EnvironmentalExcursionStatus;
  immediateAction?: string;
  recheckTemperature?: number;
  recheckHumidity?: number;
  recheckAt?: string;
  resolutionStatus?: string;
  rangeMinAtDetection: number;
  rangeMaxAtDetection: number;
  humidityMinAtDetection?: number;
  humidityMaxAtDetection?: number;
}

export interface EnvLiveMonthlyLogPayload {
  asset: EnvLiveAssetPayload;
  windows: EnvLiveWindowPayload[];
  readings: EnvLiveReadingPayload[];
  corrections: EnvLiveCorrectionPayload[];
  excursions: EnvLiveExcursionPayload[];
  year: number;
  month: number;
}

export interface EnvLiveMonthlyLogResult {
  data: EnvLiveMonthlyLogPayload | null;
  error: string | null;
}

export async function fetchEnvLiveMonthlyLog(
  assetCode: string,
  year: number,
  month: number,
): Promise<EnvLiveMonthlyLogResult> {
  if (!hasSupabaseConfig()) {
    return { data: null, error: 'Supabase is not configured.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_env_live_monthly_log', {
    p_asset_code: assetCode,
    p_year: year,
    p_month: month,
  });

  if (error) {
    return { data: null, error: error.message };
  }

  if (!data) {
    return { data: null, error: 'Asset not found.' };
  }

  return { data: data as EnvLiveMonthlyLogPayload, error: null };
}

export async function logEnvLiveAccess(
  assetCode: string,
  year: number,
  month: number,
): Promise<void> {
  if (!hasSupabaseConfig()) return;

  try {
    const supabase = createClient();
    await supabase.rpc('log_env_live_access', {
      p_asset_code: assetCode,
      p_year: year,
      p_month: month,
    });
  } catch {
    // Non-blocking
  }
}

export function buildAssetLiveMonthlyLogPath(locale: string, assetCode: string): string {
  return `/${locale}/environmental-monitoring/live/${encodeURIComponent(assetCode)}`;
}
