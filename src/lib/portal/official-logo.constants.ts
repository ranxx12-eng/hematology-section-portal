/** Single source of truth for the official hospital logo across the portal. */
export const OFFICIAL_HOSPITAL_LOGO_SRC = '/images/portal/official-hospital-logo.png';

export const OFFICIAL_HOSPITAL_LOGO_MIME_TYPE = 'image/png';

export interface OfficialLogoResolution {
  url: string;
  mimeType: string;
  source: 'static';
}

export function getOfficialLogoResolution(): OfficialLogoResolution {
  return {
    url: OFFICIAL_HOSPITAL_LOGO_SRC,
    mimeType: OFFICIAL_HOSPITAL_LOGO_MIME_TYPE,
    source: 'static',
  };
}
