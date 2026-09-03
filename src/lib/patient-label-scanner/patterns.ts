/**
 * Configurable hematology sample label patterns.
 * Accession example shape: C2601040291-1 (letter + digits + hyphen + suffix).
 */
export interface PatientLabelPatterns {
  /** Match accession anywhere in OCR text. */
  labAccessionInline: RegExp;
  /** Match accession as a whole line. */
  labAccessionLine: RegExp;
  /** Date/time fragment often on the same line as patient ID. */
  dateTimeFragment: RegExp;
  /** Numeric patient / MRN identifier. */
  patientId: RegExp;
  /** Minimum characters for a candidate patient name line. */
  minPatientNameLength: number;
}

export const DEFAULT_PATIENT_LABEL_PATTERNS: PatientLabelPatterns = {
  labAccessionInline: /[A-Z]\d{8,12}-\d+/gi,
  labAccessionLine: /^[A-Z]\d{8,12}-\d+$/i,
  dateTimeFragment: /\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}(?:\s+\d{1,2}:\d{2})?/,
  patientId: /\b(\d{5,9})\b/,
  minPatientNameLength: 4,
};

export function normalizeOcrLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

export function looksLikePatientName(line: string, patterns: PatientLabelPatterns): boolean {
  const trimmed = normalizeOcrLine(line);
  if (trimmed.length < patterns.minPatientNameLength) return false;
  if (patterns.labAccessionLine.test(trimmed)) return false;
  if (patterns.dateTimeFragment.test(trimmed) && !/[A-Za-z]{3,}/.test(trimmed)) return false;
  const alphaChars = trimmed.replace(/[^A-Za-z\s'-]/g, '');
  if (alphaChars.length < patterns.minPatientNameLength) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length >= 1 && words.every((word) => /^[A-Za-z'-]+$/.test(word) || word.length <= 2);
}

export function extractAccessionCandidates(text: string, patterns: PatientLabelPatterns): string[] {
  const matches = text.match(patterns.labAccessionInline) ?? [];
  return [...new Set(matches.map((m) => m.toUpperCase()))];
}
