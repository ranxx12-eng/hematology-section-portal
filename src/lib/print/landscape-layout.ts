export const PRINT_PAGE_MARGIN_MM = 12;

export const PRINT_LANDSCAPE_PAGE = {
  orientation: 'landscape' as const,
  unit: 'mm' as const,
  format: 'a4' as const,
};

export function getLandscapeTableWidth(pageWidthMm: number, marginMm = PRINT_PAGE_MARGIN_MM): number {
  return pageWidthMm - marginMm * 2;
}
