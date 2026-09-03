/** Lazy-loaded Tesseract OCR — runs fully in-browser; no image leaves the device. */
export async function recognizeTextFromCanvas(canvas: HTMLCanvasElement): Promise<string> {
  const { recognize } = await import('tesseract.js');
  const { data } = await recognize(canvas, 'eng', {
    logger: () => {
      // Intentionally silent — do not log OCR progress or text (PHI).
    },
  });
  return data.text ?? '';
}
