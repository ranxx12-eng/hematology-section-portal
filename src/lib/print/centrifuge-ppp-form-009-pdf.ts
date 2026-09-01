import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import {
  CENTRIFUGE_ASSET_CODE,
  CENTRIFUGE_NAME,
  CENTRIFUGE_SERIAL_NUMBER,
} from '@/lib/ppm-calibration/centrifuge-detection';
import {
  FORM_HEMA_009_FOOTER,
  FORM_HEMA_009_QID,
  FORM_HEMA_009_TITLE,
  formatPltResult,
  formatSampleLabel,
  PLT_ACCEPTANCE_THRESHOLD,
  PLT_UNIT,
} from '@/lib/ppm-calibration/centrifuge-ppp-logic';
import { getCentrifugePppSignedUrl } from '@/lib/clinical/centrifuge-ppp-calibration';
import { PRINT_PAGE_MARGIN_MM } from '@/lib/print/landscape-layout';
import {
  QC_PRINT_DEPARTMENT,
  QC_PRINT_HOSPITAL,
  QC_PRINT_SECTION,
} from '@/lib/print/qc-print-templates';
import { loadOfficialLogoForPdf } from '@/lib/portal/official-logo';
import type { CentrifugePppCalibration } from '@/types/centrifuge-ppp-calibration';
import type { Instrument } from '@/types';

async function loadLogoForPdf() {
  const { dataUrl, dimensions } = await loadOfficialLogoForPdf();
  if (!dataUrl || !dimensions) return null;
  return { dataUrl, ...dimensions };
}

function drawFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 8;
  doc.setLineWidth(0.2);
  doc.line(PRINT_PAGE_MARGIN_MM, footerY - 4, pageWidth - PRINT_PAGE_MARGIN_MM, footerY - 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(FORM_HEMA_009_FOOTER, PRINT_PAGE_MARGIN_MM, footerY);
  doc.text(FORM_HEMA_009_QID, pageWidth - PRINT_PAGE_MARGIN_MM, footerY, { align: 'right' });
}

async function createFormPageOne(
  calibration: CentrifugePppCalibration,
  instrument: Instrument,
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 10;

  const logo = await loadLogoForPdf();
  if (logo) {
    doc.addImage(logo.dataUrl, logo.format, pageWidth / 2 - logo.width / 2, 6, logo.width, logo.height);
    y = 24;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(QC_PRINT_HOSPITAL, pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(9.5);
  doc.text(QC_PRINT_DEPARTMENT, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text(QC_PRINT_SECTION, pageWidth / 2, y, { align: 'center' });
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(FORM_HEMA_009_TITLE, pageWidth / 2, y, { align: 'center' });
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const meta = [
    `Instrument: ${instrument.name ?? CENTRIFUGE_NAME}`,
    `Serial Number: ${instrument.serialNumber ?? CENTRIFUGE_SERIAL_NUMBER}`,
    `Asset Code: ${instrument.assetCode ?? CENTRIFUGE_ASSET_CODE}`,
    `Calibration Date: ${calibration.calibrationDate}`,
    `Acceptance Criteria: PLT ≤ ${PLT_ACCEPTANCE_THRESHOLD} ${PLT_UNIT}`,
  ];
  for (const line of meta) {
    doc.text(line, PRINT_PAGE_MARGIN_MM, y);
    y += 4.5;
  }

  const tableBody = calibration.samples
    .sort((a, b) => a.sampleNumber - b.sampleNumber)
    .map((sample) => [
      formatSampleLabel(sample.sampleNumber),
      sample.pltResult != null ? String(sample.pltResult) : '—',
      sample.centrifugeSpeedRpm != null ? String(sample.centrifugeSpeedRpm) : '—',
      sample.centrifugeTimeMinutes != null ? String(sample.centrifugeTimeMinutes) : '—',
      sample.calculatedResult?.toUpperCase() ?? '—',
      sample.evidencePath ? '✓ Attached' : 'Missing',
    ]);

  autoTable(doc, {
    startY: y + 2,
    head: [['No.', `PLT Result ${PLT_UNIT}`, 'Centrifuge Speed RPM', 'Time min', 'Result', 'Evidence']],
    body: tableBody,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    margin: { left: PRINT_PAGE_MARGIN_MM, right: PRINT_PAGE_MARGIN_MM },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Overall Result: ${calibration.overallResult?.toUpperCase() ?? '—'}`, PRINT_PAGE_MARGIN_MM, y);
  y += 6;

  if (calibration.overallResult === 'fail') {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Problem: ${calibration.problem ?? '—'}`, PRINT_PAGE_MARGIN_MM, y);
    y += 4.5;
    doc.text(`Corrective Action: ${calibration.correctiveAction ?? '—'}`, PRINT_PAGE_MARGIN_MM, y);
    y += 4.5;
    doc.text(`Comment: ${calibration.comment ?? '—'}`, PRINT_PAGE_MARGIN_MM, y);
    y += 6;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Review By — Senior Technologist', PRINT_PAGE_MARGIN_MM, y);
  doc.text('Approved By — Section Head', pageWidth / 2 + 5, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(`Decision: ${calibration.reviewDecision ?? calibration.reviewStatus}`, PRINT_PAGE_MARGIN_MM, y);
  doc.text(`Decision: ${calibration.approvalDecision ?? calibration.approvalStatus}`, pageWidth / 2 + 5, y);
  y += 4;
  doc.text(`Name: ${calibration.reviewedByName ?? '—'}`, PRINT_PAGE_MARGIN_MM, y);
  doc.text(`Name: ${calibration.approvedByName ?? '—'}`, pageWidth / 2 + 5, y);
  y += 4;
  doc.text(`Staff ID: ${calibration.reviewedByStaffId ?? '—'}`, PRINT_PAGE_MARGIN_MM, y);
  doc.text(`Staff ID: ${calibration.approvedByStaffId ?? '—'}`, pageWidth / 2 + 5, y);
  y += 4;
  doc.text(`Date: ${calibration.reviewedAt?.slice(0, 10) ?? '—'}`, PRINT_PAGE_MARGIN_MM, y);
  doc.text(`Date: ${calibration.approvedAt?.slice(0, 10) ?? '—'}`, pageWidth / 2 + 5, y);

  drawFooter(doc);
  return doc;
}

async function fetchFileBytes(path: string): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  const signedUrl = await getCentrifugePppSignedUrl(path);
  if (!signedUrl) return null;
  const response = await fetch(signedUrl);
  if (!response.ok) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  const mimeType = response.headers.get('content-type') ?? 'application/octet-stream';
  return { bytes, mimeType };
}

async function appendEvidencePages(
  mergedPdf: PDFDocument,
  calibration: CentrifugePppCalibration,
): Promise<void> {
  const samples = [...calibration.samples].sort((a, b) => a.sampleNumber - b.sampleNumber);

  for (const sample of samples) {
    if (!sample.evidencePath) continue;
    const file = await fetchFileBytes(sample.evidencePath);
    if (!file) continue;

    const headerPage = mergedPdf.addPage([595.28, 841.89]);
    const { height } = headerPage.getSize();
    headerPage.drawText(`${formatSampleLabel(sample.sampleNumber)} — Evidence`, { x: 40, y: height - 50, size: 14 });
    headerPage.drawText(`PLT Result: ${formatPltResult(sample.pltResult)}`, { x: 40, y: height - 70, size: 11 });

    if (file.mimeType.includes('pdf') || sample.evidenceName?.toLowerCase().endsWith('.pdf')) {
      const evidencePdf = await PDFDocument.load(file.bytes);
      const copiedPages = await mergedPdf.copyPages(evidencePdf, evidencePdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    } else {
      const page = mergedPdf.addPage([595.28, 841.89]);
      const { width, height: pageHeight } = page.getSize();
      try {
        const image = file.mimeType.includes('png')
          ? await mergedPdf.embedPng(file.bytes)
          : await mergedPdf.embedJpg(file.bytes);
        const maxWidth = width - 80;
        const maxHeight = pageHeight - 120;
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;
        page.drawImage(image, {
          x: (width - drawWidth) / 2,
          y: (pageHeight - drawHeight) / 2,
          width: drawWidth,
          height: drawHeight,
        });
      } catch {
        page.drawText('Evidence image could not be embedded.', { x: 40, y: pageHeight - 100, size: 10 });
      }
    }
  }
}

export async function createCentrifugePppForm009Pdf(
  calibration: CentrifugePppCalibration,
  instrument: Instrument,
): Promise<Uint8Array | null> {
  const formDoc = await createFormPageOne(calibration, instrument);
  const formBytes = formDoc.output('arraybuffer');

  const mergedPdf = await PDFDocument.create();
  const formPdf = await PDFDocument.load(formBytes);
  const formPages = await mergedPdf.copyPages(formPdf, formPdf.getPageIndices());
  formPages.forEach((page) => mergedPdf.addPage(page));

  await appendEvidencePages(mergedPdf, calibration);
  return mergedPdf.save();
}

export async function downloadCentrifugePppForm009Pdf(
  calibration: CentrifugePppCalibration,
  instrument: Instrument,
): Promise<void> {
  const bytes = await createCentrifugePppForm009Pdf(calibration, instrument);
  if (!bytes) return;
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Centrifuge-PPP-Calibration-${calibration.calibrationDate}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}
