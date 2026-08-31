import type {
  EnvironmentalAsset,
  EnvironmentalMonitoringWindow,
  EnvironmentalReading,
  EnvironmentalWindowComplianceStatus,
} from '@/types/environmental-monitoring';

function parseTimeToMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}

function getLocalDateParts(date: Date) {
  return {
    dayOfWeek: date.getDay(),
    minutes: date.getHours() * 60 + date.getMinutes(),
    dateKey: date.toISOString().slice(0, 10),
  };
}

function isWindowScheduledForDay(window: EnvironmentalMonitoringWindow, dayOfWeek: number): boolean {
  return window.active && window.required && window.daysOfWeek.includes(dayOfWeek);
}

function readingMatchesWindow(
  reading: EnvironmentalReading,
  window: EnvironmentalMonitoringWindow,
  now: Date,
): boolean {
  if (reading.voidedAt) return false;
  const recorded = new Date(reading.recordedAt);
  const { dayOfWeek, minutes, dateKey } = getLocalDateParts(recorded);
  const nowParts = getLocalDateParts(now);
  if (dateKey !== nowParts.dateKey) return false;
  if (!window.daysOfWeek.includes(dayOfWeek)) return false;
  const start = parseTimeToMinutes(window.startTime);
  const end = parseTimeToMinutes(window.endTime);
  return minutes >= start && minutes <= end;
}

export function getWindowComplianceStatus(
  window: EnvironmentalMonitoringWindow,
  readings: EnvironmentalReading[],
  now = new Date(),
): EnvironmentalWindowComplianceStatus {
  const { dayOfWeek, minutes } = getLocalDateParts(now);
  if (!isWindowScheduledForDay(window, dayOfWeek)) return 'upcoming';

  const start = parseTimeToMinutes(window.startTime);
  const end = parseTimeToMinutes(window.endTime);
  const windowReadings = readings.filter((reading) => readingMatchesWindow(reading, window, now));

  if (windowReadings.length > 0) return 'completed';
  if (minutes < start) return 'upcoming';
  if (minutes >= start && minutes <= end) return 'due';
  return 'missing';
}

export function computeDailyCompliancePercent(
  assets: EnvironmentalAsset[],
  windows: EnvironmentalMonitoringWindow[],
  readings: EnvironmentalReading[],
  now = new Date(),
): number {
  const { dayOfWeek, minutes } = getLocalDateParts(now);
  let dueCount = 0;
  let completedCount = 0;

  for (const asset of assets.filter((item) => item.active)) {
    const assetWindows = windows.filter((window) => window.assetId === asset.id);
    const assetReadings = readings.filter((reading) => reading.assetId === asset.id);

    for (const window of assetWindows) {
      if (!isWindowScheduledForDay(window, dayOfWeek)) continue;
      const start = parseTimeToMinutes(window.startTime);
      if (minutes < start) continue;

      dueCount += 1;
      if (assetReadings.some((reading) => readingMatchesWindow(reading, window, now))) {
        completedCount += 1;
      }
    }
  }

  if (dueCount === 0) return 100;
  return Number(((completedCount / dueCount) * 100).toFixed(1));
}

export function countMissingWindows(
  assets: EnvironmentalAsset[],
  windows: EnvironmentalMonitoringWindow[],
  readings: EnvironmentalReading[],
  now = new Date(),
): number {
  let missing = 0;
  for (const asset of assets.filter((item) => item.active)) {
    const assetWindows = windows.filter((window) => window.assetId === asset.id);
    const assetReadings = readings.filter((reading) => reading.assetId === asset.id);
    for (const window of assetWindows) {
      if (getWindowComplianceStatus(window, assetReadings, now) === 'missing') {
        missing += 1;
      }
    }
  }
  return missing;
}

export function resolveCurrentWindow(
  windows: EnvironmentalMonitoringWindow[],
  now = new Date(),
): EnvironmentalMonitoringWindow | undefined {
  const { dayOfWeek, minutes } = getLocalDateParts(now);
  return windows.find((window) => {
    if (!isWindowScheduledForDay(window, dayOfWeek)) return false;
    const start = parseTimeToMinutes(window.startTime);
    const end = parseTimeToMinutes(window.endTime);
    return minutes >= start && minutes <= end;
  });
}

export function resolveAssetDisplayStatus(
  asset: EnvironmentalAsset,
  windows: EnvironmentalMonitoringWindow[],
  readings: EnvironmentalReading[],
  now = new Date(),
): 'IN RANGE' | 'OUT OF RANGE' | 'DUE' | 'MISSING' | 'NO READING' {
  const activeReadings = readings.filter((reading) => !reading.voidedAt);
  const latest = activeReadings.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];

  const assetWindows = windows.filter((window) => window.assetId === asset.id);
  const statuses = assetWindows.map((window) => getWindowComplianceStatus(window, activeReadings, now));
  if (statuses.includes('missing')) return 'MISSING';
  if (statuses.includes('due')) return 'DUE';
  if (!latest) return 'NO READING';
  return latest.calculatedStatus === 'out_of_range' ? 'OUT OF RANGE' : 'IN RANGE';
}

export function buildAssetQrPath(locale: string, assetCode: string): string {
  return `/${locale}/environmental-monitoring/record?asset=${encodeURIComponent(assetCode)}`;
}

export function findAssetByCode(assets: EnvironmentalAsset[], assetCode?: string | null): EnvironmentalAsset | undefined {
  if (!assetCode) return undefined;
  return assets.find((asset) => asset.assetCode.toLowerCase() === assetCode.toLowerCase());
}

export function buildAssetStatusRows(
  assets: EnvironmentalAsset[],
  windows: EnvironmentalMonitoringWindow[],
  readings: EnvironmentalReading[],
  now = new Date(),
) {
  return assets
    .filter((asset) => asset.active)
    .map((asset) => {
      const assetWindows = windows.filter((window) => window.assetId === asset.id && window.active);
      const assetReadings = readings.filter((reading) => reading.assetId === asset.id);
      const activeReadings = assetReadings.filter((reading) => !reading.voidedAt);
      const latest = activeReadings.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
      const currentWindow = resolveCurrentWindow(assetWindows, now);
      const dueWindow = assetWindows.find((window) => getWindowComplianceStatus(window, activeReadings, now) === 'due');
      const nextDueWindow = currentWindow ?? dueWindow;

      return {
        asset,
        acceptableRangeLabel: `${asset.minTemperature}°C – ${asset.maxTemperature}°C`,
        lastReading: latest,
        displayStatus: resolveAssetDisplayStatus(asset, assetWindows, assetReadings, now),
        lastCheckedAt: latest?.recordedAt,
        performedBy: latest?.performedByName,
        nextDueWindow: nextDueWindow
          ? `${nextDueWindow.windowName} (${nextDueWindow.startTime.slice(0, 5)}–${nextDueWindow.endTime.slice(0, 5)})`
          : undefined,
      };
    });
}

export interface MonthlyComplianceSummary {
  requiredReadings: number;
  completedReadings: number;
  missingReadings: number;
  outOfRangeReadings: number;
  excursions: number;
  compliancePercent: number;
}

export function computeMonthlyComplianceSummary(
  asset: EnvironmentalAsset,
  windows: EnvironmentalMonitoringWindow[],
  readings: EnvironmentalReading[],
  excursions: { assetId: string; detectedAt: string; voidedAt?: string }[],
  month: number,
  year: number,
): MonthlyComplianceSummary {
  const assetWindows = windows.filter((window) => window.assetId === asset.id && window.active && window.required);
  const assetReadings = readings.filter((reading) => reading.assetId === asset.id && !reading.voidedAt);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  let requiredReadings = 0;
  let completedReadings = 0;
  let missingReadings = 0;

  for (let day = new Date(monthStart); day <= monthEnd; day.setDate(day.getDate() + 1)) {
    const dayOfWeek = day.getDay();
    const dateKey = day.toISOString().slice(0, 10);
    for (const window of assetWindows) {
      if (!window.daysOfWeek.includes(dayOfWeek)) continue;
      requiredReadings += 1;
      const dayReadings = assetReadings.filter((reading) => {
        const recorded = new Date(reading.recordedAt);
        if (recorded.toISOString().slice(0, 10) !== dateKey) return false;
        const minutes = recorded.getHours() * 60 + recorded.getMinutes();
        const start = parseTimeToMinutes(window.startTime);
        const end = parseTimeToMinutes(window.endTime);
        return minutes >= start && minutes <= end;
      });
      if (dayReadings.length > 0) {
        completedReadings += 1;
      } else if (day < new Date()) {
        missingReadings += 1;
      }
    }
  }

  const monthReadings = assetReadings.filter((reading) => {
    const recorded = new Date(reading.recordedAt);
    return recorded.getMonth() === month - 1 && recorded.getFullYear() === year;
  });

  const outOfRangeReadings = monthReadings.filter((reading) => reading.calculatedStatus === 'out_of_range').length;
  const monthExcursions = excursions.filter((item) => {
    if (item.voidedAt) return false;
    const detected = new Date(item.detectedAt);
    return item.assetId === asset.id && detected.getMonth() === month - 1 && detected.getFullYear() === year;
  }).length;

  const compliancePercent = requiredReadings === 0
    ? 100
    : Number(((completedReadings / requiredReadings) * 100).toFixed(1));

  return {
    requiredReadings,
    completedReadings,
    missingReadings,
    outOfRangeReadings,
    excursions: monthExcursions,
    compliancePercent,
  };
}
