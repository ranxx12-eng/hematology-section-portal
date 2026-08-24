'use client';

import {
  buildCriticalValuePrintRows,
  CRITICAL_VALUE_PRINT_HEADERS,
  CRITICAL_VALUE_REPORT_TITLE,
} from '@/lib/print/critical-values-report';
import type { CriticalValue } from '@/types';

interface CriticalValuesPrintTableProps {
  records: CriticalValue[];
}

export function CriticalValuesPrintTable({ records }: CriticalValuesPrintTableProps) {
  const rows = buildCriticalValuePrintRows(records);

  return (
    <div className="critical-values-print-body hidden print:block">
      <h1 className="critical-values-print-title">{CRITICAL_VALUE_REPORT_TITLE}</h1>
      <table className="critical-values-print-table">
        <thead>
          <tr>
            {CRITICAL_VALUE_PRINT_HEADERS.map((header) => (
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
