/**
 * Input sanitization for rich text and user-provided strings.
 */

const HTML_TAG_PATTERN = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
const SCRIPT_PATTERN = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const EVENT_HANDLER_PATTERN = /\s(on\w+)\s*=\s*("[^"]*"|'[^']*'|\S+)/gi;

export function stripHtml(value: string): string {
  return value.replace(HTML_TAG_PATTERN, '').trim();
}

export function sanitizeRichText(value: string): string {
  let sanitized = value.replace(SCRIPT_PATTERN, '');
  sanitized = sanitized.replace(EVENT_HANDLER_PATTERN, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  return sanitized.trim();
}

export function sanitizePlainText(value: string, maxLength = 10_000): string {
  return stripHtml(value).slice(0, maxLength);
}
