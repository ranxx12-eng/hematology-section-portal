/**
 * PHI / patient identifier masking utilities.
 * Use when full identifiers are not required for display.
 */

export function maskPatientId(value: string | null | undefined, visibleChars = 4): string {
  if (!value) return '—';
  if (value.length <= visibleChars) return '*'.repeat(value.length);
  return '*'.repeat(value.length - visibleChars) + value.slice(-visibleChars);
}

export function maskPatientName(value: string | null | undefined): string {
  if (!value) return '—';
  const parts = value.trim().split(/\s+/);
  return parts
    .map((part, i) => (i === 0 ? part.charAt(0) + '.'.repeat(Math.max(part.length - 1, 2)) : part.charAt(0) + '.'))
    .join(' ');
}

export function maskAccessionNumber(value: string | null | undefined): string {
  return maskPatientId(value, 3);
}

/** Strip PHI from error messages before displaying to users. */
export function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/\b[A-Z]{2,}-\d{4,}\b/g, '[REDACTED-ID]')
    .replace(/\b\d{10,}\b/g, '[REDACTED-NUM]');
}
