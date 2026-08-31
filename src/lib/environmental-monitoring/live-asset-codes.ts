export const ENV_LIVE_ASSET_CODES = [
  'REF-01',
  'REF-02',
  'STORAGE-01',
  'COLD-ROOM-01',
  'HEMA-ROOM-01',
] as const;

export type EnvLiveAssetCode = (typeof ENV_LIVE_ASSET_CODES)[number];

export function isValidEnvLiveAssetCode(code: string): code is EnvLiveAssetCode {
  return ENV_LIVE_ASSET_CODES.some((item) => item.toLowerCase() === code.toLowerCase());
}

export function normalizeEnvLiveAssetCode(code: string): EnvLiveAssetCode | null {
  const match = ENV_LIVE_ASSET_CODES.find((item) => item.toLowerCase() === code.toLowerCase());
  return match ?? null;
}
