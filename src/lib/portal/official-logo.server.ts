import 'server-only';

import { getOfficialLogoResolution, type OfficialLogoResolution } from '@/lib/portal/official-logo.constants';

export async function resolveOfficialLogo(): Promise<OfficialLogoResolution> {
  return getOfficialLogoResolution();
}
