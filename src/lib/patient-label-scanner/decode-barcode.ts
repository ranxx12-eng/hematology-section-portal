import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from '@zxing/library';

const HINTS = new Map<DecodeHintType, unknown>([
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
      BarcodeFormat.CODABAR,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
    ],
  ],
  [DecodeHintType.TRY_HARDER, true],
]);

const READER = new MultiFormatReader();
READER.setHints(HINTS);

export async function decodeBarcodeFromCanvas(canvas: HTMLCanvasElement): Promise<string | null> {
  const ctx = canvas.getContext('2d');
  if (!ctx || canvas.width <= 0 || canvas.height <= 0) return null;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const source = new RGBLuminanceSource(imageData.data, canvas.width, canvas.height);
  const bitmap = new BinaryBitmap(new HybridBinarizer(source));

  try {
    const result = READER.decode(bitmap);
    const raw = result.getText()?.trim();
    return raw || null;
  } catch {
    return null;
  }
}
