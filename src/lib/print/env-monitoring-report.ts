import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';
import { loadOfficialLogoForPdf } from '@/lib/portal/official-logo';
import { printTimestamp, printValue } from '@/lib/print/report-value';
import { ENVIRONMENTAL_READING_STATUS_LABELS } from '@/lib/environmental-monitoring/constants';
import type { MonthlyComplianceSummary } from '@/lib/environmental-monitoring/compliance';
import type {
  EnvironmentalAsset,
  EnvironmentalExcursion,
  EnvironmentalMonitoringWindow,
  EnvironmentalReading,
  EnvironmentalReadingCorrection,
} from '@/types/environmental-monitoring';

export const ENV_MONITORING_REPORT_HOSPITAL = 'AL SAHAFA HOSPITAL';
export const ENV_MONITORING_REPORT_DEPARTMENT = 'LABORATORY DEPARTMENT';
export const ENV_MONITORING_REPORT_TITLE = 'Environmental Monitoring Monthly Log';

interface MonthlyReportInput {
  assets: EnvironmentalAsset[];
  windows: EnvironmentalMonitoringWindow[];
  readings: EnvironmentalReading[];
  excursions: EnvironmentalExcursion[];
  corrections: EnvironmentalReadingCorrection[];
  month: number;
  year: number;
  summary: MonthlyComplianceSummary;
  locale: string;
}

function monthLabel(month: number, year: number, locale: string): string {
  return new Date(year, month - 1, 1).toLocaleString(locale, { month: 'long', year: 'numeric' });
}

export async function createEnvironmentalMonthlyReportPdf(input: MonthlyReportInput): Promise<jsPDF | null> {
  const { assets, readings, excursions, corrections, month, year, summary, locale } = input;
  if (assets.length === 0) return null;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const logo = await loadOfficialLogoForPdf();
  const margin = 12;
  let y = margin;

  if (logo.dataUrl && logo.dimensions) {
    doc.addImage(logo.dataUrl, logo.dimensions.format, margin, y, 18, 18);
  }

  doc.setFontSize(11);
  doc.text(ENV_MONITORING_REPORT_HOSPITAL, margin + 22, y + 5);
  doc.text(ENV_MONITORING_REPORT_DEPARTMENT, margin + 22, y + 11);
  doc.setFontSize(14);
  doc.text(ENV_MONITORING_REPORT_TITLE, margin + 22, y + 18);
  y += 26;

  const primaryAsset = assets[0];
  doc.setFontSize(10);
  doc.text(`Asset: ${assets.length === 1 ? primaryAsset.assetName : 'All monitored assets'}`, margin, y);
  y += 5;
  if (assets.length === 1) {
    doc.text(`Asset Code: ${printValue(primaryAsset.assetCode)}`, margin, y);
    y += 5;
    doc.text(`Location: ${printValue(primaryAsset.location)}`, margin, y);
    y += 5;
    doc.text(`Acceptable Range: ${primaryAsset.minTemperature}°C – ${primaryAsset.maxTemperature}°C`, margin, y);
    y += 5;
  }
  doc.text(`Month: ${monthLabel(month, year, locale)}`, margin, y);
  y += 8;

  const correctionMap = Object.fromEntries(
    corrections.map((correction) => [correction.readingId, correction]),
  );
  const excursionMap = Object.fromEntries(
    excursions.map((excursion) => [excursion.readingId, excursion]),
  );

  const monthReadings = readings.filter((reading) => {
    if (reading.voidedAt) return false;
    const recorded = new Date(reading.recordedAt);
    if (recorded.getMonth() + 1 !== month || recorded.getFullYear() !== year) return false;
    if (assets.length === 1) return reading.assetId === primaryAsset.id;
    return assets.some((asset) => asset.id === reading.assetId);
  });

  const rows = monthReadings.map((reading) => {
    const correction = correctionMap[reading.id];
    const excursion = excursionMap[reading.id];
    const asset = assets.find((item) => item.id === reading.assetId);
    const temperature = correction
      ? `${correction.previousTemperature} → ${correction.newTemperature}`
      : String(reading.temperature);
    return [
      printTimestamp(reading.recordedAt),
      printValue(asset?.assetCode),
      temperature,
      reading.humidity != null ? `${reading.humidity}%` : '—',
      ENVIRONMENTAL_READING_STATUS_LABELS[reading.calculatedStatus],
      printValue(reading.performedByName),
      printValue(reading.performedByStaffId),
      printValue(excursion?.immediateAction),
      printValue(excursion?.reviewedByName),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [[
      'Date',
      'Asset',
      'Temperature',
      'Humidity',
      'Status',
      'Performed By',
      'Staff ID',
      'Corrective Action / Excursion',
      'Reviewed By',
    ]],
    body: rows.length > 0 ? rows : [['—', '—', '—', '—', '—', '—', '—', '—', '—']],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 64, 110] },
    margin: { left: margin, right: margin },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
  doc.setFontSize(10);
  doc.text(`Monthly Compliance: ${summary.compliancePercent}%`, margin, finalY + 8);
  doc.text(`Total Required Readings: ${summary.requiredReadings}`, margin, finalY + 14);
  doc.text(`Completed: ${summary.completedReadings}`, margin + 70, finalY + 14);
  doc.text(`Missing: ${summary.missingReadings}`, margin + 120, finalY + 14);
  doc.text(`Out of Range: ${summary.outOfRangeReadings}`, margin + 160, finalY + 14);
  doc.text(`Excursions: ${summary.excursions}`, margin + 210, finalY + 14);

  doc.text('Review Section', margin, finalY + 24);
  doc.text('Reviewed By: __________________________', margin, finalY + 30);
  doc.text('Staff ID: __________________________', margin + 90, finalY + 30);
  doc.text('Reviewed At: __________________________', margin + 170, finalY + 30);
  doc.text('Comments: ________________________________________________________________', margin, finalY + 36);

  return doc;
}
