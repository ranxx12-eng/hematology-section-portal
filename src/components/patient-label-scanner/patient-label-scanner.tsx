'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ScanLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  captureVideoFrame,
  detachVideoElement,
  extractPatientLabelFromCanvas,
  isCameraSupported,
  startCameraPreview,
  stopCameraStream,
  getConfidenceLabel,
  getConfidenceLevel,
  PATIENT_LABEL_SCAN_AUDIT_ACTION,
  type PatientLabelField,
  type PatientLabelScanResult,
} from '@/lib/patient-label-scanner';

type ScannerStep = 'camera' | 'processing' | 'review' | 'replace-confirm';

export interface PatientLabelScannerProps {
  disabled?: boolean;
  fields?: PatientLabelField[];
  currentValues?: Partial<Record<PatientLabelField, string>>;
  onApply: (result: PatientLabelScanResult) => void;
  onAudit?: (action: typeof PATIENT_LABEL_SCAN_AUDIT_ACTION) => void;
  className?: string;
}

const FIELD_LABELS: Record<PatientLabelField, string> = {
  patientName: 'Patient Name',
  patientId: 'Patient ID / MRN',
  labAccession: 'Lab Accession',
};

const DEFAULT_FIELDS: PatientLabelField[] = ['patientName', 'patientId', 'labAccession'];

function hasExistingPatientData(
  currentValues: Partial<Record<PatientLabelField, string>> | undefined,
  fields: PatientLabelField[],
): boolean {
  if (!currentValues) return false;
  return fields.some((field) => currentValues[field]?.trim());
}

function buildApplyPayload(
  scanResult: PatientLabelScanResult,
  fields: PatientLabelField[],
): PatientLabelScanResult {
  const payload: PatientLabelScanResult = {
    confidence: {},
    sources: {},
  };

  for (const field of fields) {
    const value = scanResult[field];
    if (value) {
      payload[field] = value;
      payload.confidence![field] = scanResult.confidence?.[field];
      payload.sources![field] = scanResult.sources?.[field];
    }
  }

  return payload;
}

function ScanFieldRow({
  field,
  value,
  confidence,
  source,
}: {
  field: PatientLabelField;
  value?: string;
  confidence?: number;
  source?: 'ocr' | 'barcode';
}) {
  const level = getConfidenceLevel(confidence);
  const detected = Boolean(value?.trim());

  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {FIELD_LABELS[field]}
          </p>
          <p className={cn('mt-1 text-sm font-medium break-words', !detected && 'text-muted-foreground')}>
            {detected ? value : 'Not detected'}
          </p>
        </div>
        {detected && (
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
              level === 'high' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
              level === 'verify' && 'bg-amber-500/10 text-amber-800 dark:text-amber-300',
              level === 'low' && 'bg-amber-500/10 text-amber-800 dark:text-amber-300',
            )}
          >
            {level === 'high' ? (
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            )}
            {getConfidenceLabel(level, source)}
          </span>
        )}
      </div>
    </div>
  );
}

export function PatientLabelScanner({
  disabled = false,
  fields = DEFAULT_FIELDS,
  currentValues,
  onApply,
  onAudit,
  className,
}: PatientLabelScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ScannerStep>('camera');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<PatientLabelScanResult | null>(null);
  const [pendingApply, setPendingApply] = useState<PatientLabelScanResult | null>(null);

  const stopCamera = useCallback(() => {
    stopCameraStream(streamRef.current);
    streamRef.current = null;
    detachVideoElement(videoRef.current);
  }, []);

  const resetScanner = useCallback(() => {
    stopCamera();
    setStep('camera');
    setCameraError(null);
    setProcessingError(null);
    setScanResult(null);
    setPendingApply(null);
  }, [stopCamera]);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) resetScanner();
  }, [resetScanner]);

  useEffect(() => {
    if (!open || step !== 'camera') return undefined;

    if (!isCameraSupported()) {
      setCameraError('Camera is not available on this device. Enter patient information manually.');
      return undefined;
    }

    let cancelled = false;

    void (async () => {
      setCameraError(null);
      try {
        const video = videoRef.current;
        if (!video) return;
        const stream = await startCameraPreview(video);
        if (cancelled) {
          stopCameraStream(stream);
          return;
        }
        streamRef.current = stream;
      } catch {
        if (!cancelled) {
          setCameraError('Camera permission denied or unavailable. Enter information manually.');
        }
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, step, stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video) return;

    setStep('processing');
    setProcessingError(null);
    stopCamera();

    const canvas = captureVideoFrame(video);
    if (!canvas) {
      setProcessingError('Label could not be read. Please retake the image or enter the information manually.');
      setStep('camera');
      return;
    }

    try {
      const result = await extractPatientLabelFromCanvas(canvas);
      const hasAnyField = fields.some((field) => result[field]?.trim());

      if (!hasAnyField) {
        setProcessingError('Label could not be read. Please retake the image or enter the information manually.');
        setStep('camera');
        return;
      }

      setScanResult(result);
      setStep('review');
    } catch {
      setProcessingError('Label could not be read. Please retake the image or enter the information manually.');
      setStep('camera');
    }
  };

  const finalizeApply = (result: PatientLabelScanResult) => {
    onApply(result);
    onAudit?.(PATIENT_LABEL_SCAN_AUDIT_ACTION);
    handleOpenChange(false);
  };

  const handleApply = () => {
    if (!scanResult) return;
    const payload = buildApplyPayload(scanResult, fields);

    if (hasExistingPatientData(currentValues, fields)) {
      setPendingApply(payload);
      setStep('replace-confirm');
      return;
    }

    finalizeApply(payload);
  };

  const handleRetake = () => {
    setScanResult(null);
    setProcessingError(null);
    setStep('camera');
  };

  const detectedCount = scanResult
    ? fields.filter((field) => scanResult[field]?.trim()).length
    : 0;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        className={cn('gap-2', className)}
        onClick={() => setOpen(true)}
      >
        <ScanLine className="h-4 w-4" aria-hidden="true" />
        Scan Sample Label
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="border-b border-border/60 px-5 py-4">
            <DialogTitle className="text-lg font-semibold">
              {step === 'replace-confirm' ? 'Replace existing information?' : 'Scan Sample Label'}
            </DialogTitle>
            {step === 'camera' && (
              <p className="text-sm text-muted-foreground">
                Position the full sample label inside the frame.
              </p>
            )}
          </DialogHeader>

          <div className="space-y-4 px-5 py-4">
            {step === 'camera' && (
              <>
                {cameraError ? (
                  <p className="text-sm text-muted-foreground">{cameraError}</p>
                ) : (
                  <div className="overflow-hidden rounded-2xl border-2 border-primary/20 bg-black">
                    <video
                      ref={videoRef}
                      className="aspect-[4/3] w-full object-cover"
                      muted
                      playsInline
                      autoPlay
                    />
                  </div>
                )}
                {processingError && (
                  <p className="text-sm text-amber-700 dark:text-amber-300">{processingError}</p>
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    className="flex-1 gap-2"
                    disabled={Boolean(cameraError)}
                    onClick={() => void handleCapture()}
                  >
                    <Camera className="h-4 w-4" />
                    Capture
                  </Button>
                  <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                    Cancel
                  </Button>
                </div>
              </>
            )}

            {step === 'processing' && (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">Reading label…</p>
              </div>
            )}

            {step === 'review' && scanResult && (
              <>
                <div>
                  <h4 className="text-sm font-semibold">Scanned Information</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {detectedCount} of {fields.length} field{fields.length === 1 ? '' : 's'} detected — review before applying.
                  </p>
                </div>
                <div className="space-y-2">
                  {fields.map((field) => (
                    <ScanFieldRow
                      key={field}
                      field={field}
                      value={scanResult[field]}
                      confidence={scanResult.confidence?.[field]}
                      source={scanResult.sources?.[field]}
                    />
                  ))}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" className="flex-1" onClick={handleApply}>
                    Apply to Form
                  </Button>
                  <Button type="button" variant="outline" onClick={handleRetake}>
                    Retake
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                    Cancel
                  </Button>
                </div>
              </>
            )}

            {step === 'replace-confirm' && pendingApply && (
              <>
                <p className="text-sm text-muted-foreground">
                  This form already contains patient information. Replace it with scanned values?
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" className="flex-1" onClick={() => finalizeApply(pendingApply)}>
                    Replace
                  </Button>
                  <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                    Keep Current
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setPendingApply(null);
                      setStep('review');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
