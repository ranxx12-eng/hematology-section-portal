export const HIRE_DATE_NOT_RECORDED = 'Not recorded';

export function formatHireDateDisplay(hireDate: string | null | undefined, locale: string): string {
  if (!hireDate?.trim()) return HIRE_DATE_NOT_RECORDED;
  try {
    return new Date(hireDate).toLocaleDateString(locale);
  } catch {
    return HIRE_DATE_NOT_RECORDED;
  }
}

export function normalizeOptionalHireDate(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
