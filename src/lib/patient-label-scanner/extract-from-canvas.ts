import { parseLabelText } from './parse-label-text';
import type { PatientLabelScanResult } from './types';

let decodeBarcodeFromCanvas: typeof import('./decode-barcode').decodeBarcodeFromCanvas;
let recognizeTextFromCanvas: typeof import('./recognize-text').recognizeTextFromCanvas;

async function loadDecoders() {
  if (!decodeBarcodeFromCanvas || !recognizeTextFromCanvas) {
    const [barcodeMod, ocrMod] = await Promise.all([
      import('./decode-barcode'),
      import('./recognize-text'),
    ]);
    decodeBarcodeFromCanvas = barcodeMod.decodeBarcodeFromCanvas;
    recognizeTextFromCanvas = ocrMod.recognizeTextFromCanvas;
  }
}

/**
 * Process a single captured frame in-memory.
 * Canvas/image data is not retained after this function returns.
 */
export async function extractPatientLabelFromCanvas(
  canvas: HTMLCanvasElement,
): Promise<PatientLabelScanResult> {
  await loadDecoders();

  const barcodeValue = await decodeBarcodeFromCanvas(canvas);
  const ocrText = await recognizeTextFromCanvas(canvas);

  const result = parseLabelText(ocrText, { barcodeAccession: barcodeValue ?? undefined });

  // Explicitly release canvas pixel buffer reference after processing.
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  canvas.width = 0;
  canvas.height = 0;

  return result;
}

export function captureVideoFrame(video: HTMLVideoElement): HTMLCanvasElement | null {
  if (video.videoWidth <= 0 || video.videoHeight <= 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}
