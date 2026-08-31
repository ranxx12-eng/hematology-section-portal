import {
  formatOutOfRangeParametersLabel,
  formatPerformerInitials,
  getWindowInstanceComplianceStatus,
  readingMatchesWindowInstance,
  resolveReadingWindowInstance,
} from '@/lib/environmental-monitoring/compliance';
import { getEnvironmentalPrintTemplate } from '@/lib/print/environmental-print-templates';
import type {
  EnvironmentalAsset,
  EnvironmentalExcursion,
  EnvironmentalMonitoringWindow,
  EnvironmentalReading,
  EnvironmentalReadingCorrection,
  EnvironmentalWindowComplianceStatus,
} from '@/types/environmental-monitoring';
import type { EnvLiveMonthlyLogPayload } from './live-view';

export type LiveMonthlyCellStatus =
  | 'IN RANGE'
  | 'OUT OF RANGE'
  | 'DUE'
  | 'MISSING'
  | 'UPCOMING';

export interface LiveMonthlyCellDetail {
  status: LiveMonthlyCellStatus;
  temperature?: string;
  humidity?: string;
  initials?: string;
  recordedAt?: string;
  performedByName?: string;
  acceptableTemperatureRange?: string;
  acceptableHumidityRange?: string;
  outOfRangeLabel?: string;
  excursionStatus?: string;
  recheckTemperature?: number;
  recheckHumidity?: number;
  recheckAt?: string;
  resolutionStatus?: string;
  immediateAction?: string;
  windowName: string;
  operationalDayKey: string;
}

export interface LiveMonthlySummary {
  compliancePercent: number;
  completedReadings: number;
  missingReadings: number;
  outOfRangeReadings: number;
  excursionsThisMonth: number;
  openExcursions: number;
  requiredReadings: number;
}

export interface LiveMonthlyLogModel {
  asset: EnvironmentalAsset;
  windows: EnvironmentalMonitoringWindow[];
  readings: EnvironmentalReading[];
  allReadings: EnvironmentalReading[];
  corrections: EnvironmentalReadingCorrection[];
  excursions: EnvironmentalExcursion[];
  grid: Record<number, Record<string, LiveMonthlyCellDetail>>;
  summary: LiveMonthlySummary;
  templateFormNumber?: string;
  templateQid?: string;
  templateTitle?: string;
  temperatureRangeLabel: string;
  humidityRangeLabel?: string;
  showHumidity: boolean;
}

const LIVE_INTERNAL_ID = 'env-live-view';

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function isWindowScheduledForOperationalDay(
  window: Pick<EnvironmentalMonitoringWindow, 'active' | 'required' | 'daysOfWeek'>,
  operationalDayKey: string,
): boolean {
  if (!window.active || !window.required) return false;
  const [year, month, day] = operationalDayKey.split('-').map(Number);
  const operationalDay = new Date(year, month - 1, day);
  return window.daysOfWeek.includes(operationalDay.getDay());
}

function mapLivePayloadToModel(payload: EnvLiveMonthlyLogPayload, now: Date): LiveMonthlyLogModel {
  const asset: EnvironmentalAsset = {
    id: LIVE_INTERNAL_ID,
    assetCode: payload.asset.assetCode,
    assetName: payload.asset.assetName,
    assetType: payload.asset.assetType,
    location: payload.asset.location,
    serialNumber: payload.asset.serialNumber,
    minTemperature: payload.asset.minTemperature,
    maxTemperature: payload.asset.maxTemperature,
    humidityMin: payload.asset.humidityMin,
    humidityMax: payload.asset.humidityMax,
    humidityRequired: payload.asset.humidityRequired,
    monitoringFrequency: 'daily',
    qrToken: '',
    active: true,
    createdAt: '',
    updatedAt: '',
  };

  const windows: EnvironmentalMonitoringWindow[] = payload.windows.map((window, index) => ({
    id: `${LIVE_INTERNAL_ID}-${window.windowName}-${index}`,
    assetId: LIVE_INTERNAL_ID,
    windowName: window.windowName,
    startTime: window.startTime,
    endTime: window.endTime,
    required: window.required,
    daysOfWeek: window.daysOfWeek,
    active: window.active,
    createdAt: '',
    updatedAt: '',
  }));

  const readings: EnvironmentalReading[] = payload.readings.map((reading, index) => ({
    id: `${LIVE_INTERNAL_ID}-reading-${index}`,
    assetId: LIVE_INTERNAL_ID,
    recordedAt: reading.recordedAt,
    temperature: reading.temperature,
    humidity: reading.humidity,
    calculatedStatus: reading.calculatedStatus,
    rangeMinAtReading: reading.rangeMinAtReading,
    rangeMaxAtReading: reading.rangeMaxAtReading,
    humidityMinAtReading: reading.humidityMinAtReading,
    humidityMaxAtReading: reading.humidityMaxAtReading,
    outOfRangeParameters: reading.outOfRangeParameters,
    performedByUserId: LIVE_INTERNAL_ID,
    performedByName: reading.performedByName,
    performedByStaffId: reading.performedByStaffId,
    source: 'qr',
    comment: reading.comment,
    createdAt: reading.recordedAt,
  }));

  const corrections: EnvironmentalReadingCorrection[] = payload.corrections.map((correction, index) => {
    const reading = readings.find((item) => item.recordedAt === correction.recordedAt);
    return {
      id: `${LIVE_INTERNAL_ID}-correction-${index}`,
      readingId: reading?.id ?? `${LIVE_INTERNAL_ID}-correction-reading-${index}`,
      previousTemperature: correction.previousTemperature,
      newTemperature: correction.newTemperature,
      previousHumidity: correction.previousHumidity,
      newHumidity: correction.newHumidity,
      correctionReason: '',
      correctedByUserId: LIVE_INTERNAL_ID,
      correctedByName: '',
      correctedAt: correction.recordedAt,
    };
  });

  const excursions: EnvironmentalExcursion[] = payload.excursions.map((excursion, index) => ({
    id: `${LIVE_INTERNAL_ID}-excursion-${index}`,
    readingId: `${LIVE_INTERNAL_ID}-excursion-reading-${index}`,
    assetId: LIVE_INTERNAL_ID,
    detectedAt: excursion.detectedAt,
    detectedTemperature: excursion.detectedTemperature,
    detectedHumidity: excursion.detectedHumidity,
    rangeMinAtDetection: excursion.rangeMinAtDetection,
    rangeMaxAtDetection: excursion.rangeMaxAtDetection,
    humidityMinAtDetection: excursion.humidityMinAtDetection,
    humidityMaxAtDetection: excursion.humidityMaxAtDetection,
    humidityRequiredAtDetection: asset.humidityRequired,
    outOfRangeParameters: excursion.outOfRangeParameters,
    status: excursion.status,
    immediateAction: excursion.immediateAction,
    recheckTemperature: excursion.recheckTemperature,
    recheckHumidity: excursion.recheckHumidity,
    recheckAt: excursion.recheckAt,
    resolutionStatus: excursion.resolutionStatus,
    reviewStatus: 'Pending Review',
    createdAt: excursion.detectedAt,
    updatedAt: excursion.detectedAt,
  }));

  return buildLiveMonthlyLogModel({
    asset,
    windows,
    readings,
    corrections,
    excursions,
    month: payload.month,
    year: payload.year,
    now,
  });
}

function resolveCellStatus(
  complianceStatus: EnvironmentalWindowComplianceStatus,
  reading?: EnvironmentalReading,
): LiveMonthlyCellStatus {
  if (reading) {
    return reading.calculatedStatus === 'out_of_range' ? 'OUT OF RANGE' : 'IN RANGE';
  }
  if (complianceStatus === 'upcoming') return 'UPCOMING';
  if (complianceStatus === 'due') return 'DUE';
  if (complianceStatus === 'missing') return 'MISSING';
  return 'UPCOMING';
}

function findExcursionForReading(
  reading: EnvironmentalReading,
  excursions: EnvironmentalExcursion[],
): EnvironmentalExcursion | undefined {
  return excursions.find((item) =>
    item.detectedAt === reading.recordedAt
    || Math.abs(new Date(item.detectedAt).getTime() - new Date(reading.recordedAt).getTime()) < 60_000,
  );
}

export function buildLiveMonthlyLogModel(input: {
  asset: EnvironmentalAsset;
  windows: EnvironmentalMonitoringWindow[];
  readings: EnvironmentalReading[];
  corrections: EnvironmentalReadingCorrection[];
  excursions: EnvironmentalExcursion[];
  month: number;
  year: number;
  now?: Date;
}): LiveMonthlyLogModel {
  const { asset, windows, readings, corrections, excursions, month, year } = input;
  const now = input.now ?? new Date();
  const totalDays = daysInMonth(month, year);
  const assetWindows = windows.filter((window) => window.assetId === asset.id && window.active && window.required);
  const activeReadings = readings.filter((reading) => !reading.voidedAt && reading.assetId === asset.id);
  const template = getEnvironmentalPrintTemplate(asset.assetCode);

  const grid: Record<number, Record<string, LiveMonthlyCellDetail>> = {};
  let requiredReadings = 0;
  let completedReadings = 0;
  let missingReadings = 0;

  for (let day = 1; day <= totalDays; day += 1) {
    const operationalDayKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    grid[day] = {};

    for (const window of assetWindows) {
      if (!isWindowScheduledForOperationalDay(window, operationalDayKey)) {
        grid[day][window.windowName] = {
          status: 'UPCOMING',
          windowName: window.windowName,
          operationalDayKey,
        };
        continue;
      }

      requiredReadings += 1;
      const complianceStatus = getWindowInstanceComplianceStatus(window, operationalDayKey, activeReadings, now);
      const reading = activeReadings.find((item) => readingMatchesWindowInstance(item, window, operationalDayKey));
      const status = resolveCellStatus(complianceStatus, reading);

      if (reading) {
        completedReadings += 1;
      } else if (complianceStatus === 'missing') {
        missingReadings += 1;
      }

      if (!reading) {
        grid[day][window.windowName] = {
          status,
          windowName: window.windowName,
          operationalDayKey,
        };
        continue;
      }

      const correction = corrections.find((item) => item.readingId === reading.id);
      const temperature = correction ? String(correction.newTemperature) : String(reading.temperature);
      const humidityValue = correction?.newHumidity ?? reading.humidity;
      const excursion = findExcursionForReading(reading, excursions);

      grid[day][window.windowName] = {
        status,
        temperature,
        humidity: humidityValue != null ? String(humidityValue) : undefined,
        initials: formatPerformerInitials(reading.performedByName, reading.performedByStaffId),
        recordedAt: reading.recordedAt,
        performedByName: reading.performedByName,
        acceptableTemperatureRange: `${reading.rangeMinAtReading}°C – ${reading.rangeMaxAtReading}°C`,
        acceptableHumidityRange: asset.humidityRequired && reading.humidityMinAtReading != null && reading.humidityMaxAtReading != null
          ? `${reading.humidityMinAtReading}% – ${reading.humidityMaxAtReading}%`
          : undefined,
        outOfRangeLabel: reading.calculatedStatus === 'out_of_range'
          ? formatOutOfRangeParametersLabel(reading.outOfRangeParameters)
          : undefined,
        excursionStatus: excursion?.status,
        recheckTemperature: excursion?.recheckTemperature,
        recheckHumidity: excursion?.recheckHumidity,
        recheckAt: excursion?.recheckAt,
        resolutionStatus: excursion?.resolutionStatus,
        immediateAction: excursion?.immediateAction,
        windowName: window.windowName,
        operationalDayKey,
      };
    }
  }

  const monthOperationalReadings = activeReadings.filter((reading) => {
    const instance = resolveReadingWindowInstance(reading, assetWindows);
    if (!instance) return false;
    const [y, m] = instance.operationalDayKey.split('-').map(Number);
    return y === year && m === month;
  });

  const monthExcursions = excursions.filter((item) => {
    if (item.voidedAt) return false;
    const detected = new Date(item.detectedAt);
    return detected.getFullYear() === year && detected.getMonth() + 1 === month;
  });

  const openExcursions = monthExcursions.filter((item) =>
    ['open', 'under_action', 'awaiting_recheck'].includes(item.status),
  ).length;

  const compliancePercent = requiredReadings === 0
    ? 100
    : Number(((completedReadings / requiredReadings) * 100).toFixed(1));

  const temperatureRangeLabel = template?.temperatureRangeLabel
    ?? `${asset.minTemperature}°C – ${asset.maxTemperature}°C`;
  const humidityRangeLabel = asset.humidityRequired && asset.humidityMin != null && asset.humidityMax != null
    ? (template?.humidityRangeLabel ?? `${asset.humidityMin}% – ${asset.humidityMax}%`)
    : template?.humidityRangeLabel;

  return {
    asset,
    windows: assetWindows,
    readings: monthOperationalReadings,
    allReadings: activeReadings,
    corrections,
    excursions: monthExcursions,
    grid,
    summary: {
      compliancePercent,
      completedReadings,
      missingReadings,
      outOfRangeReadings: monthOperationalReadings.filter((reading) => reading.calculatedStatus === 'out_of_range').length,
      excursionsThisMonth: monthExcursions.length,
      openExcursions,
      requiredReadings,
    },
    templateFormNumber: template?.formNumber,
    templateQid: template?.qid,
    templateTitle: template?.title,
    temperatureRangeLabel,
    humidityRangeLabel,
    showHumidity: template?.showHumidityColumns ?? asset.humidityRequired,
  };
}

export function buildLiveMonthlyLogFromPayload(
  payload: EnvLiveMonthlyLogPayload,
  now = new Date(),
): LiveMonthlyLogModel {
  return mapLivePayloadToModel(payload, now);
}

export function canNavigateToNextMonth(year: number, month: number, now = new Date()): boolean {
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  if (year > currentYear) return false;
  if (year === currentYear && month >= currentMonth) return false;
  return true;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}
