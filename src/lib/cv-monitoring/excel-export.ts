import {
  CV_RESULT_STATUS_LABELS,
  CV_TREND_LABELS,
  analytePrintCode,
  monthName,
} from '@/lib/cv-monitoring/constants';
import { roundForDisplay } from '@/lib/cv-monitoring/calculation';
import type { CvMonitoringAuditEvent, CvMonitoringRecord } from '@/types/cv-monitoring';

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cell(value: string | number): string {
  if (typeof value === 'number') return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  return `<Cell><Data ss:Type="String">${escapeXml(String(value ?? ''))}</Data></Cell>`;
}

function row(cells: Array<string | number>): string {
  return `<Row>${cells.map((c) => cell(c)).join('')}</Row>`;
}

export function buildCvMonitoringExcelXml(record: CvMonitoringRecord, auditEvents: CvMonitoringAuditEvent[]): string {
  const comparisonRows = [
    row(['Level', 'Lot', 'Analyte', 'CV Limit', 'Prev Mean', 'Prev SD', 'Prev CV', 'Prev Status', 'Curr Mean', 'Curr SD', 'Curr CV', 'Curr Status', 'CV Change', 'Trend', 'Comment']),
  ];

  for (const level of record.levels) {
    const results = record.results.filter((r) => r.levelId === level.id);
    for (const r of results) {
      comparisonRows.push(row([
        level.qcLevel,
        level.lotNumber ?? '',
        analytePrintCode(r.analyteCode),
        r.cvLimitSnapshot ?? '',
        r.previousMean ?? '',
        r.previousSd ?? '',
        r.previousCvPercent != null ? roundForDisplay(r.previousCvPercent, 2) : 'N/A',
        CV_RESULT_STATUS_LABELS[r.previousStatus] ?? r.previousStatus,
        r.currentMean ?? '',
        r.currentSd ?? '',
        r.currentCvPercent != null ? roundForDisplay(r.currentCvPercent, 2) : 'N/A',
        CV_RESULT_STATUS_LABELS[r.currentStatus] ?? r.currentStatus,
        r.cvChange != null ? roundForDisplay(r.cvChange, 2) : '',
        r.trendStatus ? CV_TREND_LABELS[r.trendStatus] : '',
        r.comment ?? '',
      ]));
    }
  }

  const trendRows = [
    row(['Month', 'Year', 'Instrument', 'Level', 'Analyte', 'Mean', 'SD', 'CV %', 'CV Limit', 'Status']),
  ];
  for (const level of record.levels) {
    for (const r of record.results.filter((x) => x.levelId === level.id)) {
      trendRows.push(row([
        monthName(record.currentMonth),
        record.currentYear,
        record.instrumentNameSnapshot,
        level.qcLevel,
        analytePrintCode(r.analyteCode),
        r.currentMean ?? '',
        r.currentSd ?? '',
        r.currentCvPercent != null ? roundForDisplay(r.currentCvPercent, 2) : '',
        r.cvLimitSnapshot ?? '',
        CV_RESULT_STATUS_LABELS[r.currentStatus] ?? r.currentStatus,
      ]));
    }
  }

  const investigationRows = [
    row(['Level', 'Analyte', 'Observation', 'Investigation', 'Possible Cause', 'Corrective Action', 'Disposition']),
  ];
  for (const level of record.levels) {
    for (const r of record.results.filter((x) => x.levelId === level.id && x.currentStatus === 'high_cv')) {
      investigationRows.push(row([
        level.qcLevel,
        analytePrintCode(r.analyteCode),
        r.observation ?? '',
        r.investigation ?? '',
        r.possibleCause ?? '',
        r.correctiveAction ?? '',
        r.qualityDisposition ?? '',
      ]));
    }
  }

  const auditRows = [
    row(['Timestamp', 'User', 'Staff ID', 'Action', 'Old Status', 'New Status', 'Comment']),
  ];
  for (const event of auditEvents) {
    auditRows.push(row([
      event.createdAt,
      event.userName,
      event.staffId ?? '',
      event.action,
      event.oldStatus ?? '',
      event.newStatus ?? '',
      event.comment ?? '',
    ]));
  }

  const worksheets = [
    `<Worksheet ss:Name="Monthly CV Comparison"><Table>${comparisonRows.join('')}</Table></Worksheet>`,
    `<Worksheet ss:Name="Trend Data"><Table>${trendRows.join('')}</Table></Worksheet>`,
    `<Worksheet ss:Name="Investigations"><Table>${investigationRows.join('')}</Table></Worksheet>`,
    `<Worksheet ss:Name="Audit Trail"><Table>${auditRows.join('')}</Table></Worksheet>`,
  ];

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${worksheets.join('\n')}
</Workbook>`;
}

export function downloadCvMonitoringExcel(record: CvMonitoringRecord, auditEvents: CvMonitoringAuditEvent[]): void {
  const xml = buildCvMonitoringExcelXml(record, auditEvents);
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${record.monitoringNumber.replace(/\s+/g, '-')}-cv-monitoring.xls`;
  anchor.click();
  URL.revokeObjectURL(url);
}
