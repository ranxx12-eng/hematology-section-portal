/** Canonical live-view slugs mapped to instrument names (mirrors DB live_view_slug). */
export const QC_LIVE_SLUG_BY_NAME: Record<string, string> = {
  'Alinity HQ 1147': 'alinity-hq-1147',
  'Alinity HQ 1149': 'alinity-hq-1149',
  'Stago STA R MAX3': 'stago-sta-r-max3',
  'Alifax Test1': 'alifax-test1',
  'Manual Test': 'manual-test',
};

export const QC_LIVE_SLUGS = Object.values(QC_LIVE_SLUG_BY_NAME);

export function isValidQCLiveSlug(slug: string): boolean {
  return QC_LIVE_SLUGS.includes(slug);
}

export function getLiveViewPath(locale: string, slug: string): string {
  return `/${locale}/qc-live/${slug}`;
}

export function getLiveViewUrl(locale: string, slug: string, baseUrl?: string): string {
  const base = (baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}${getLiveViewPath(locale, slug)}`;
}
