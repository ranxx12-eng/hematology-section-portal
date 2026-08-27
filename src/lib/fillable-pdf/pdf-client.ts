'use client';

let workerConfigured = false;

export async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (!workerConfigured && typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
    workerConfigured = true;
  }
  return pdfjs;
}

export async function fetchPdfArrayBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) throw new Error('Failed to load PDF template');
  return response.arrayBuffer();
}

export async function readPdfPageMetrics(data: ArrayBuffer, pageNumber = 1) {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  return {
    pageCount: doc.numPages,
    width: viewport.width,
    height: viewport.height,
  };
}
