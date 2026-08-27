'use client';

import {
  CriticalValuesSupervisorReview,
} from '@/components/print/critical-values-print-chrome';
import { PrintReportingPeriod } from '@/components/print/print-reporting-period';
import {
  buildCriticalValuePrintRows,
  CRITICAL_VALUE_LOG_HEADERS,
  CRITICAL_VALUES_LOG_TITLE,
} from '@/lib/print/critical-values-report';
import type { CriticalValue } from '@/types';

interface CriticalValuesPrintTableProps {
  records: CriticalValue[];
  reportingPeriod?: string;
}

const COLUMN_WIDTHS = [
  '4%', '10%', '7%', '8%', '7%', '5%', '7%', '7%', '5%', '6%', '8%', '4%', '9%', '7%', '6%',
];

export function CriticalValuesPrintTable({ records, reportingPeriod }: CriticalValuesPrintTableProps) {
  const rows = buildCriticalValuePrintRows(records);

  return (
    <div className="critical-values-print-body hidden print:block">
      <h1 className="critical-values-print-title">{CRITICAL_VALUES_LOG_TITLE}</h1>
      {reportingPeriod && (
        <PrintReportingPeriod label={reportingPeriod} className="critical-values-print-period mb-2" />
      )}
      <table className="critical-values-print-table">
        <colgroup>
          {COLUMN_WIDTHS.map((width, index) => (
            <col key={CRITICAL_VALUE_LOG_HEADERS[index]} style={{ width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {CRITICAL_VALUE_LOG_HEADERS.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={records[rowIndex]?.id ?? rowIndex}>
              {row.map((cell, cellIndex) => (
                <td
                  key={`${rowIndex}-${cellIndex}`}
                  className={
                    cellIndex === 1 || cellIndex === 12
                      ? 'critical-values-cell-wrap-left'
                      : cellIndex === 11 || cellIndex === 8 || cellIndex === 0
                        ? 'critical-values-cell-narrow'
                        : undefined
                  }
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <CriticalValuesSupervisorReview />
    </div>
  );
}
