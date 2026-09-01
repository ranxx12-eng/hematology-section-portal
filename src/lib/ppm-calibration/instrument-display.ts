import type { Instrument } from '@/types';
import type { EquipmentMaintenanceRecord } from '@/types/ppm-calibration';

export function formatInstrumentSelectorLabel(instrument: Pick<Instrument, 'name' | 'serialNumber' | 'assetCode' | 'equipmentCategory' | 'technicalSpecification'>): string {
  if (instrument.equipmentCategory === 'pipette' || instrument.name.toLowerCase().startsWith('pipette')) {
    return `${instrument.name} — ${instrument.serialNumber || '—'}`;
  }
  if (instrument.assetCode) {
    return `${instrument.name} (${instrument.assetCode})`;
  }
  if (instrument.serialNumber) {
    return `${instrument.name} — ${instrument.serialNumber}`;
  }
  return instrument.name;
}

export function formatCalibrationPerformer(record: Pick<
  EquipmentMaintenanceRecord,
  'performedByType' | 'performedByName' | 'performedByStaffId' | 'engineerName' | 'serviceProvider'
>): { primary: string; secondary?: string; mode: 'internal' | 'external' } {
  const isInternal = record.performedByType === 'internal_staff'
    || (!record.engineerName && !record.serviceProvider);

  if (isInternal) {
    return {
      mode: 'internal',
      primary: record.performedByName,
      secondary: record.performedByStaffId ? `Staff ID: ${record.performedByStaffId}` : undefined,
    };
  }

  return {
    mode: 'external',
    primary: record.engineerName ?? record.performedByName,
    secondary: record.serviceProvider ?? undefined,
  };
}
