import {
  COMPARISON_OVERALL_RESULT_LABELS,
  COMPARISON_RESULT_STATUS_LABELS,
} from '@/lib/comparison-studies/constants';
import {
  buildStudySummary,
  effectiveResultStatus,
  roundForDisplay,
} from '@/lib/comparison-studies/calculation';
import type { ComparisonAuditEvent, ComparisonSectionCode, ComparisonStudy } from '@/types/comparison-study';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cell(value: string | number): string {
  const text = String(value ?? '');
  if (typeof value === 'number') {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  return `<Cell><Data ss:Type="String">${escapeXml(text)}</Data></Cell>`;
}

function row(cells: Array<string | number>): string {
  return `<Row>${cells.map((c) => cell(c)).join('')}</Row>`;
}

function sectionSheet(name: string, study: ComparisonStudy, section: ComparisonSectionCode): string {
  const samples = study.samples.filter((s) => s.section === section);
  const sampleIds = samples.map((s) => s.id);
  const results = study.results.filter((r) => sampleIds.includes(r.sampleId));
  const tests = [...new Set(results.map((r) => r.testCode))];

  const rows = [
    row(['Sample ID', 'Test', 'Unit', 'Previous', 'New', 'Diff Units', 'Diff %', 'TAE %', 'Status']),
  ];

  for (const testCode of tests) {
    for (const result of results.filter((r) => r.testCode === testCode)) {
      const sample = samples.find((s) => s.id === result.sampleId);
      const status = effectiveResultStatus(result);
      rows.push(row([
        sample?.sampleId ?? '',
        result.testName,
        result.unit,
        result.previousResult ?? '',
        result.newResult ?? '',
        result.differenceUnits != null ? roundForDisplay(result.differenceUnits, 3) : '',
        result.differencePercent != null ? roundForDisplay(result.differencePercent, 2) : 'N/A',
        result.taeLimitSnapshot ?? '',
        COMPARISON_RESULT_STATUS_LABELS[status] ?? status,
      ]));
    }
  }

  return `<Worksheet ss:Name="${escapeXml(name)}"><Table>${rows.join('')}</Table></Worksheet>`;
}

function summarySheet(study: ComparisonStudy): string {
  const summary = buildStudySummary(study.results, study.samples.length);
  const rows = [
    row(['Study Number', study.studyNumber]),
    row(['Study Title', study.studyTitle]),
    row(['Comparison Type', study.comparisonType ?? '']),
    row(['Reference', study.referenceLabel ?? '']),
    row(['Comparison', study.comparisonLabel ?? '']),
    row(['Overall Result', study.overallResult ? COMPARISON_OVERALL_RESULT_LABELS[study.overallResult] ?? study.overallResult : '']),
    row(['Total Samples', summary.totalSamples]),
    row(['Total Tests', summary.totalTests]),
    row(['Acceptable', summary.acceptable]),
    row(['Not Acceptable', summary.notAcceptable]),
    row(['Manual Review', summary.manualReview]),
    row(['Incomplete', summary.incomplete]),
    row(['Completion %', roundForDisplay(summary.completionPercent, 1)]),
    row([]),
    row(['Analyte', 'Acceptable', 'Not Acceptable', 'Manual Review', 'Incomplete', 'Total']),
  ];

  for (const analyte of summary.analyteSummaries) {
    rows.push(row([
      analyte.testName,
      analyte.acceptable,
      analyte.notAcceptable,
      analyte.manualReview,
      analyte.incomplete,
      analyte.total,
    ]));
  }

  return `<Worksheet ss:Name="Summary"><Table>${rows.join('')}</Table></Worksheet>`;
}

function auditSheet(events: ComparisonAuditEvent[]): string {
  const rows = [
    row(['Timestamp', 'User', 'Staff ID', 'Action', 'Old Status', 'New Status', 'Comment']),
  ];
  for (const event of events) {
    rows.push(row([
      event.createdAt,
      event.userName,
      event.staffId ?? '',
      event.action,
      event.oldStatus ?? '',
      event.newStatus ?? '',
      event.comment ?? '',
    ]));
  }
  return `<Worksheet ss:Name="Audit Trail"><Table>${rows.join('')}</Table></Worksheet>`;
}

export function buildComparisonExcelXml(study: ComparisonStudy, auditEvents: ComparisonAuditEvent[]): string {
  const worksheets = [
    sectionSheet('CBC', study, 'CBC'),
    sectionSheet('Coagulation', study, 'COAGULATION'),
    sectionSheet('ESR', study, 'ESR'),
    summarySheet(study),
    auditSheet(auditEvents),
  ];

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${worksheets.join('\n')}
</Workbook>`;
}

export function downloadComparisonExcel(study: ComparisonStudy, auditEvents: ComparisonAuditEvent[]): void {
  const xml = buildComparisonExcelXml(study, auditEvents);
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${study.studyNumber.replace(/\s+/g, '-')}-comparison.xls`;
  anchor.click();
  URL.revokeObjectURL(url);
}
