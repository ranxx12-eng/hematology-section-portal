/** Normalized coordinates (0–1) relative to page width/height, origin top-left. */

export interface NormalizedRect {
  pageNumber: number;
  posX: number;
  posY: number;
  width: number;
  height: number;
}

export interface PixelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function normalizedToPixels(
  rect: NormalizedRect,
  pageWidthPx: number,
  pageHeightPx: number,
): PixelRect {
  return {
    left: rect.posX * pageWidthPx,
    top: rect.posY * pageHeightPx,
    width: rect.width * pageWidthPx,
    height: rect.height * pageHeightPx,
  };
}

export function pixelsToNormalized(
  rect: PixelRect,
  pageNumber: number,
  pageWidthPx: number,
  pageHeightPx: number,
): NormalizedRect {
  return {
    pageNumber,
    posX: clamp(rect.left / pageWidthPx, 0, 1),
    posY: clamp(rect.top / pageHeightPx, 0, 1),
    width: clamp(rect.width / pageWidthPx, 0.01, 1),
    height: clamp(rect.height / pageHeightPx, 0.01, 1),
  };
}

/** Convert normalized top-left rect to PDF points (origin bottom-left). */
export function normalizedToPdfPoints(
  rect: NormalizedRect,
  pageWidthPt: number,
  pageHeightPt: number,
): { x: number; y: number; width: number; height: number } {
  const width = rect.width * pageWidthPt;
  const height = rect.height * pageHeightPt;
  const x = rect.posX * pageWidthPt;
  const y = pageHeightPt - (rect.posY + rect.height) * pageHeightPt;
  return { x, y, width, height };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampNormalizedRect(rect: NormalizedRect): NormalizedRect {
  const posX = clamp(rect.posX, 0, 1);
  const posY = clamp(rect.posY, 0, 1);
  const width = clamp(rect.width, 0.01, 1 - posX);
  const height = clamp(rect.height, 0.01, 1 - posY);
  return { ...rect, posX, posY, width, height };
}
