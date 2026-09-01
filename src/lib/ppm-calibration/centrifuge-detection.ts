import type { Instrument } from '@/types';

export const CENTRIFUGE_SERIAL_NUMBER = '721123071802';
export const CENTRIFUGE_ASSET_CODE = 'HMG 61959';
export const CENTRIFUGE_NAME = 'Centrifuge';

type CentrifugeInstrumentRef = Pick<Instrument, 'name' | 'equipmentCategory'> & {
  serialNumber?: string | null;
  assetCode?: string | null;
};

function normalizeAssetCode(value: string | undefined | null): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
}

export function isCentrifugePppInstrument(instrument: CentrifugeInstrumentRef): boolean {
  const serial = instrument.serialNumber?.trim();
  if (serial === CENTRIFUGE_SERIAL_NUMBER) return true;

  if (normalizeAssetCode(instrument.assetCode) === normalizeAssetCode(CENTRIFUGE_ASSET_CODE)) {
    return true;
  }

  const name = instrument.name?.trim().toLowerCase();
  return name === CENTRIFUGE_NAME.toLowerCase() && instrument.equipmentCategory === 'centrifuge';
}

export function findCentrifugeInstrument(instruments: Instrument[]): Instrument | undefined {
  return instruments.find(isCentrifugePppInstrument);
}
