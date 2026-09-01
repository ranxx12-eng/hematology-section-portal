import {
  QC_CORRECTIVE_ACTION_LEGEND,
  QC_CORRECTIVE_ACTION_STATUS_LABELS,
  QC_CORRECTIVE_RESULT_AFTER_LABELS,
  monthName,
} from '@/lib/qc-corrective-actions/constants';
import type { QcCorrectiveAuditEvent, QcCorrectiveMonthSummary, QcCorrectiveWorklistItem } from '@/types/qc-corrective-action';

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

export function buildQcCorrectiveExcelXml(
  items: QcCorrectiveWorklistItem[],
  summary: QcCorrectiveMonthSummary,
  auditEvents: QcCorrectiveAuditEvent[],
  periodLabel: string,
): string {
  const actionRows = [
    row([
      'Date', 'Analyzer', 'QC Material', 'Analyte', 'QC Level', 'Failed Value', 'Corrected Value',
      'Action Code', 'Corrective Action', 'Explanation', 'Remarks', 'Operator', 'Completed By', 'Status',
    ]),
  ];

  for (const item of items) {
    actionRows.push(row([
      item.recordedAt,
      item.instrumentName,
      item.qcMaterial,
      item.analyte,
      item.qcLevel,
      item.failedValue,
      item.correctedValue ?? '',
      item.correctiveActionCode ?? '',
      item.correctiveActionLabel ?? '',
      item.explanation ?? '',
      item.remarks ?? '',
      item.operatorName ?? '',
      item.actionStatus === 'completed' ? (item.operatorName ?? '') : '',
      QC_CORRECTIVE_ACTION_STATUS_LABELS[item.actionStatus],
    ]));
  }

  const summaryRows = [
    row(['Reporting Period', periodLabel]),
    row(['Total QC OUT', summary.totalQcOut]),
    row(['Corrective Actions Required', summary.correctiveActionsRequired]),
    row(['Completed', summary.completed]),
    row(['Pending Review', summary.pendingReview]),
    row(['Pending Approval', summary.pendingApproval]),
    row(['Approved', summary.approved]),
    row(['Missing Data', summary.missingData]),
    row(['Service Calls (G)', summary.serviceCallCount]),
    row(['Recalibrations (E)', summary.recalibrationCount]),
    row(['Repeated Failures', summary.repeatedFailureCount]),
    row([]),
    row(['Corrective Actions by Type']),
    row(['Code', 'Description', 'Count']),
  ];

  for (const code of Object.keys(QC_CORRECTIVE_ACTION_LEGEND)) {
    summaryRows.push(row([
      code,
      QC_CORRECTIVE_ACTION_LEGEND[code as keyof typeof QC_CORRECTIVE_ACTION_LEGEND],
      summary.actionCounts[code as keyof typeof summary.actionCounts] ?? 0,
    ]));
  }

  const auditRows = [
    row(['Timestamp', 'User', 'Staff ID', 'Action', 'Old Status', 'New Status', 'Comment']),
  ];
  for (const event of auditEvents) {
    auditRows.push(row([
      event.createdAt,
      event.userName ?? '',
      event.staffId ?? '',
      event.action,
      event.oldStatus ?? '',
      event.newStatus ?? '',
      event.comment ?? '',
    ]));
  }

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Monthly Corrective Actions">
  <Table>${actionRows.join('')}</Table>
 </Worksheet>
 <Worksheet ss:Name="Summary">
  <Table>${summaryRows.join('')}</Table>
 </Worksheet>
 <Worksheet ss:Name="Audit Trail">
  <Table>${auditRows.join('')}</Table>
 </Worksheet>
</Workbook>`;
}

export function downloadQcCorrectiveExcel(
  items: QcCorrectiveWorklistItem[],
  summary: QcCorrectiveMonthSummary,
  auditEvents: QcCorrectiveAuditEvent[],
  filename: string,
): void {
  const periodLabel = `${monthName(summary.month)} ${summary.year}`;
  const xml = buildQcCorrectiveExcelXml(items, summary, auditEvents, periodLabel);
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export { QC_CORRECTIVE_RESULT_AFTER_LABELS };
