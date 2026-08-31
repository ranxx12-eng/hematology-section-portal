import type { EnvironmentalAssetType } from '@/types/environmental-monitoring';

export type EnvironmentalPrintLayoutKey = 'form_labgen_055' | 'form_labgen_057';

export interface EnvironmentalPrintTemplateConfig {
  layoutKey: EnvironmentalPrintLayoutKey;
  formNumber: string;
  qid: string;
  title: string;
  footerLeft: string;
  departmentLocation: string;
  roomAreaLabel?: string;
  temperatureRangeLabel: string;
  humidityRangeLabel?: string;
  showHumidityColumns: boolean;
  assetLabel: string;
}

const FORM_055_CONFIG: Omit<EnvironmentalPrintTemplateConfig, 'assetLabel' | 'roomAreaLabel' | 'temperatureRangeLabel' | 'humidityRangeLabel' | 'showHumidityColumns'> = {
  layoutKey: 'form_labgen_055',
  formNumber: 'Form-LabGen 055',
  qid: 'HMG/SAH/QID/9063',
  title: 'Refrigerator Temperature Monitoring Chart',
  footerLeft: 'Form-LabGen 055-Refrigerator Temperature Monitoring Chart',
  departmentLocation: 'Laboratory Department',
};

const FORM_057_BASE: Omit<EnvironmentalPrintTemplateConfig, 'assetLabel' | 'roomAreaLabel' | 'temperatureRangeLabel' | 'humidityRangeLabel' | 'showHumidityColumns'> = {
  layoutKey: 'form_labgen_057',
  formNumber: 'Form-LabGen 057',
  qid: 'HMG/SAH/QID/9065',
  title: 'Room Temperature & Humidity Monitoring Chart',
  footerLeft: 'Form-LabGen 057- Room Temperature & Humidity Monitoring',
  departmentLocation: 'Laboratory',
};

export const ENVIRONMENTAL_PRINT_TEMPLATES: Record<string, EnvironmentalPrintTemplateConfig> = {
  'REF-01': {
    ...FORM_055_CONFIG,
    assetLabel: 'Refrigerator 01',
    temperatureRangeLabel: '2° TO 8°',
    showHumidityColumns: false,
  },
  'REF-02': {
    ...FORM_055_CONFIG,
    assetLabel: 'Refrigerator 02',
    temperatureRangeLabel: '2° TO 8°',
    showHumidityColumns: false,
  },
  'STORAGE-01': {
    ...FORM_057_BASE,
    assetLabel: 'Storage',
    roomAreaLabel: 'STORAGE',
    temperatureRangeLabel: '20–24°C',
    humidityRangeLabel: '30–60%',
    showHumidityColumns: true,
  },
  'COLD-ROOM-01': {
    ...FORM_057_BASE,
    assetLabel: 'Cold Room',
    roomAreaLabel: 'COLD ROOM',
    temperatureRangeLabel: '2–8°C',
    showHumidityColumns: true,
  },
  'HEMA-ROOM-01': {
    ...FORM_057_BASE,
    assetLabel: 'Hematology Section Room Temperature',
    roomAreaLabel: 'HEMATOLOGY',
    temperatureRangeLabel: '20–24°C',
    humidityRangeLabel: '30–60%',
    showHumidityColumns: true,
  },
};

export function getEnvironmentalPrintTemplate(assetCode: string): EnvironmentalPrintTemplateConfig | undefined {
  return ENVIRONMENTAL_PRINT_TEMPLATES[assetCode.toUpperCase()] ?? ENVIRONMENTAL_PRINT_TEMPLATES[assetCode];
}

export function getAssetRoomAreaLabel(assetCode: string, assetType?: EnvironmentalAssetType): string | undefined {
  const template = getEnvironmentalPrintTemplate(assetCode);
  if (template?.roomAreaLabel) return template.roomAreaLabel;
  if (assetType === 'storage_room') return 'STORAGE';
  if (assetType === 'cold_room') return 'COLD ROOM';
  if (assetType === 'room_temperature') return 'HEMATOLOGY';
  return undefined;
}

export const ENVIRONMENTAL_PRINT_HOSPITAL = 'AL SAHAFAH HOSPITAL';
export const ENVIRONMENTAL_PRINT_DEPARTMENT = 'LABORATORY DEPARTMENT';

export const OFFICIAL_SHIFT_LABELS = {
  'AM Shift': { label: 'AM Shift', time: '7am–3pm' },
  'PM Shift': { label: 'PM Shift', time: '3pm–11pm' },
  'Night Shift': { label: 'Night Shift', time: '11pm–7am' },
} as const;
