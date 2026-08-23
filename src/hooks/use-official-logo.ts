'use client';

import { useEffect, useState } from 'react';
import {
  FALLBACK_LOGO_SRC,
  fetchOfficialLogoResolution,
  type OfficialLogoResolution,
} from '@/lib/portal/official-logo';

let cachedResolution: OfficialLogoResolution | null = null;
let inflight: Promise<OfficialLogoResolution> | null = null;

async function getOfficialLogoResolution(): Promise<OfficialLogoResolution> {
  if (cachedResolution) return cachedResolution;
  if (!inflight) {
    inflight = fetchOfficialLogoResolution().then((resolution) => {
      cachedResolution = resolution;
      inflight = null;
      return resolution;
    });
  }
  return inflight;
}

export function useOfficialLogo() {
  const [resolution, setResolution] = useState<OfficialLogoResolution>(() => ({
    url: cachedResolution?.url ?? FALLBACK_LOGO_SRC,
    assetId: cachedResolution?.assetId ?? null,
    assetName: cachedResolution?.assetName ?? null,
    storagePath: cachedResolution?.storagePath ?? null,
    mimeType: cachedResolution?.mimeType ?? null,
    source: cachedResolution?.source ?? 'fallback',
  }));
  const [loading, setLoading] = useState(!cachedResolution);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    void getOfficialLogoResolution()
      .then((next) => {
        if (!active) return;
        setResolution(next);
        setFailed(next.source === 'fallback' && next.url === FALLBACK_LOGO_SRC && next.assetId === null);
      })
      .catch(() => {
        if (!active) return;
        setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return {
    src: resolution.url,
    resolution,
    loading,
    failed,
  };
}
