export type PatientLabelField = 'patientName' | 'patientId' | 'labAccession';

export type ExtractionSource = 'ocr' | 'barcode';

export interface FieldExtraction<T extends PatientLabelField = PatientLabelField> {
  field: T;
  value: string;
  confidence: number;
  source: ExtractionSource;
}

export interface PatientLabelScanResult {
  patientName?: string;
  patientId?: string;
  labAccession?: string;
  confidence?: Partial<Record<PatientLabelField, number>>;
  sources?: Partial<Record<PatientLabelField, ExtractionSource>>;
  extractions?: FieldExtraction[];
}

export type ConfidenceLevel = 'high' | 'verify' | 'low';

export function getConfidenceLevel(score: number | undefined): ConfidenceLevel {
  if (score === undefined) return 'low';
  if (score >= 0.85) return 'high';
  if (score >= 0.7) return 'verify';
  return 'low';
}

export function getConfidenceLabel(level: ConfidenceLevel, source?: ExtractionSource): string {
  if (level === 'high' && source === 'barcode') return 'Barcode detected';
  if (level === 'high') return 'High confidence';
  if (level === 'verify') return 'Verify';
  return 'Verify scanned value';
}

/** Non-PHI audit event label — safe to log. */
export const PATIENT_LABEL_SCAN_AUDIT_ACTION = 'Patient label scan used';
