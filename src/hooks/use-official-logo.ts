'use client';

import {
  OFFICIAL_HOSPITAL_LOGO_SRC,
  getOfficialLogoResolution,
} from '@/lib/portal/official-logo.constants';

export function useOfficialLogo() {
  const resolution = getOfficialLogoResolution();

  return {
    src: OFFICIAL_HOSPITAL_LOGO_SRC,
    resolution,
    loading: false,
    failed: false,
  };
}
