'use client';

import { OFFICIAL_HOSPITAL_LOGO_SRC } from '@/lib/portal/official-logo.constants';
import {
  QC_REPORT_DEPARTMENT,
  QC_REPORT_FOOTER,
  QC_REPORT_HOSPITAL,
  QC_REPORT_TITLE,
} from '@/lib/print/qc-report';

export function QCPrintHeader() {
  return (
    <header className="qc-print-header hidden print:block mb-3">
      <div className="flex flex-col items-center text-center gap-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={OFFICIAL_HOSPITAL_LOGO_SRC}
          alt="Hospital Logo"
          className="h-14 w-auto max-w-[120px] object-contain"
        />
        <p className="text-base font-semibold text-foreground tracking-wide">{QC_REPORT_HOSPITAL}</p>
        <p className="text-sm text-foreground">{QC_REPORT_DEPARTMENT}</p>
      </div>
      <hr className="mt-3 border-t border-foreground/30" />
    </header>
  );
}

export function QCPrintFooter() {
  return (
    <footer className="qc-print-footer hidden print:block">
      <hr className="mb-2 border-t border-foreground/30" />
      <div className="flex justify-center text-[9pt] text-foreground">
        <span>{QC_REPORT_FOOTER}</span>
      </div>
    </footer>
  );
}

export function QCPrintTitle() {
  return (
    <h1 className="qc-print-title hidden print:block text-center text-[13pt] font-bold tracking-wide mb-2">
      {QC_REPORT_TITLE}
    </h1>
  );
}
