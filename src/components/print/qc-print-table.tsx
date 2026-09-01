'use client';

import { useMemo } from 'react';
import { QCControlledFormPrintSection } from '@/components/print/qc-controlled-form-print';
import { PrintReportingPeriod } from '@/components/print/print-reporting-period';
import { groupQCRecordsForControlledPrint } from '@/lib/print/qc-controlled-form-data';
import {
  buildQCMainTableRows,
  buildQCOutSectionRows,
  buildQCWorkflowSectionRows,
  QC_MAIN_TABLE_HEADERS,
  QC_OUT_SECTION_HEADERS,
  QC_OUT_SECTION_TITLE,
  QC_REPORT_TITLE,
  QC_WORKFLOW_SECTION_HEADERS,
  QC_WORKFLOW_SECTION_TITLE,
} from '@/lib/print/qc-report';
import type { Instrument, QCRecord } from '@/types';

interface QCPrintTableProps {
  records: QCRecord[];
  instrumentNames: Record<string, string>;
  reportingPeriod?: string;
  instrumentsById?: Record<string, Instrument>;
  materialConfigsByParameter?: Record<string, { lotNumber?: string; expiryDate?: string }>;
}

export function QCPrintTable({
  records,
  instrumentNames,
  reportingPeriod,
  instrumentsById,
  materialConfigsByParameter,
}: QCPrintTableProps) {
  const { controlledGroups, genericRecords } = useMemo(
    () => groupQCRecordsForControlledPrint(
      records,
      instrumentNames,
      instrumentsById,
      materialConfigsByParameter,
    ),
    [records, instrumentNames, instrumentsById, materialConfigsByParameter],
  );

  const mainRows = buildQCMainTableRows(genericRecords, instrumentNames);
  const outRows = buildQCOutSectionRows(genericRecords, instrumentNames);
  const workflowRows = buildQCWorkflowSectionRows(genericRecords, instrumentNames);

  return (
    <div className="qc-print-body hidden print:block">
      {controlledGroups.map((group) => (
        <QCControlledFormPrintSection key={`${group.templateKey}-${group.instrumentId}-${group.year}-${group.month}`} group={group} />
      ))}

      {genericRecords.length > 0 && (
        <>
          <h1 className="qc-print-title">{QC_REPORT_TITLE}</h1>
          {reportingPeriod && (
            <PrintReportingPeriod label={reportingPeriod} className="qc-print-period mb-2" />
          )}
          <table className="qc-print-table">
            <thead>
              <tr>
                {QC_MAIN_TABLE_HEADERS.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mainRows.map((row, rowIndex) => (
                <tr key={genericRecords[rowIndex]?.id ?? rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {outRows.length > 0 && (
            <div className="qc-out-section mt-4">
              <h2 className="qc-out-section-title">{QC_OUT_SECTION_TITLE}</h2>
              <table className="qc-print-table qc-out-table">
                <thead>
                  <tr>
                    {QC_OUT_SECTION_HEADERS.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {outRows.map((row, rowIndex) => (
                    <tr key={`out-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`out-${rowIndex}-${cellIndex}`}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {workflowRows.length > 0 && (
            <div className="qc-workflow-section mt-4">
              <h2 className="qc-workflow-section-title">{QC_WORKFLOW_SECTION_TITLE}</h2>
              <table className="qc-print-table qc-workflow-table">
                <thead>
                  <tr>
                    {QC_WORKFLOW_SECTION_HEADERS.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {workflowRows.map((row, rowIndex) => (
                    <tr key={`workflow-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`workflow-${rowIndex}-${cellIndex}`}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
