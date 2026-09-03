import {
  DEFAULT_PATIENT_LABEL_PATTERNS,
  extractAccessionCandidates,
  looksLikePatientName,
  normalizeOcrLine,
  type PatientLabelPatterns,
} from './patterns';
import type { FieldExtraction, PatientLabelScanResult } from './types';

export interface ParseLabelTextOptions {
  patterns?: PatientLabelPatterns;
  barcodeAccession?: string;
}

function isAccessionLikeNumber(value: string): boolean {
  return /^[A-Z]?\d{8,}/i.test(value);
}

function parsePatientIdFromLines(lines: string[], patterns: PatientLabelPatterns): FieldExtraction | undefined {
  for (const rawLine of lines) {
    const line = normalizeOcrLine(rawLine);
    if (!patterns.dateTimeFragment.test(line)) continue;

    const match = line.match(patterns.patientId);
    if (!match?.[1]) continue;
    const candidate = match[1];
    if (isAccessionLikeNumber(candidate)) continue;

    return {
      field: 'patientId',
      value: candidate,
      confidence: 0.82,
      source: 'ocr',
    };
  }

  for (const rawLine of lines) {
    const line = normalizeOcrLine(rawLine);
    if (patterns.labAccessionLine.test(line)) continue;
    if (patterns.dateTimeFragment.test(line)) continue;
    if (!/^\d{5,9}$/.test(line)) continue;

    return {
      field: 'patientId',
      value: line,
      confidence: 0.68,
      source: 'ocr',
    };
  }

  return undefined;
}

function parsePatientNameFromLines(
  lines: string[],
  patterns: PatientLabelPatterns,
  excludeValues: Set<string>,
): FieldExtraction | undefined {
  for (const rawLine of lines) {
    const line = normalizeOcrLine(rawLine);
    if (!looksLikePatientName(line, patterns)) continue;
    const upper = line.toUpperCase();
    if (excludeValues.has(upper)) continue;

    const wordCount = line.split(/\s+/).filter(Boolean).length;
    const confidence = wordCount >= 2 ? 0.8 : 0.72;

    return {
      field: 'patientName',
      value: upper,
      confidence,
      source: 'ocr',
    };
  }

  return undefined;
}

function parseAccessionFromText(
  text: string,
  patterns: PatientLabelPatterns,
  barcodeAccession?: string,
): FieldExtraction | undefined {
  if (barcodeAccession?.trim()) {
    return {
      field: 'labAccession',
      value: barcodeAccession.trim().toUpperCase(),
      confidence: 0.95,
      source: 'barcode',
    };
  }

  const lines = text.split(/\r?\n/).map(normalizeOcrLine).filter(Boolean);
  for (const line of lines) {
    if (patterns.labAccessionLine.test(line)) {
      return {
        field: 'labAccession',
        value: line.toUpperCase(),
        confidence: 0.88,
        source: 'ocr',
      };
    }
  }

  const candidates = extractAccessionCandidates(text, patterns);
  if (candidates.length === 1) {
    return {
      field: 'labAccession',
      value: candidates[0]!,
      confidence: 0.78,
      source: 'ocr',
    };
  }

  if (candidates.length > 1) {
    return {
      field: 'labAccession',
      value: candidates[0]!,
      confidence: 0.65,
      source: 'ocr',
    };
  }

  return undefined;
}

/** Parse OCR text and optional barcode accession into structured scan result. Pure — no PHI logging. */
export function parseLabelText(
  ocrText: string,
  options: ParseLabelTextOptions = {},
): PatientLabelScanResult {
  const patterns = options.patterns ?? DEFAULT_PATIENT_LABEL_PATTERNS;
  const lines = ocrText.split(/\r?\n/).map(normalizeOcrLine).filter(Boolean);

  const extractions: FieldExtraction[] = [];

  const accession = parseAccessionFromText(ocrText, patterns, options.barcodeAccession);
  if (accession) extractions.push(accession);

  const exclude = new Set(extractions.map((e) => e.value.toUpperCase()));

  const patientId = parsePatientIdFromLines(lines, patterns);
  if (patientId) {
    extractions.push(patientId);
    exclude.add(patientId.value);
  }

  const patientName = parsePatientNameFromLines(lines, patterns, exclude);
  if (patientName) extractions.push(patientName);

  const result: PatientLabelScanResult = { extractions };

  for (const extraction of extractions) {
    result[extraction.field] = extraction.value;
    result.confidence ??= {};
    result.sources ??= {};
    result.confidence[extraction.field] = extraction.confidence;
    result.sources[extraction.field] = extraction.source;
  }

  return result;
}

export function mergeScanResults(
  primary: PatientLabelScanResult,
  secondary: PatientLabelScanResult,
): PatientLabelScanResult {
  const fields: Array<'patientName' | 'patientId' | 'labAccession'> = [
    'patientName',
    'patientId',
    'labAccession',
  ];

  const merged: PatientLabelScanResult = {
    confidence: { ...secondary.confidence, ...primary.confidence },
    sources: { ...secondary.sources, ...primary.sources },
    extractions: [...(secondary.extractions ?? []), ...(primary.extractions ?? [])],
  };

  for (const field of fields) {
    const primaryValue = primary[field];
    const secondaryValue = secondary[field];
    const primaryConf = primary.confidence?.[field] ?? 0;
    const secondaryConf = secondary.confidence?.[field] ?? 0;

    if (primaryValue && (!secondaryValue || primaryConf >= secondaryConf)) {
      merged[field] = primaryValue;
      merged.confidence![field] = primaryConf;
      merged.sources![field] = primary.sources?.[field];
    } else if (secondaryValue) {
      merged[field] = secondaryValue;
      merged.confidence![field] = secondaryConf;
      merged.sources![field] = secondary.sources?.[field];
    }
  }

  return merged;
}
