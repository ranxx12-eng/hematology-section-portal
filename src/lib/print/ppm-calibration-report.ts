import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DUE_STATUS_LABELS } from '@/lib/ppm-calibration/constants';
import { loadControlledFormLogo } from '@/lib/print/qc-controlled-form-pdf';
import { PRINT_LANDSCAPE_PAGE } from '@/lib/print/landscape-layout';
import { formatDate } from '@/lib/utils';
import type { EquipmentMaintenanceRecord, InstrumentMaintenanceSummary } from '@/types/ppm-calibration';

interface PpmCalibrationReportOptions {
  mode: 'ppm_due' | 'calibration_due' | 'history';
  summaries: InstrumentMaintenanceSummary[];
  records: EquipmentMaintenanceRecord[];
  locale: string;
}

export async function createPpmCalibrationReportPdf(
  options: PpmCalibrationReportOptions,
): Promise<jsPDF | null> {
  const { mode, summaries, records, locale } = options;
  const doc = new jsPDF(PRINT_LANDSCAPE_PAGE);
  const logo = await loadControlledFormLogo();

  const title = mode === 'ppm_due'
    ? 'PPM Due Report'
    : mode === 'calibration_due'
      ? 'Calibration Due Report'
      : 'Equipment Maintenance History';

  doc.setFontSize(14);
  doc.text('Hematology Section Portal', 14, 16);
  doc.setFontSize(11);
  doc.text(title, 14, 24);
  doc.setFontSize(9);
  doc.text(`Generated: ${formatDate(new Date().toISOString(), locale)}`, 14, 30);

  if (logo) {
    doc.addImage(logo.dataUrl, logo.format, doc.internal.pageSize.getWidth() - 40, 8, 24, 24);
  }

  if (mode === 'history') {
    autoTable(doc, {
      startY: 36,
      head: [['Date', 'Item', 'Type', 'Result', 'Next Due', 'Status', 'Performed By']],
      body: records.map((record) => {
        const item = summaries.find((s) => s.instrumentId === record.instrumentEquipmentId);
        return [
          formatDate(record.performedDate, locale),
          item?.instrumentName ?? record.instrumentEquipmentId,
          record.recordType.toUpperCase(),
          record.result.toUpperCase(),
          record.nextDueDate ? formatDate(record.nextDueDate, locale) : '—',
          DUE_STATUS_LABELS[record.dueStatus],
          record.performedByName,
        ];
      }),
      styles: { fontSize: 8 },
    });
    return records.length ? doc : null;
  }

  const filtered = summaries.filter((summary) => {
    if (mode === 'ppm_due') {
      return summary.ppmStatus === 'due_soon' || summary.ppmStatus === 'overdue';
    }
    return summary.calibrationStatus === 'due_soon' || summary.calibrationStatus === 'overdue';
  });

  if (filtered.length === 0) return null;

  autoTable(doc, {
    startY: 36,
    head: [['Instrument / Equipment', 'Type', 'Location', 'Last Date', 'Next Due', 'Status']],
    body: filtered.map((summary) => [
      summary.instrumentName,
      summary.itemType,
      summary.location ?? '—',
      mode === 'ppm_due'
        ? (summary.lastPpmDate ? formatDate(summary.lastPpmDate, locale) : '—')
        : (summary.lastCalibrationDate ? formatDate(summary.lastCalibrationDate, locale) : '—'),
      mode === 'ppm_due'
        ? (summary.nextPpmDate ? formatDate(summary.nextPpmDate, locale) : '—')
        : (summary.nextCalibrationDate ? formatDate(summary.nextCalibrationDate, locale) : '—'),
      DUE_STATUS_LABELS[mode === 'ppm_due' ? summary.ppmStatus : summary.calibrationStatus],
    ]),
    styles: { fontSize: 8 },
  });

  return doc;
}
