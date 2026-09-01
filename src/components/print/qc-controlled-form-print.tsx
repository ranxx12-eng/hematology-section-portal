'use client';

import {
  buildControlledFormTableRows,
  buildMaintenance008ATableRows,
  formatMaintenanceProblemsSection,
  formatMonthlyApprovalSection,
  formatMonthlyReviewSection,
  type MaintenanceControlledFormGroup,
  type QCControlledFormGroup,
} from '@/lib/print/qc-controlled-form-data';
import {
  getQCPrintTemplateConfig,
  QC_PRINT_DEPARTMENT,
  QC_PRINT_HOSPITAL,
  QC_PRINT_SECTION,
} from '@/lib/print/qc-print-templates';
import { OFFICIAL_HOSPITAL_LOGO_SRC } from '@/lib/portal/official-logo.constants';
import { printValue } from '@/lib/print/report-value';

function buildQcMetaLines(group: QCControlledFormGroup, templateMeta?: readonly string[]): string[] {
  const lines = [`Year: ${group.year}`, `Month: ${group.monthLabel}`];
  if (templateMeta?.includes('Lot #')) {
    lines.push(`Lot #: ${printValue(group.materialLotNumber)}`);
  }
  if (templateMeta?.includes('Expiry')) {
    lines.push(`Expiry: ${group.materialExpiryDate ? printValue(group.materialExpiryDate) : '—'}`);
  }
  if (templateMeta?.includes('Expiration Date')) lines.push('Expiration Date: —');
  if (templateMeta?.includes('LOT QC 1#')) lines.push('LOT QC 1#: —', 'LOT QC 2#: —');
  if (templateMeta?.includes('Instrument')) {
    lines.unshift(`Instrument: ${group.instrumentName}`);
    lines.push(`Serial #: ${printValue(group.instrument?.serialNumber)}`);
  }
  if (group.templateKey === 'hema-007') {
    lines.push('Normal Range: 6.8–7.2');
  }
  return lines;
}

function buildMaintenanceMetaLines(group: MaintenanceControlledFormGroup): string[] {
  return [
    `Instrument: ${group.instrumentName}`,
    `Serial #: ${printValue(group.instrument?.serialNumber)}`,
    `Brand #: ${printValue(group.instrument?.model || group.instrument?.manufacturer)}`,
    `Month: ${group.monthLabel}`,
    `Year: ${group.year}`,
  ];
}

function ControlledFormHeader({
  title,
  subtitle,
  metaLines,
}: {
  title: string;
  subtitle?: string;
  metaLines: string[];
}) {
  return (
    <header className="qc-controlled-print-header mb-3 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={OFFICIAL_HOSPITAL_LOGO_SRC} alt="Hospital Logo" className="mx-auto h-14 w-auto max-w-[120px] object-contain" />
      <p className="mt-2 text-base font-semibold">{QC_PRINT_HOSPITAL}</p>
      <p className="text-sm">{QC_PRINT_DEPARTMENT}</p>
      <p className="text-sm">{QC_PRINT_SECTION}</p>
      <h1 className="mt-2 text-[13pt] font-bold">{title}</h1>
      {subtitle && <p className="text-sm">{subtitle}</p>}
      <div className="mt-2 space-y-0.5 text-xs">
        {metaLines.map((line) => <p key={line}>{line}</p>)}
      </div>
      <hr className="mt-3 border-t border-foreground/30" />
    </header>
  );
}

function ControlledFormFooter({ footerLeft, qid }: { footerLeft: string; qid: string }) {
  return (
    <footer className="qc-controlled-print-footer mt-4 flex justify-between text-[8pt]">
      <span>{footerLeft}</span>
      <span>{qid}</span>
    </footer>
  );
}

function MonthlyWorkflowSections({
  monthlyRecord,
  reviewTitle = 'MONTHLY REVIEW — QUALITY OFFICER',
  approvalTitle = 'MONTHLY SUPERVISOR APPROVAL',
}: {
  monthlyRecord?: QCControlledFormGroup['monthlyRecord'];
  reviewTitle?: string;
  approvalTitle?: string;
}) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
      <section>
        <h3 className="mb-1 text-[10pt] font-bold">{reviewTitle}</h3>
        <table className="qc-print-table w-full">
          <tbody>
            {formatMonthlyReviewSection(monthlyRecord).map(([label, value]) => (
              <tr key={label}>
                <th className="w-36 text-left">{label}</th>
                <td className="whitespace-pre-wrap">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h3 className="mb-1 text-[10pt] font-bold">{approvalTitle}</h3>
        <table className="qc-print-table w-full">
          <tbody>
            {formatMonthlyApprovalSection(monthlyRecord).map(([label, value]) => (
              <tr key={label}>
                <th className="w-36 text-left">{label}</th>
                <td className="whitespace-pre-wrap">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export function QCControlledFormPrintSection({ group }: { group: QCControlledFormGroup }) {
  const template = getQCPrintTemplateConfig(group.templateKey);
  const rows = buildControlledFormTableRows(group);
  const metaLines = [
    ...(template.referenceRanges ?? []),
    ...buildQcMetaLines(group, template.headerMeta),
  ];

  return (
    <section className="qc-controlled-form-section mb-8 break-after-page">
      <ControlledFormHeader title={template.title} subtitle={template.subtitle} metaLines={metaLines} />
      <table className="qc-print-table w-full">
        <thead>
          <tr>
            {template.tableHeaders.map((header) => <th key={header}>{header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} className="whitespace-pre-wrap">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <MonthlyWorkflowSections
        monthlyRecord={group.monthlyRecord}
        reviewTitle={template.monthlyReviewTitle}
        approvalTitle={template.monthlyApprovalTitle}
      />
      <ControlledFormFooter footerLeft={template.footerLeft} qid={template.qid} />
    </section>
  );
}

export function Maintenance008APrintSection({ group }: { group: MaintenanceControlledFormGroup }) {
  const template = getQCPrintTemplateConfig('hema-008a');
  const rows = buildMaintenance008ATableRows(group);

  return (
    <section className="qc-controlled-form-section mb-8 break-after-page">
      <ControlledFormHeader
        title={template.title}
        metaLines={buildMaintenanceMetaLines(group)}
      />
      <table className="qc-print-table w-full">
        <thead>
          <tr>
            {template.tableHeaders.map((header) => <th key={header}>{header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <section className="mt-4">
        <h3 className="mb-1 text-[10pt] font-bold">Problems / Corrective Actions</h3>
        <p className="text-sm whitespace-pre-wrap">{formatMaintenanceProblemsSection(group.records)}</p>
      </section>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <section>
          <h3 className="mb-1 text-[10pt] font-bold">MONTHLY REVIEW — QUALITY OFFICER</h3>
          <table className="qc-print-table w-full">
            <tbody>
              {formatMonthlyReviewSection(undefined).map(([label, value]) => (
                <tr key={label}><th className="w-36 text-left">{label}</th><td>{value}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <h3 className="mb-1 text-[10pt] font-bold">MONTHLY SUPERVISOR APPROVAL</h3>
          <table className="qc-print-table w-full">
            <tbody>
              {formatMonthlyApprovalSection(undefined).map(([label, value]) => (
                <tr key={label}><th className="w-36 text-left">{label}</th><td>{value}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      <ControlledFormFooter footerLeft={template.footerLeft} qid={template.qid} />
    </section>
  );
}
