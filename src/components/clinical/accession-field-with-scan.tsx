'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
};

interface AccessionFieldWithScanProps {
  id?: string;
  label?: string;
  value: string;
  disabled?: boolean;
  required?: boolean;
  onChange: (value: string) => void;
  onScanComplete?: (value: string) => void;
}

function isBarcodeDetectorSupported(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

export function AccessionFieldWithScan({
  id,
  label = 'Lab Accession',
  value,
  disabled = false,
  required = false,
  onChange,
  onScanComplete,
}: AccessionFieldWithScanProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanFrameRef = useRef<number | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const applyScanValue = useCallback(
    (rawValue: string) => {
      const trimmed = rawValue.trim();
      if (!trimmed) return;
      onChange(trimmed);
      onScanComplete?.(trimmed);
      setScanOpen(false);
      toast.success('Accession captured');
    },
    [onChange, onScanComplete],
  );

  const stopCamera = useCallback(() => {
    if (scanFrameRef.current !== null) {
      cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => {
    if (!scanOpen) {
      stopCamera();
      setScanError(null);
      return;
    }

    if (!isBarcodeDetectorSupported()) {
      setScanError('Camera barcode scanning is not supported in this browser. Type or use a USB scanner.');
      return;
    }

    let cancelled = false;

    const startScanner = async () => {
      setScanning(true);
      setScanError(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await video.play();

        const BarcodeDetectorCtor = (window as unknown as {
          BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
        }).BarcodeDetector;

        if (!BarcodeDetectorCtor) {
          setScanError('Camera barcode scanning is not supported in this browser. Type or use a USB scanner.');
          setScanning(false);
          return;
        }

        const detector = new BarcodeDetectorCtor({
          formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'itf', 'qr_code', 'codabar'],
        });

        const scanLoop = async () => {
          if (cancelled || !videoRef.current || videoRef.current.readyState < 2) {
            scanFrameRef.current = requestAnimationFrame(() => {
              void scanLoop();
            });
            return;
          }

          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              applyScanValue(barcodes[0].rawValue);
              return;
            }
          } catch {
            // Continue scanning until a readable frame is detected.
          }

          scanFrameRef.current = requestAnimationFrame(() => {
            void scanLoop();
          });
        };

        void scanLoop();
      } catch {
        setScanError('Unable to access camera. Enter the accession manually or use a USB scanner.');
        setScanning(false);
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [applyScanValue, scanOpen, stopCamera]);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? ' *' : ''}
      </Label>
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          id={id}
          value={value}
          disabled={disabled}
          required={required}
          placeholder="Enter or scan lab accession"
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && event.currentTarget.value.trim()) {
              onScanComplete?.(event.currentTarget.value.trim());
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          aria-label="Scan barcode"
          title="Scan barcode"
          onClick={() => {
            inputRef.current?.focus();
            setScanOpen(true);
          }}
        >
          <ScanLine className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Lab Accession</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Point the camera at the specimen barcode, or type the accession in the field and press Enter.
            </p>
          </DialogHeader>
          <div className="space-y-3">
            {scanError ? (
              <p className="text-sm text-muted-foreground">{scanError}</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border bg-black">
                <video ref={videoRef} className="h-56 w-full object-cover" muted playsInline />
              </div>
            )}
            {scanning && !scanError && (
              <p className="text-sm text-muted-foreground">Scanning…</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
