'use client';

import { PrintReportingPeriod } from '@/components/print/print-reporting-period';
import {
  SAMPLE_REJECTION_PRINT_HEADERS,
  buildSampleRejectionPrintRows,
  SAMPLE_REJECTION_REPORT_TITLE,
} from '@/lib/print/sample-rejection-report';
import type { SampleRejection } from '@/types';

interface SampleRejectionPrintTableProps {
  records: SampleRejection[];
  reportingPeriod?: string;
}

export function SampleRejectionPrintTable({ records, reportingPeriod }: SampleRejectionPrintTableProps) {
  const rows = buildSampleRejectionPrintRows(records);

  return (
    <div className="sample-rejection-print-body hidden print:block">
      <h1 className="sample-rejection-print-title">{SAMPLE_REJECTION_REPORT_TITLE}</h1>
      {reportingPeriod && <PrintReportingPeriod label={reportingPeriod} className="sample-rejection-print-period mb-2" />}
      <table className="sample-rejection-print-table">
        <thead>
          <tr>
            {SAMPLE_REJECTION_PRINT_HEADERS.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={records[rowIndex]?.id ?? rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
