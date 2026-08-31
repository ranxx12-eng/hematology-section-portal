import type {
  EnvironmentalAsset,
  EnvironmentalMonitoringWindow,
  EnvironmentalOutOfRangeParameters,
  EnvironmentalReading,
  EnvironmentalWindowComplianceStatus,
} from '@/types/environmental-monitoring';

export const OFFICIAL_SHIFT_WINDOWS = [
  { windowName: 'AM Shift', startTime: '07:00', endTime: '15:00' },
  { windowName: 'PM Shift', startTime: '15:00', endTime: '23:00' },
  { windowName: 'Night Shift', startTime: '23:00', endTime: '07:00' },
] as const;

function parseTimeToMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}

function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Night Shift (23:00–07:00) crosses midnight when start minutes exceed end minutes. */
export function windowCrossesMidnight(window: Pick<EnvironmentalMonitoringWindow, 'startTime' | 'endTime'>): boolean {
  return parseTimeToMinutes(window.startTime) > parseTimeToMinutes(window.endTime);
}

/**
 * Operational-day rule (documented for monthly logs and compliance):
 * - AM Shift and PM Shift belong to the calendar date when the reading was recorded.
 * - Night Shift belongs to the calendar date when the shift STARTS (23:00).
 *   Example: a reading at 03:00 on 2 Jan belongs to the Night Shift of 1 Jan.
 */
export function getOperationalDayKey(timestamp: Date, window: Pick<EnvironmentalMonitoringWindow, 'startTime' | 'endTime'>): string {
  if (!windowCrossesMidnight(window)) {
    return formatLocalDateKey(timestamp);
  }

  const minutes = timestamp.getHours() * 60 + timestamp.getMinutes();
  const end = parseTimeToMinutes(window.endTime);
  if (minutes <= end) {
    return formatLocalDateKey(addDays(timestamp, -1));
  }
  return formatLocalDateKey(timestamp);
}

export function getWindowInstanceBounds(
  operationalDayKey: string,
  window: Pick<EnvironmentalMonitoringWindow, 'startTime' | 'endTime'>,
): { start: Date; end: Date } {
  const [year, month, day] = operationalDayKey.split('-').map(Number);
  const startMinutes = parseTimeToMinutes(window.startTime);
  const endMinutes = parseTimeToMinutes(window.endTime);
  const start = new Date(year, month - 1, day, Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);

  if (!windowCrossesMidnight(window)) {
    const end = new Date(year, month - 1, day, Math.floor(endMinutes / 60), endMinutes % 60, 59, 999);
    return { start, end };
  }

  const end = new Date(year, month - 1, day + 1, Math.floor(endMinutes / 60), endMinutes % 60, 59, 999);
  return { start, end };
}

function isWindowScheduledForOperationalDay(
  window: EnvironmentalMonitoringWindow,
  operationalDayKey: string,
): boolean {
  if (!window.active || !window.required) return false;
  const [year, month, day] = operationalDayKey.split('-').map(Number);
  const operationalDay = new Date(year, month - 1, day);
  return window.daysOfWeek.includes(operationalDay.getDay());
}

export function readingMatchesWindowInstance(
  reading: EnvironmentalReading,
  window: EnvironmentalMonitoringWindow,
  operationalDayKey: string,
): boolean {
  if (reading.voidedAt) return false;
  const recorded = new Date(reading.recordedAt);
  if (getOperationalDayKey(recorded, window) !== operationalDayKey) return false;
  const { start, end } = getWindowInstanceBounds(operationalDayKey, window);
  return recorded >= start && recorded <= end;
}

export interface WindowInstanceRef {
  window: EnvironmentalMonitoringWindow;
  operationalDayKey: string;
}

export function listDueWindowInstances(
  windows: EnvironmentalMonitoringWindow[],
  now = new Date(),
): WindowInstanceRef[] {
  const instances: WindowInstanceRef[] = [];
  const seen = new Set<string>();

  for (const dayOffset of [0, -1]) {
    const day = addDays(now, dayOffset);
    const operationalDayKey = formatLocalDateKey(day);

    for (const window of windows) {
      if (!isWindowScheduledForOperationalDay(window, operationalDayKey)) continue;
      const { start } = getWindowInstanceBounds(operationalDayKey, window);
      if (start > now) continue;

      const key = `${window.id}:${operationalDayKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      instances.push({ window, operationalDayKey });
    }
  }

  return instances;
}

export function getWindowInstanceComplianceStatus(
  window: EnvironmentalMonitoringWindow,
  operationalDayKey: string,
  readings: EnvironmentalReading[],
  now = new Date(),
): EnvironmentalWindowComplianceStatus {
  if (!isWindowScheduledForOperationalDay(window, operationalDayKey)) return 'upcoming';

  const { start, end } = getWindowInstanceBounds(operationalDayKey, window);
  const completed = readings.some((reading) => readingMatchesWindowInstance(reading, window, operationalDayKey));

  if (completed) return 'completed';
  if (now < start) return 'upcoming';
  if (now >= start && now <= end) return 'due';
  return 'missing';
}

export function getWindowComplianceStatus(
  window: EnvironmentalMonitoringWindow,
  readings: EnvironmentalReading[],
  now = new Date(),
): EnvironmentalWindowComplianceStatus {
  const dueInstances = listDueWindowInstances([window], now)
    .filter((instance) => instance.window.id === window.id);

  if (dueInstances.length === 0) {
    const todayKey = formatLocalDateKey(now);
    if (!isWindowScheduledForOperationalDay(window, todayKey)) return 'upcoming';
    return getWindowInstanceComplianceStatus(window, todayKey, readings, now);
  }

  const statuses = dueInstances.map((instance) =>
    getWindowInstanceComplianceStatus(window, instance.operationalDayKey, readings, now),
  );

  if (statuses.includes('missing')) return 'missing';
  if (statuses.includes('due')) return 'due';
  if (statuses.includes('completed')) return 'completed';
  return 'upcoming';
}

export function computeDailyCompliancePercent(
  assets: EnvironmentalAsset[],
  windows: EnvironmentalMonitoringWindow[],
  readings: EnvironmentalReading[],
  now = new Date(),
): number {
  let dueCount = 0;
  let completedCount = 0;

  for (const asset of assets.filter((item) => item.active)) {
    const assetWindows = windows.filter((window) => window.assetId === asset.id);
    const assetReadings = readings.filter((reading) => reading.assetId === asset.id);
    const dueInstances = listDueWindowInstances(assetWindows, now);

    for (const instance of dueInstances) {
      dueCount += 1;
      if (assetReadings.some((reading) => readingMatchesWindowInstance(reading, instance.window, instance.operationalDayKey))) {
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
    const dueInstances = listDueWindowInstances(assetWindows, now);

    for (const instance of dueInstances) {
      if (getWindowInstanceComplianceStatus(instance.window, instance.operationalDayKey, assetReadings, now) === 'missing') {
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
  return windows.find((window) => {
    if (!window.active || !window.required) return false;
    const operationalDayKey = getOperationalDayKey(now, window);
    if (!isWindowScheduledForOperationalDay(window, operationalDayKey)) return false;
    const { start, end } = getWindowInstanceBounds(operationalDayKey, window);
    return now >= start && now <= end;
  });
}

export function resolveReadingWindowInstance(
  reading: EnvironmentalReading,
  windows: EnvironmentalMonitoringWindow[],
): WindowInstanceRef | undefined {
  const assetWindows = windows.filter((window) => window.assetId === reading.assetId && window.active);
  const recorded = new Date(reading.recordedAt);

  for (const window of assetWindows) {
    const operationalDayKey = getOperationalDayKey(recorded, window);
    if (readingMatchesWindowInstance(reading, window, operationalDayKey)) {
      return { window, operationalDayKey };
    }
  }

  return undefined;
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
  const dueInstances = listDueWindowInstances(assetWindows, now);

  const statuses = dueInstances.map((instance) =>
    getWindowInstanceComplianceStatus(instance.window, instance.operationalDayKey, activeReadings, now),
  );

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
      const dueInstance = listDueWindowInstances(assetWindows, now).find((instance) =>
        getWindowInstanceComplianceStatus(instance.window, instance.operationalDayKey, activeReadings, now) === 'due',
      );

      const humidityLabel = asset.humidityRequired && asset.humidityMin != null && asset.humidityMax != null
        ? ` · ${asset.humidityMin}–${asset.humidityMax}% RH`
        : '';

      return {
        asset,
        acceptableRangeLabel: `${asset.minTemperature}°C – ${asset.maxTemperature}°C${humidityLabel}`,
        lastReading: latest,
        displayStatus: resolveAssetDisplayStatus(asset, assetWindows, assetReadings, now),
        lastCheckedAt: latest?.recordedAt,
        performedBy: latest?.performedByName,
        nextDueWindow: (currentWindow ?? dueInstance?.window)
          ? `${(currentWindow ?? dueInstance?.window)?.windowName} (${(currentWindow ?? dueInstance?.window)?.startTime.slice(0, 5)}–${(currentWindow ?? dueInstance?.window)?.endTime.slice(0, 5)})`
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
  const daysInMonth = new Date(year, month, 0).getDate();
  const now = new Date();

  let requiredReadings = 0;
  let completedReadings = 0;
  let missingReadings = 0;

  for (let day = 1; day <= daysInMonth; day += 1) {
    const operationalDayKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    for (const window of assetWindows) {
      if (!isWindowScheduledForOperationalDay(window, operationalDayKey)) continue;

      requiredReadings += 1;
      const completed = assetReadings.some((reading) =>
        readingMatchesWindowInstance(reading, window, operationalDayKey),
      );

      if (completed) {
        completedReadings += 1;
        continue;
      }

      const { end } = getWindowInstanceBounds(operationalDayKey, window);
      if (end < now) {
        missingReadings += 1;
      }
    }
  }

  const monthReadings = assetReadings.filter((reading) => {
    const recorded = new Date(reading.recordedAt);
    return recorded.getMonth() + 1 === month && recorded.getFullYear() === year;
  });

  const outOfRangeReadings = monthReadings.filter((reading) => reading.calculatedStatus === 'out_of_range').length;
  const monthExcursions = excursions.filter((item) => {
    if (item.voidedAt) return false;
    const detected = new Date(item.detectedAt);
    return item.assetId === asset.id && detected.getMonth() + 1 === month && detected.getFullYear() === year;
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

export function computeOutOfRangeParameters(
  temperature: number,
  humidity: number | undefined,
  asset: Pick<EnvironmentalAsset, 'minTemperature' | 'maxTemperature' | 'humidityMin' | 'humidityMax' | 'humidityRequired'>,
): EnvironmentalOutOfRangeParameters | null {
  let temperatureOut = temperature < asset.minTemperature || temperature > asset.maxTemperature;
  let humidityOut = false;

  if (asset.humidityRequired) {
    if (humidity == null) humidityOut = true;
    else {
      if (asset.humidityMin != null && humidity < asset.humidityMin) humidityOut = true;
      if (asset.humidityMax != null && humidity > asset.humidityMax) humidityOut = true;
    }
  }

  if (temperatureOut && humidityOut) return 'temperature_humidity';
  if (temperatureOut) return 'temperature';
  if (humidityOut) return 'humidity';
  return null;
}

export function formatOutOfRangeParametersLabel(value?: EnvironmentalOutOfRangeParameters | null): string {
  switch (value) {
    case 'temperature':
      return 'Temperature Out of Range';
    case 'humidity':
      return 'Humidity Out of Range';
    case 'temperature_humidity':
      return 'Temperature + Humidity Out of Range';
    default:
      return 'OUT OF RANGE';
  }
}

export function formatPerformerInitials(name: string, staffId?: string | null): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return staffId ? `${initials}/${staffId}` : initials;
}
