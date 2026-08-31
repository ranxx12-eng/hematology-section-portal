import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';
import {
  formatOutOfRangeParametersLabel,
  formatPerformerInitials,
  resolveReadingWindowInstance,
} from '@/lib/environmental-monitoring/compliance';
import { ENVIRONMENTAL_REVIEW_DECISION_LABELS } from '@/lib/environmental-monitoring/constants';
import { loadOfficialLogoForPdf } from '@/lib/portal/official-logo';
import {
  ENVIRONMENTAL_PRINT_DEPARTMENT,
  ENVIRONMENTAL_PRINT_HOSPITAL,
  getEnvironmentalPrintTemplate,
  OFFICIAL_SHIFT_LABELS,
  type EnvironmentalPrintTemplateConfig,
} from '@/lib/print/environmental-print-templates';
import { printTimestamp, printValue } from '@/lib/print/report-value';
import type {
  EnvironmentalAsset,
  EnvironmentalExcursion,
  EnvironmentalMonitoringWindow,
  EnvironmentalReading,
  EnvironmentalReadingCorrection,
} from '@/types/environmental-monitoring';

const PAGE_MARGIN = 10;
const FOOTER_BLOCK_MM = 16;

interface ControlledFormInput {
  asset: EnvironmentalAsset;
  windows: EnvironmentalMonitoringWindow[];
  readings: EnvironmentalReading[];
  excursions: EnvironmentalExcursion[];
  corrections: EnvironmentalReadingCorrection[];
  month: number;
  year: number;
  locale: string;
}

interface DayShiftCell {
  temperature?: string;
  humidity?: string;
  initials?: string;
}

type MonthlyGrid = Record<number, Record<string, DayShiftCell>>;

async function loadLogo() {
  const { dataUrl, dimensions } = await loadOfficialLogoForPdf();
  if (!dataUrl || !dimensions) return null;
  return { dataUrl, format: dimensions.format, width: dimensions.width, height: dimensions.height };
}

function monthYearLabel(month: number, year: number, locale: string): string {
  return new Date(year, month - 1, 1).toLocaleString(locale, { month: 'long', year: 'numeric' });
}

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function buildMonthlyGrid(input: ControlledFormInput): MonthlyGrid {
  const grid: MonthlyGrid = {};
  const assetWindows = input.windows.filter((window) => window.assetId === input.asset.id && window.active);
  const monthReadings = input.readings.filter((reading) => {
    if (reading.voidedAt || reading.assetId !== input.asset.id) return false;
    const recorded = new Date(reading.recordedAt);
    return recorded.getMonth() + 1 === input.month && recorded.getFullYear() === input.year;
  });

  for (const reading of monthReadings) {
    const instance = resolveReadingWindowInstance(reading, assetWindows);
    if (!instance) continue;

    const day = Number(instance.operationalDayKey.split('-')[2]);
    const correction = input.corrections.find((item) => item.readingId === reading.id);
    const temperature = correction ? String(correction.newTemperature) : String(reading.temperature);
    const humidity = correction?.newHumidity ?? reading.humidity;

    grid[day] ??= {};
    grid[day][instance.window.windowName] = {
      temperature,
      humidity: humidity != null ? String(humidity) : undefined,
      initials: formatPerformerInitials(reading.performedByName, reading.performedByStaffId),
    };
  }

  return grid;
}

function drawFooter(doc: jsPDF, template: EnvironmentalPrintTemplateConfig) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 8;
  doc.setLineWidth(0.2);
  doc.line(PAGE_MARGIN, footerY - 4, pageWidth - PAGE_MARGIN, footerY - 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(template.footerLeft, PAGE_MARGIN, footerY);
  doc.text(template.qid, pageWidth - PAGE_MARGIN, footerY, { align: 'right' });
}

function drawHeader(
  doc: jsPDF,
  logo: Awaited<ReturnType<typeof loadLogo>>,
  template: EnvironmentalPrintTemplateConfig,
  asset: EnvironmentalAsset,
  month: number,
  year: number,
  locale: string,
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  if (logo) {
    doc.addImage(logo.dataUrl, logo.format, pageWidth / 2 - logo.width / 2, 6, logo.width, logo.height);
  }

  let y = logo ? 24 : 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(ENVIRONMENTAL_PRINT_HOSPITAL, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.setFontSize(9.5);
  doc.text(ENVIRONMENTAL_PRINT_DEPARTMENT, pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text(template.title, pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const metaLines = template.layoutKey === 'form_labgen_055'
    ? [
        `Month/Year: ${monthYearLabel(month, year, locale)}`,
        `Refrigerator (Location and Number): ${printValue(asset.assetName)} / ${printValue(asset.location)} / ${printValue(asset.serialNumber ?? asset.assetCode)}`,
        `Acceptable Range for Temperature: ${template.temperatureRangeLabel}`,
      ]
    : [
        `Location: ${template.departmentLocation}`,
        `Room/Area: ${printValue(template.roomAreaLabel)}`,
        `Month/Year: ${monthYearLabel(month, year, locale)}`,
        `Acceptable Range for Temperature: ${template.temperatureRangeLabel}`,
        ...(template.humidityRangeLabel ? [`Acceptable Range for Humidity: ${template.humidityRangeLabel}`] : []),
      ];

  for (const line of metaLines) {
    doc.text(line, PAGE_MARGIN, y);
    y += 3.8;
  }

  doc.line(PAGE_MARGIN, y + 1, pageWidth - PAGE_MARGIN, y + 1);
  return y + 4;
}

function build055TableBody(grid: MonthlyGrid, month: number, year: number): string[][] {
  const totalDays = daysInMonth(month, year);
  const rows: string[][] = [];

  for (let day = 1; day <= 31; day += 1) {
    if (day > totalDays) {
      rows.push([String(day), '', '', '', '', '', '']);
      continue;
    }
    const dayData = grid[day] ?? {};
    rows.push([
      String(day),
      printValue(dayData['AM Shift']?.temperature),
      printValue(dayData['AM Shift']?.initials),
      printValue(dayData['PM Shift']?.temperature),
      printValue(dayData['PM Shift']?.initials),
      printValue(dayData['Night Shift']?.temperature),
      printValue(dayData['Night Shift']?.initials),
    ]);
  }

  return rows;
}

function build057TableBody(
  grid: MonthlyGrid,
  month: number,
  year: number,
  showHumidity: boolean,
  humidityRequired: boolean,
): string[][] {
  const totalDays = daysInMonth(month, year);
  const rows: string[][] = [];

  for (let day = 1; day <= 31; day += 1) {
    const disabled = day > totalDays;
    const dayData = disabled ? {} : (grid[day] ?? {});

    const shiftCells = (['AM Shift', 'PM Shift', 'Night Shift'] as const).flatMap((shift) => {
      const cell = dayData[shift];
      const temp = disabled ? '' : printValue(cell?.temperature);
      const hum = disabled ? '' : (showHumidity ? (humidityRequired ? printValue(cell?.humidity) : (cell?.humidity != null ? String(cell.humidity) : 'N/A')) : '');
      const initials = disabled ? '' : printValue(cell?.initials);
      return showHumidity ? [temp, hum, initials] : [temp, initials];
    });

    rows.push([String(day), ...shiftCells]);
  }

  return rows;
}

function formatExcursionAlarmDetails(
  excursion: EnvironmentalExcursion,
  template: EnvironmentalPrintTemplateConfig,
): string {
  const parts: string[] = [];
  if (excursion.outOfRangeParameters === 'humidity' || excursion.outOfRangeParameters === 'temperature_humidity') {
    parts.push(`Humidity ${excursion.detectedHumidity ?? '—'}% (acceptable ${excursion.humidityMinAtDetection ?? template.humidityRangeLabel?.replace('%', '') ?? '—'}%)`);
  }
  if (excursion.outOfRangeParameters === 'temperature' || excursion.outOfRangeParameters === 'temperature_humidity') {
    parts.push(`Temperature ${excursion.detectedTemperature}°C (acceptable ${excursion.rangeMinAtDetection}–${excursion.rangeMaxAtDetection}°C)`);
  }
  return parts.join('; ') || formatOutOfRangeParametersLabel(excursion.outOfRangeParameters);
}

function drawBottomSection(
  doc: jsPDF,
  startY: number,
  excursions: EnvironmentalExcursion[],
  template: EnvironmentalPrintTemplateConfig,
): number {
  const monthExcursions = excursions.filter((item) => !item.voidedAt);
  const primary = monthExcursions[0];
  let y = startY + 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Alarm check:', PAGE_MARGIN, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const lines = [
    ['1- Temperature out of Range:', primary ? formatExcursionAlarmDetails(primary, template) : '—'],
    ['2- Noted on:', primary ? printTimestamp(primary.detectedAt) : '—'],
    ['3- Action:', printValue(primary?.immediateAction ?? primary?.additionalComment)],
    ['Record the temperature:', primary?.recheckTemperature != null ? `${primary.recheckTemperature}°C` : '—'],
    ['Name and ID:', primary ? `${printValue(primary.recheckedByName ?? primary.resolvedByName)} / ${printValue(primary.recheckedByStaffId ?? primary.resolvedByStaffId)}` : '—'],
    ['4- Verified:', primary?.resolutionStatus ? printValue(primary.resolutionStatus) : '—'],
    ['Review by:', primary?.reviewedByName ? `${printValue(primary.reviewedByName)} / ${printValue(primary.reviewedByStaffId)} / ${printTimestamp(primary.reviewedAt)}` : '—'],
    ['Supervisor Review:', primary?.reviewDecision ? `${ENVIRONMENTAL_REVIEW_DECISION_LABELS[primary.reviewDecision]} / ${printValue(primary.resolvedByName)} / ${printValue(primary.resolvedByStaffId)} / ${printTimestamp(primary.resolvedAt)}` : '—'],
  ];

  for (const [label, value] of lines) {
    doc.text(label, PAGE_MARGIN, y);
    doc.text(String(value), PAGE_MARGIN + 42, y, { maxWidth: 150 });
    y += 4.2;
  }

  return y;
}

export async function renderEnvironmentalControlledFormPdf(input: ControlledFormInput): Promise<jsPDF | null> {
  const template = getEnvironmentalPrintTemplate(input.asset.assetCode);
  if (!template) return null;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logo = await loadLogo();
  const grid = buildMonthlyGrid(input);
  let y = drawHeader(doc, logo, template, input.asset, input.month, input.year, input.locale);

  if (template.layoutKey === 'form_labgen_055') {
    autoTable(doc, {
      startY: y,
      head: [[
        'DAY',
        { content: 'AM Shift\n7am–3pm', colSpan: 2 },
        { content: 'PM Shift\n3pm–11pm', colSpan: 2 },
        { content: 'Night Shift\n11pm–7am', colSpan: 2 },
      ], ['', 'Temp', 'Initials', 'Temp', 'Initials', 'Temp', 'Initials']],
      body: build055TableBody(grid, input.month, input.year),
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 1, halign: 'center', valign: 'middle' },
      headStyles: { fillColor: [235, 235, 235], textColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 10 } },
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: FOOTER_BLOCK_MM },
      didDrawPage: () => drawFooter(doc, template),
    });
  } else {
    const subHead = template.showHumidityColumns
      ? ['Temp°C', 'Hum%', 'Initials']
      : ['Temp', 'Initials'];
    autoTable(doc, {
      startY: y,
      head: [[
        'DAY',
        { content: `${OFFICIAL_SHIFT_LABELS['AM Shift'].label}\n${OFFICIAL_SHIFT_LABELS['AM Shift'].time}`, colSpan: subHead.length },
        { content: `${OFFICIAL_SHIFT_LABELS['PM Shift'].label}\n${OFFICIAL_SHIFT_LABELS['PM Shift'].time}`, colSpan: subHead.length },
        { content: `${OFFICIAL_SHIFT_LABELS['Night Shift'].label}\n${OFFICIAL_SHIFT_LABELS['Night Shift'].time}`, colSpan: subHead.length },
      ], ['', ...subHead, ...subHead, ...subHead]],
      body: build057TableBody(grid, input.month, input.year, template.showHumidityColumns, input.asset.humidityRequired),
      theme: 'grid',
      styles: { fontSize: 6.2, cellPadding: 0.8, halign: 'center', valign: 'middle' },
      headStyles: { fillColor: [235, 235, 235], textColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 9 } },
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: FOOTER_BLOCK_MM },
      didDrawPage: () => drawFooter(doc, template),
    });
  }

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
  if (finalY > doc.internal.pageSize.getHeight() - 50) {
    doc.addPage();
    drawBottomSection(doc, 20, input.excursions.filter((item) => item.assetId === input.asset.id), template);
  } else {
    drawBottomSection(doc, finalY, input.excursions.filter((item) => item.assetId === input.asset.id), template);
  }

  drawFooter(doc, template);
  return doc;
}

export async function createEnvironmentalMonthlyReportPdf(input: ControlledFormInput): Promise<jsPDF | null> {
  return renderEnvironmentalControlledFormPdf(input);
}
